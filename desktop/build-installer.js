// =============================================================================
// build-installer.js — wraps electron-builder so the VSCode-friendly
// package.json (`main: ./extension.js`) is preserved.
//
// Why: electron-builder's `extraMetadata` option mutates the on-disk
// package.json (it does NOT just patch the .asar copy). That nukes our vsix
// config. So instead we swap `main` to desktop/main.js before the build and
// restore the original after — wrapped in try/finally so a failure can't
// leave the repo in a half-converted state.
// =============================================================================

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const target = process.argv[2] || 'win';            // 'win' | 'mac'
const pkgPath = path.join(__dirname, '..', 'package.json');
const raw = fs.readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(raw);
const originalMain = pkg.main;

if (originalMain === 'desktop/main.js') {
  console.warn('[build-installer] package.json `main` already points at desktop/main.js — running build as-is. If your vsix build is broken, restore main to ./extension.js.');
} else {
  pkg.main = 'desktop/main.js';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log(`[build-installer] swapped main: ${originalMain} → desktop/main.js`);
}

// Idempotent restore — safe to call multiple times. Used by the finally block
// AND signal handlers AND a post-build verify pass, because electron-builder
// has been observed to mutate package.json asynchronously after spawnSync
// returns (presumably via its app-builder Go subprocess writing extra metadata
// even when we didn't ask for it). The fix is to always re-read the file after
// the build and write `raw` back if it doesn't match.
function restore() {
  try { fs.writeFileSync(pkgPath, raw, 'utf8'); } catch {}
}
function verifyAndRestore(label) {
  let current = '';
  try { current = fs.readFileSync(pkgPath, 'utf8'); } catch {}
  if (current !== raw) {
    restore();
    console.log(`[build-installer] restored package.json (${label} — file had drifted)`);
  } else {
    console.log(`[build-installer] package.json clean at ${label}`);
  }
}
process.on('SIGINT',  () => { restore(); process.exit(130); });
process.on('SIGTERM', () => { restore(); process.exit(143); });

const env = { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' };
delete env.ELECTRON_RUN_AS_NODE;

let exitCode = 0;
try {
  const res = spawnSync(
    'npx',
    ['electron-builder', `--${target}`],
    { stdio: 'inherit', env, cwd: path.join(__dirname, '..'), shell: true }
  );
  exitCode = res.status == null ? 1 : res.status;
  if (res.error) console.error('[build-installer] spawn error:', res.error);
} finally {
  // First restore (synchronous, before any post-build async work in electron-builder
  // has a chance to write to package.json).
  restore();
  console.log('[build-installer] restored original package.json (immediate)');
}

// Second + third verifies: electron-builder occasionally mutates package.json
// AFTER the build process exits (its app-builder subprocess flushes late). We
// re-check at 200ms and 800ms and rewrite raw if needed. Cheap defense.
setTimeout(() => verifyAndRestore('+200ms'), 200);
setTimeout(() => {
  verifyAndRestore('+800ms');
  process.exit(exitCode);
}, 800);
