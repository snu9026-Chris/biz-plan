// =============================================================================
// Biz Plan Agent — Center Webview Script
//
// File layout:
//   §1  VS Code messaging handle + server-injected globals
//   §2  Configuration constants (SVGs, mode lists, thinking verbs, palette regex)
//   §3  App state — single source of mutable runtime state
//   §4  DOM cache — all DOM refs in one object, populated at bootstrap
//   §5  API — thin wrappers around vscode.postMessage
//   §6  Utilities (escapeHtml, contrast ink)
//   §7  Parsers (palette blocks, slide markdown)
//   §8  UI — thinking indicator
//   §9  UI — status bar + busy state
//   §10 UI — chat bubble (with palette + pin button)
//   §11 UI — research cards
//   §12 UI — accordion (shared by slide agent + boss work copy)
//   §13 UI — boss 2-pane (work copy + review log tabs)
//   §14 UI — right editors (draft / last result / notes / file upload)
//   §15 Event wiring (send, finalize, primary, clear chat)
//   §16 Incoming message router
//   §17 Bootstrap
// =============================================================================

// =============================================================================
// §1  VS Code handle + server-injected globals
//     AGENT / PREV / FINAL / HISTORY / RIGHT_STATE / RESULTS_DIR are
//     declared in center.html's <script> block (string-replaced by
//     extension.js renderCenterPanel before injection). This file refers
//     to them as if they were ambient globals.
// =============================================================================

const vscode = acquireVsCodeApi();

// =============================================================================
// §2  Configuration constants
// =============================================================================

const STEP_NUMS = {
  '00_secretary':   '00',
  '01_manager':     '01',
  '02_researcher':  '02',
  '03_slide_agent': '03',
  '04_boss':        '04',
  '05_designer':    '05',
};

// Character head SVGs — used in header avatar, chat bubbles, empty state
const CHARACTER_SVGS = {
  '00_secretary': `<svg viewBox="22 14 76 76" xmlns="http://www.w3.org/2000/svg">
    <path d="M30,98 L48,86 L72,86 L90,98 L92,150 L28,150 Z" fill="#a78bfa"/>
    <path d="M48,86 L60,103 L72,86 L66,86 L60,96 L54,86 Z" fill="white"/>
    <path d="M52,103 L60,98 L68,103 L66,109 L60,107 L54,109 Z" fill="#fbbf24"/>
    <circle cx="60" cy="103" r="2" fill="#f59e0b"/>
    <rect x="55" y="76" width="10" height="14" fill="#fcd9a8"/>
    <circle cx="60" cy="55" r="26" fill="#fcd9a8" stroke="#a16e3f" stroke-width="0.5"/>
    <path d="M34,52 Q34,28 60,26 Q86,28 86,52 Q82,38 76,34 Q68,30 60,30 Q52,30 44,34 Q38,38 34,52 Z" fill="#451a03"/>
    <ellipse cx="60" cy="22" rx="11" ry="7" fill="#451a03"/>
    <ellipse cx="60" cy="20" rx="11" ry="6" fill="#5b1f06"/>
    <circle cx="68" cy="22" r="2" fill="#fbbf24"/>
    <path d="M32,40 Q60,16 88,40" stroke="#1f2937" stroke-width="2.5" fill="none"/>
    <ellipse cx="32" cy="44" rx="3" ry="5" fill="#1f2937"/>
    <ellipse cx="88" cy="44" rx="3" ry="5" fill="#1f2937"/>
    <circle cx="32" cy="44" r="1.5" fill="#a78bfa"/>
    <circle cx="88" cy="44" r="1.5" fill="#a78bfa"/>
    <path d="M88,48 Q92,55 86,68" stroke="#1f2937" stroke-width="1.5" fill="none"/>
    <circle cx="86" cy="68" r="2.5" fill="#1f2937"/>
    <circle cx="86" cy="68" r="1" fill="#fb7185"/>
    <circle cx="50" cy="55" r="6" stroke="#1f2937" stroke-width="1.2" fill="rgba(255,255,255,0.5)"/>
    <circle cx="70" cy="55" r="6" stroke="#1f2937" stroke-width="1.2" fill="rgba(255,255,255,0.5)"/>
    <line x1="56" y1="55" x2="64" y2="55" stroke="#1f2937" stroke-width="1.2"/>
    <path d="M47,55 Q50,58 53,55" stroke="#1f2937" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M67,55 Q70,58 73,55" stroke="#1f2937" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M52,68 Q60,74 68,68" stroke="#dc2626" stroke-width="2" fill="#fb7185" stroke-linecap="round"/>
    <ellipse cx="40" cy="65" rx="3.5" ry="2.5" fill="#fb7185" opacity="0.4"/>
    <ellipse cx="80" cy="65" rx="3.5" ry="2.5" fill="#fb7185" opacity="0.4"/>
    <circle cx="34" cy="62" r="1.5" fill="#fbbf24"/>
    <circle cx="86" cy="62" r="1.5" fill="#fbbf24"/>
  </svg>`,
  '01_manager': `<svg viewBox="22 14 76 76" xmlns="http://www.w3.org/2000/svg">
    <path d="M32,98 L48,86 L72,86 L88,98 L92,150 L28,150 Z" fill="#475569"/>
    <path d="M48,86 L60,100 L52,120 L42,108 Z" fill="#334155"/>
    <path d="M72,86 L60,100 L68,120 L78,108 Z" fill="#334155"/>
    <path d="M55,86 L65,86 L60,102 Z" fill="white"/>
    <rect x="55" y="76" width="10" height="14" fill="#fcd9a8"/>
    <circle cx="60" cy="55" r="26" fill="#fcd9a8" stroke="#a16e3f" stroke-width="0.5"/>
    <path d="M34,52 Q34,30 60,28 Q86,30 86,52 Q86,42 78,38 Q72,32 60,32 Q48,32 42,38 Q34,42 34,52 Z" fill="#1f2937"/>
    <ellipse cx="36" cy="55" rx="3" ry="6" fill="#1f2937"/>
    <ellipse cx="84" cy="55" rx="3" ry="6" fill="#1f2937"/>
    <circle cx="50" cy="55" r="6.5" stroke="#1f2937" stroke-width="1.5" fill="rgba(255,255,255,0.6)"/>
    <circle cx="70" cy="55" r="6.5" stroke="#1f2937" stroke-width="1.5" fill="rgba(255,255,255,0.6)"/>
    <line x1="56.5" y1="55" x2="63.5" y2="55" stroke="#1f2937" stroke-width="1.5"/>
    <circle cx="50" cy="56" r="1.5" fill="#1f2937"/>
    <circle cx="70" cy="56" r="1.5" fill="#1f2937"/>
    <path d="M44,46 L55,45" stroke="#1f2937" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M65,45 L76,46" stroke="#1f2937" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M52,67 Q56,69 60,68 Q64,69 68,67" stroke="#1f2937" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <path d="M55,73 L65,73" stroke="#1f2937" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
  '02_researcher': `<svg viewBox="22 14 76 76" xmlns="http://www.w3.org/2000/svg">
    <path d="M30,98 L50,86 L70,86 L90,98 L94,150 L26,150 Z" fill="#f9fafb" stroke="#d1d5db" stroke-width="1"/>
    <path d="M50,86 L70,86 L65,100 L55,100 Z" fill="#34d399"/>
    <rect x="55" y="76" width="10" height="14" fill="#fcd9a8"/>
    <circle cx="60" cy="55" r="26" fill="#fcd9a8" stroke="#a16e3f" stroke-width="0.5"/>
    <path d="M34,50 Q34,28 60,26 Q86,28 86,50 Q82,38 74,34 Q68,30 60,30 Q52,30 46,34 Q38,38 34,50 Z" fill="#7c2d12"/>
    <circle cx="40" cy="42" r="4" fill="#7c2d12"/>
    <circle cx="80" cy="42" r="4" fill="#7c2d12"/>
    <circle cx="50" cy="55" r="7" stroke="#1f2937" stroke-width="1.5" fill="rgba(255,255,255,0.5)"/>
    <circle cx="70" cy="55" r="7" stroke="#1f2937" stroke-width="1.5" fill="rgba(255,255,255,0.5)"/>
    <line x1="57" y1="55" x2="63" y2="55" stroke="#1f2937" stroke-width="1.5"/>
    <circle cx="50" cy="55" r="2" fill="#1f2937"/>
    <circle cx="70" cy="55" r="2" fill="#1f2937"/>
    <circle cx="50.5" cy="54.5" r="0.7" fill="white"/>
    <circle cx="70.5" cy="54.5" r="0.7" fill="white"/>
    <path d="M54,69 Q60,73 66,69" stroke="#1f2937" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  </svg>`,
  '03_slide_agent': `<svg viewBox="22 14 76 76" xmlns="http://www.w3.org/2000/svg">
    <path d="M32,98 L48,86 L72,86 L88,98 L90,150 L30,150 Z" fill="#38bdf8"/>
    <path d="M52,86 L60,93 L68,86" fill="white" stroke="#e0f2fe" stroke-width="1"/>
    <rect x="55" y="76" width="10" height="14" fill="#fcd9a8"/>
    <circle cx="60" cy="55" r="26" fill="#fcd9a8" stroke="#a16e3f" stroke-width="0.5"/>
    <path d="M36,50 Q40,28 60,26 Q82,28 84,52 Q82,40 76,38 L66,42 L58,38 Q44,38 38,46 Q34,46 36,50 Z" fill="#3a2218"/>
    <ellipse cx="50" cy="56" rx="2" ry="1.5" fill="#1f2937"/>
    <ellipse cx="70" cy="56" rx="2" ry="1.5" fill="#1f2937"/>
    <path d="M44,49 L55,48" stroke="#3a2218" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M65,48 L76,49" stroke="#3a2218" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M55,69 Q60,71 65,69" stroke="#1f2937" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <rect x="83" y="50" width="14" height="3" fill="#fbbf24" transform="rotate(-25 90 51)"/>
    <polygon points="83,50 79,51.5 83,53" fill="#1f2937" transform="rotate(-25 90 51)"/>
  </svg>`,
  '04_boss': `<svg viewBox="22 14 76 76" xmlns="http://www.w3.org/2000/svg">
    <path d="M30,98 L48,84 L72,84 L90,98 L94,150 L26,150 Z" fill="#1e1b3a"/>
    <path d="M48,84 L60,100 L50,124 L40,108 Z" fill="#0f0e21"/>
    <path d="M72,84 L60,100 L70,124 L80,108 Z" fill="#0f0e21"/>
    <path d="M55,84 L65,84 L60,102 Z" fill="#e5e7eb"/>
    <rect x="55" y="74" width="10" height="14" fill="#e8b890"/>
    <circle cx="60" cy="53" r="26" fill="#e8b890" stroke="#8b6240" stroke-width="0.5"/>
    <path d="M34,48 Q36,28 60,26 Q84,28 86,48 Q86,40 80,36 Q70,30 60,30 Q50,30 40,36 Q34,40 34,48 Z" fill="#52525b"/>
    <ellipse cx="36" cy="50" rx="3" ry="6" fill="#a1a1aa"/>
    <ellipse cx="84" cy="50" rx="3" ry="6" fill="#a1a1aa"/>
    <rect x="42" y="50" width="14" height="9" stroke="#1f2937" stroke-width="1.5" fill="rgba(255,255,255,0.5)" rx="1"/>
    <rect x="64" y="50" width="14" height="9" stroke="#1f2937" stroke-width="1.5" fill="rgba(255,255,255,0.5)" rx="1"/>
    <line x1="56" y1="54.5" x2="64" y2="54.5" stroke="#1f2937" stroke-width="1.5"/>
    <line x1="46" y1="55" x2="52" y2="55" stroke="#1f2937" stroke-width="2" stroke-linecap="round"/>
    <line x1="68" y1="55" x2="74" y2="55" stroke="#1f2937" stroke-width="2" stroke-linecap="round"/>
    <path d="M42,46 L54,44" stroke="#3f3f46" stroke-width="2" stroke-linecap="round"/>
    <path d="M66,44 L78,46" stroke="#3f3f46" stroke-width="2" stroke-linecap="round"/>
    <path d="M52,71 L68,71" stroke="#1f2937" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`,
  '05_designer': `<svg viewBox="22 14 76 76" xmlns="http://www.w3.org/2000/svg">
    <path d="M30,100 L48,86 L72,86 L90,100 L88,150 L32,150 Z" fill="#1f1f23"/>
    <path d="M50,86 L60,103 L70,86 L65,86 L60,96 L55,86 Z" fill="#fef3c7"/>
    <rect x="55" y="76" width="10" height="14" fill="#fcd9a8"/>
    <circle cx="60" cy="55" r="26" fill="#fcd9a8" stroke="#a16e3f" stroke-width="0.5"/>
    <path d="M34,52 Q30,80 36,95 L42,90 L40,72 Q38,60 38,52 Z" fill="#451a03"/>
    <path d="M86,52 Q90,80 84,95 L78,90 L80,72 Q82,60 82,52 Z" fill="#451a03"/>
    <path d="M34,46 Q34,28 60,26 Q86,28 86,46 Q86,38 80,34 Q70,28 60,28 Q50,28 40,34 Q34,38 34,46 Z" fill="#451a03"/>
    <ellipse cx="60" cy="30" rx="22" ry="8" fill="#f472b6"/>
    <ellipse cx="60" cy="28" rx="22" ry="8" fill="#ec4899"/>
    <circle cx="74" cy="26" r="3" fill="#9d174d"/>
    <circle cx="50" cy="55" r="9" stroke="#1f2937" stroke-width="1.8" fill="rgba(255,255,255,0.4)"/>
    <circle cx="70" cy="55" r="9" stroke="#1f2937" stroke-width="1.8" fill="rgba(255,255,255,0.4)"/>
    <line x1="59" y1="55" x2="61" y2="55" stroke="#1f2937" stroke-width="1.8"/>
    <circle cx="50" cy="55" r="2" fill="#1f2937"/>
    <circle cx="70" cy="55" r="2" fill="#1f2937"/>
    <circle cx="50.5" cy="54" r="0.8" fill="white"/>
    <circle cx="70.5" cy="54" r="0.8" fill="white"/>
    <path d="M54,70 Q60,75 66,70" stroke="#dc2626" stroke-width="2" fill="#fb7185" stroke-linecap="round"/>
    <circle cx="34" cy="58" r="1.5" fill="#f472b6"/>
    <circle cx="86" cy="58" r="1.5" fill="#f472b6"/>
  </svg>`,
};

const THINKING_VERBS = {
  '01_manager': ['검토 중', '곰곰이 보는 중', '출처 따져보는 중', '약점 찾는 중', '질문 정리 중', '한 번 더 보는 중', '근거 확인 중'],
  '02_researcher': ['검색 중', '자료 모으는 중', '출처 확인 중', '수치 정리 중', '경쟁사 비교 중', '시장 자료 찾는 중', '인용 다듬는 중'],
  '03_slide_agent': ['구조 잡는 중', '메시지 다듬는 중', '명제 만드는 중', '슬라이드 정렬 중', '스토리라인 짜는 중'],
  '04_boss': ['한숨 쉬는 중', '지적할 거 찾는 중', '빈틈 찾는 중', '깊이 보는 중', '검토 중', '전제 의심 중'],
  '05_designer': ['톤 잡는 중', '레퍼런스 보는 중', '팔레트 고르는 중', '방향 잡는 중', '시각 흐름 짜는 중'],
};
const SPARKLES = ['✦', '✧', '✶', '✱', '✺'];

// UI mode taxonomies
const COMPOSER_MODES = ['chat-summary', 'critique-finaldraft', 'plan-rerequest-finaldraft', 'result-rerequest-rightcopy', 'secretary-chat'];
const RIGHT_DRAFT_MODES = ['chat-summary', 'critique-finaldraft', 'plan-rerequest-finaldraft'];
const RIGHT_LASTRESULT_MODES = ['result-rerequest-rightcopy'];
const RIGHT_NOTES_MODES = ['editable-md-notes'];
const SECRETARY_MODE = 'secretary-chat';
const CUMULATIVE_MODES = ['chat-summary', 'critique-finaldraft', 'plan-rerequest-finaldraft', 'result-rerequest-rightcopy'];

const PALETTE_RE = /\[PALETTE(?:\s+group="([^"]*)")?\]\s*\n([\s\S]*?)\n?\[\/PALETTE\]/g;

// =============================================================================
// §3  App state — single source of mutable runtime state
//
// All `let` module-level state lives in this object. Helpers read/mutate via
// App.<key>. The object reference is stable; only fields change.
// =============================================================================

const App = {
  // Static (immutable from webview perspective) — derived from server-injected
  agent: AGENT,
  mode: AGENT.uiMode,
  isBoss: AGENT.id === '04_boss',
  isSlideAgent: AGENT.id === '03_slide_agent',
  isCumulative: CUMULATIVE_MODES.includes(AGENT.uiMode),

  // Conversation history (mutable — appended on user/assistant turns)
  history: HISTORY,

  // UI runtime
  activeMainMode: 'chat',
  activeRightMode: '',
  pinPulseShown: false,
  thinkingInterval: null,
  thinkingVerbIdx: 0,

  // Non-blocking composer: input stays enabled during inference.
  // Messages sent while busy are queued and auto-flushed when the turn ends.
  // The server only ever processes one turn at a time (no concurrent calls).
  isBusy: false,
  pendingQueue: [], // [{ text, attachments, displayText }]

  // Boss 2-pane runtime
  bossReviewLog: (RIGHT_STATE && RIGHT_STATE.reviewLog) || [],
  bossWorkCopy: (RIGHT_STATE && RIGHT_STATE.workCopy) || PREV || '',
  bossRecentChanges: (RIGHT_STATE && RIGHT_STATE.recentChanges) || null,
  bossActiveTab: 'work',
  bossWorkEditMode: false,

  // Slide agent runtime
  slideEditMode: false,

  // File upload runtime (lazy)
  fileUpload: null,
};

// Compute active right mode based on agent + mode
if (App.mode === SECRETARY_MODE) App.activeRightMode = 'secretary';
else if (App.isBoss) App.activeRightMode = 'boss-2pane';
else if (RIGHT_DRAFT_MODES.includes(App.mode)) App.activeRightMode = 'draft';
else if (RIGHT_LASTRESULT_MODES.includes(App.mode)) App.activeRightMode = 'lastresult';
else if (RIGHT_NOTES_MODES.includes(App.mode)) App.activeRightMode = 'notes';

// Compute active main mode
if (App.mode === 'editable-md-notes') App.activeMainMode = 'edit';
else if (App.mode === 'result-rerequest-rightcopy') App.activeMainMode = 'research';
else App.activeMainMode = 'chat';

// =============================================================================
// §4  DOM cache — populated at bootstrap (§17)
// =============================================================================

const DOM = {};

function cacheDOM() {
  DOM.chat = document.getElementById('chat');
  DOM.sendBtn = document.getElementById('send-btn');
  DOM.statusBar = document.getElementById('status-bar');
  DOM.openFileBtn = document.getElementById('open-file-btn');
  DOM.composer = document.getElementById('composer');
  DOM.finalizeBtn = document.getElementById('finalize-btn');
  DOM.primaryBtn = document.getElementById('primary-btn');
  DOM.rightContent = document.getElementById('right-content');
  DOM.mainGrid = document.getElementById('main-grid');
  DOM.rightAction = document.getElementById('right-action');
  DOM.inputEl = document.getElementById('input');
  DOM.avatarBig = document.getElementById('avatar-big');
  DOM.pendingQueue = document.getElementById('pending-queue');
}

// =============================================================================
// §5  API — wrappers around vscode.postMessage (intent-named)
// =============================================================================

const API = {
  sendChat: (text, attachments) => vscode.postMessage({ type: 'chat', text, attachments }),
  finalize: () => vscode.postMessage({ type: 'finalize' }),
  reviewLast: () => vscode.postMessage({ type: 'reviewLast' }),
  transferToNext: (payload) => vscode.postMessage({ type: 'transferToNext', payload }),
  updateRightState: (state) => vscode.postMessage({ type: 'updateRightState', state }),
  pinReviewLog: (content) => vscode.postMessage({ type: 'pinReviewLog', content }),
  applyReviewLogEntry: (entryId) => vscode.postMessage({ type: 'applyReviewLogEntry', entryId }),
  unapplyReviewLogEntry: (entryId) => vscode.postMessage({ type: 'unapplyReviewLogEntry', entryId }),
  deleteReviewLogEntry: (entryId) => vscode.postMessage({ type: 'deleteReviewLogEntry', entryId }),
  dismissChangeIndicators: () => vscode.postMessage({ type: 'dismissChangeIndicators' }),
  openFile: () => vscode.postMessage({ type: 'openFile' }),
  selectFolder: () => vscode.postMessage({ type: 'selectFolder' }),
};

// =============================================================================
// §6  Utilities
// =============================================================================

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function getContrastInk(hex) {
  if (!hex || hex.length < 4) return '#1d1d1f';
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length === 8) h = h.slice(0, 6);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#1d1d1f' : '#ffffff';
}

// =============================================================================
// §7  Parsers
// =============================================================================

// Split text into segments of plain text and [PALETTE] blocks
function parsePaletteBlocks(text) {
  if (!text || text.indexOf('[PALETTE') < 0) return { hasBlocks: false, segments: [{ type: 'text', text }] };
  const segments = [];
  let lastIdx = 0;
  let m;
  PALETTE_RE.lastIndex = 0;
  while ((m = PALETTE_RE.exec(text)) !== null) {
    if (m.index > lastIdx) segments.push({ type: 'text', text: text.slice(lastIdx, m.index) });
    const group = (m[1] || '').trim();
    const body = m[2] || '';
    const swatches = body.split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('//'))
      .map((line) => {
        const parts = line.split('|').map((p) => p.trim());
        if (parts.length < 2) return null;
        const name = parts[0];
        const hex = parts[1].startsWith('#') ? parts[1] : ('#' + parts[1]);
        const desc = parts[2] || '';
        if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(hex)) return null;
        return { name, hex, desc };
      })
      .filter(Boolean);
    if (swatches.length > 0) segments.push({ type: 'palette', group, swatches });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) segments.push({ type: 'text', text: text.slice(lastIdx) });
  return { hasBlocks: true, segments };
}

function detectSlideNumberFromContent(content) {
  if (!content) return null;
  const m = String(content).match(/✅\s*\*\*슬라이드\s+(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

// Parse cumulative slide markdown into { toc: [{n,title,msg}], slides: {n: body} }.
// Last occurrence wins for both TOC and slide N.
function parseSlideMd(text) {
  const out = { toc: [], slides: {} };
  if (!text || !text.trim()) return out;

  // Last "✅ **목차 ..." block (ends at next "---" or next ✅ ** or EOF)
  const tocStartRe = /✅\s*\*\*목차[^\n]*\*\*/g;
  let lastTocStart = -1;
  let m;
  while ((m = tocStartRe.exec(text)) !== null) lastTocStart = m.index;
  if (lastTocStart >= 0) {
    const after = text.slice(lastTocStart);
    const endMatch = after.match(/\n---\n|\n✅\s*\*\*/);
    const tocBlock = endMatch ? after.slice(0, endMatch.index) : after;
    // Rows: | N | title | message | (further columns ignored)
    const rowRe = /^\|\s*(\d+)\s*\|\s*([^|\n]+?)\s*\|\s*([^|\n]*?)\s*\|/gm;
    let r;
    while ((r = rowRe.exec(tocBlock)) !== null) {
      const n = parseInt(r[1], 10);
      const title = r[2].trim();
      const msg = (r[3] || '').trim().replace(/^["“]|["”]$/g, '');
      if (!isNaN(n) && title) out.toc.push({ n, title, msg });
    }
  }

  // Each slide body — later occurrences overwrite earlier
  const slideRe = /✅\s*\*\*슬라이드\s+(\d+)\s*[::][^*]*\*\*([\s\S]*?)(?=\n---\n|\n✅\s*\*\*|$)/g;
  let s;
  while ((s = slideRe.exec(text)) !== null) {
    const n = parseInt(s[1], 10);
    const body = s[2].replace(/^\s+|\s+$/g, '');
    if (!isNaN(n)) out.slides[n] = body;
  }
  return out;
}

// =============================================================================
// §8  UI — thinking indicator (cycling verbs)
// =============================================================================

function getThinkingHost() {
  if (App.mode === 'result-rerequest-rightcopy') return document.getElementById('research-result');
  return DOM.chat;
}

function showThinking() {
  hideThinking();
  const host = getThinkingHost();
  if (!host) return;

  const empty = host.querySelector('.empty-state');
  if (empty) host.removeChild(empty);

  const verbs = THINKING_VERBS[App.agent.id] || ['생각 중'];
  App.thinkingVerbIdx = 0;
  const sparkle = SPARKLES[Math.floor(Math.random() * SPARKLES.length)];

  const el = document.createElement('div');
  el.className = 'thinking-bubble';
  el.id = 'thinking-bubble';
  el.innerHTML = `
    <div class="bubble-avatar">${App.agent.emoji}</div>
    <div class="thinking-content">
      <span class="thinking-sparkle">${sparkle}</span>
      <span class="thinking-verb">${verbs[0]}</span><span class="thinking-dots"></span>
    </div>
  `;
  host.appendChild(el);
  el.scrollIntoView({ behavior: 'smooth', block: 'end' });

  App.thinkingInterval = setInterval(() => {
    const verbEl = el.querySelector('.thinking-verb');
    if (!verbEl) return;
    verbEl.classList.add('fading');
    setTimeout(() => {
      App.thinkingVerbIdx = (App.thinkingVerbIdx + 1) % verbs.length;
      verbEl.textContent = verbs[App.thinkingVerbIdx];
      verbEl.classList.remove('fading');
    }, 200);
  }, 2200);
}

function hideThinking() {
  const el = document.getElementById('thinking-bubble');
  if (el) el.remove();
  if (App.thinkingInterval) {
    clearInterval(App.thinkingInterval);
    App.thinkingInterval = null;
  }
}

// =============================================================================
// §9  UI — status bar + busy state
// =============================================================================

function setStatus(text, isError = false) {
  if (!DOM.statusBar) return;
  if (!text) { DOM.statusBar.classList.add('hidden'); return; }
  DOM.statusBar.classList.remove('hidden');
  DOM.statusBar.classList.toggle('error', isError);
  DOM.statusBar.innerHTML = isError ? `⚠ ${text}` : `<div class="spinner"></div>${text}`;
}

function setBusy(busy) {
  App.isBusy = busy;
  // Input + send stay enabled at all times — typing/sending while busy enqueues.
  if (DOM.inputEl) DOM.inputEl.disabled = false;
  if (DOM.sendBtn) {
    DOM.sendBtn.disabled = false;
    DOM.sendBtn.textContent = busy ? '예약' : '전송';
  }
  // Finalize / next-step stay locked during a turn (they need a settled history).
  if (DOM.finalizeBtn) DOM.finalizeBtn.disabled = busy;
  if (DOM.primaryBtn) DOM.primaryBtn.disabled = busy;
  if (!busy) flushQueue();
}

function showRightPanel() { DOM.mainGrid.classList.add('right-visible'); }

// =============================================================================
// §10 UI — chat bubble (with palette + pin button + first-✅ pulse)
// =============================================================================

function decoratePinForFirstCheckmark(btn, content) {
  if (App.pinPulseShown) return;
  if (!/✅/.test(String(content || ''))) return;
  btn.classList.add('pulse-once');
  App.pinPulseShown = true;
  const stop = () => btn.classList.remove('pulse-once');
  btn.addEventListener('click', stop, { once: true });
  setTimeout(stop, 6000);
}

function renderPaletteBlock(group, swatches) {
  const wrap = document.createElement('div');
  wrap.className = 'palette-block';
  if (group) {
    const h = document.createElement('div');
    h.className = 'palette-group-title';
    h.textContent = group;
    wrap.appendChild(h);
  }
  const grid = document.createElement('div');
  grid.className = 'palette-grid';
  for (const s of swatches) {
    const card = document.createElement('div');
    card.className = 'palette-card';
    const swatch = document.createElement('div');
    swatch.className = 'palette-swatch';
    swatch.style.background = s.hex;
    swatch.style.color = getContrastInk(s.hex);
    swatch.title = `${s.name} — ${s.hex}\n클릭하면 HEX 복사`;
    swatch.addEventListener('click', () => {
      try {
        navigator.clipboard.writeText(s.hex);
        swatch.classList.add('copied');
        setTimeout(() => swatch.classList.remove('copied'), 700);
      } catch {}
    });
    const meta = document.createElement('div');
    meta.className = 'palette-meta';
    const name = document.createElement('div');
    name.className = 'palette-name';
    name.textContent = s.name;
    const hex = document.createElement('div');
    hex.className = 'palette-hex';
    hex.textContent = s.hex;
    meta.appendChild(name);
    meta.appendChild(hex);
    if (s.desc) {
      const desc = document.createElement('div');
      desc.className = 'palette-desc';
      desc.textContent = s.desc;
      meta.appendChild(desc);
    }
    card.appendChild(swatch);
    card.appendChild(meta);
    grid.appendChild(card);
  }
  wrap.appendChild(grid);
  return wrap;
}

function addBubble(role, content, animate = true) {
  const empty = DOM.chat.querySelector('.empty-state');
  if (empty) DOM.chat.removeChild(empty);

  const el = document.createElement('div');
  el.className = 'bubble ' + role;
  const avatarHtml = role === 'user' ? '🙂' : (CHARACTER_SVGS[App.agent.id] || App.agent.emoji);
  const avatarClass = role === 'assistant' && CHARACTER_SVGS[App.agent.id] ? 'has-svg' : '';
  el.innerHTML = `<div class="bubble-avatar ${avatarClass}">${avatarHtml}</div><div class="bubble-content"></div>`;
  const contentEl = el.querySelector('.bubble-content');

  // Parse [PALETTE] blocks for assistant messages
  if (role === 'assistant') {
    const parsed = parsePaletteBlocks(content);
    if (parsed.hasBlocks) {
      for (const seg of parsed.segments) {
        if (seg.type === 'text') {
          if (seg.text.trim()) {
            const t = document.createElement('div');
            t.className = 'bubble-text-seg';
            t.textContent = seg.text;
            contentEl.appendChild(t);
          }
        } else {
          contentEl.appendChild(renderPaletteBlock(seg.group, seg.swatches));
        }
      }
    } else {
      contentEl.textContent = content;
    }
  } else {
    contentEl.textContent = content;
  }

  // 📌 button on assistant bubbles in cumulative modes
  if (role === 'assistant' && App.isCumulative) {
    const btn = document.createElement('button');
    btn.className = 'pin-add-btn';
    if (App.isBoss) {
      btn.innerHTML = '📌 검토 로그에 추가';
      btn.title = '이 검토 의견을 검토 로그에 추가 (작업본은 따로 ✓ 작업본 반영 누를 때 갱신)';
      btn.addEventListener('click', () => pinToReviewLog(content));
    } else {
      btn.innerHTML = '📌 우측 추가';
      btn.title = '이 메시지 내용을 우측 정리본에 누적';
      btn.addEventListener('click', () => appendToRightPanel(content));
    }
    decoratePinForFirstCheckmark(btn, content);
    contentEl.appendChild(btn);
  }

  DOM.chat.appendChild(el);
  if (animate) el.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function appendToRightPanel(content) {
  const editorId = App.activeRightMode === 'lastresult' ? 'right-editor-research' : 'right-editor';
  const editor = document.getElementById(editorId);
  if (!editor) return;
  const current = editor.value || '';
  const sep = current.trim() ? '\n\n---\n\n' : '';
  editor.value = current + sep + content;
  editor.scrollTop = editor.scrollHeight;
  const stateUpdate = App.activeRightMode === 'lastresult' ? { lastResult: editor.value } : { draft: editor.value };
  API.updateRightState(stateUpdate);
  editor.classList.add('flash-update');
  setTimeout(() => editor.classList.remove('flash-update'), 600);
  // Slide agent: re-render accordion auto-opening just-pinned slide
  if (App.isSlideAgent && App.activeRightMode === 'draft') {
    const justPinned = detectSlideNumberFromContent(content);
    renderSlideAgentAccordion({ openSlide: justPinned, openTOC: !justPinned });
  }
}

// =============================================================================
// §11 UI — research cards (researcher uses card list, not chat bubbles)
// =============================================================================

function buildResearchAssistantCard(content, label) {
  const card = document.createElement('div');
  card.className = 'research-card';
  const meta = document.createElement('div');
  meta.className = 'research-card-meta';
  meta.textContent = label || '리서치 결과';
  card.appendChild(meta);
  const txt = document.createElement('div');
  txt.className = 'research-card-body';
  txt.textContent = content;
  card.appendChild(txt);
  if (App.isCumulative) {
    const btn = document.createElement('button');
    btn.className = 'pin-add-btn';
    btn.innerHTML = '📌 우측 추가';
    btn.title = '이 카드 내용을 우측 정리본에 누적';
    btn.addEventListener('click', () => appendToRightPanel(content));
    decoratePinForFirstCheckmark(btn, content);
    card.appendChild(btn);
  }
  return card;
}

function renderEmptyStateInHost(host) {
  const headSvg = CHARACTER_SVGS[App.agent.id];
  const mark = headSvg
    ? `<div class="empty-state-svg">${headSvg}</div>`
    : `<div class="emoji-big-static">${App.agent.emoji}</div>`;
  host.innerHTML = `
    <div class="empty-state">
      ${mark}
      <div class="empty-state-greeting">${App.agent.label} 준비 완료</div>
      <div class="empty-state-sub">${App.agent.greeting}</div>
    </div>`;
}

function renderResearchHistory() {
  const resultEl = document.getElementById('research-result');
  resultEl.innerHTML = '';
  if (App.history.length === 0) {
    renderEmptyStateInHost(resultEl);
    return;
  }
  let i = 1;
  for (const msg of App.history) {
    if (msg.role === 'user') {
      const userEl = document.createElement('div');
      userEl.className = 'research-card';
      userEl.style.borderLeftColor = '#cbd5e1';
      userEl.innerHTML = `<div class="research-card-meta">사용자 요청 #${i}</div>`;
      const txt = document.createElement('div');
      txt.textContent = msg.content;
      userEl.appendChild(txt);
      resultEl.appendChild(userEl);
    } else {
      resultEl.appendChild(buildResearchAssistantCard(msg.content, `리서치 결과 #${i}`));
      i++;
    }
  }
  resultEl.scrollTop = resultEl.scrollHeight;
}

function renderHistory() {
  if (App.mode === 'result-rerequest-rightcopy') return renderResearchHistory();
  if (App.mode === 'editable-md-notes') return;
  DOM.chat.innerHTML = '';
  if (App.history.length === 0) {
    renderEmptyStateInHost(DOM.chat);
    return;
  }
  for (const msg of App.history) addBubble(msg.role, msg.content, false);
}

// =============================================================================
// §12 UI — accordion (shared by slide agent + boss work copy)
//
// renderAccordion(host, sourceText, opts):
//   opts.openSlide?     — number, auto-open this slide
//   opts.changes?       — { modified, added, removed, renamed, entrySnippet }
//   opts.onDismissChanges?  — callback when user clicks ✕ on change pill
//   opts.emptyState?    — { emoji, title, sub } for empty state
//   opts.progressLabel? — "진행" or "슬라이드" (defaults to "진행")
// =============================================================================

const DEFAULT_EMPTY = {
  emoji: '📑',
  title: '먼저 목차부터 합의해요',
  sub: '에이스 팀원과 슬라이드 목차 합의 → ✅ 정리에 📌 추가하면 여기에 슬라이드 뼈대가 생겨요. 그 다음 1번부터 한 장씩 채워가요.',
};

function renderAccordion(host, sourceText, opts) {
  opts = opts || {};
  if (!host) return;
  const { toc, slides } = parseSlideMd(sourceText || '');
  host.innerHTML = '';

  if (toc.length === 0 && Object.keys(slides).length === 0) {
    const empty = opts.emptyState || DEFAULT_EMPTY;
    host.innerHTML = `
      <div class="accordion-empty">
        <div class="accordion-empty-emoji">${empty.emoji}</div>
        <div class="accordion-empty-title">${empty.title}</div>
        <div class="accordion-empty-sub">${empty.sub}</div>
      </div>`;
    return;
  }

  // Build ordered items list — prefer TOC order, append orphans
  let items;
  if (toc.length > 0) {
    items = toc.map((t) => ({ n: t.n, title: t.title, msg: t.msg, body: slides[t.n] || '' }));
    const inToc = new Set(toc.map((t) => t.n));
    Object.keys(slides).map(Number).filter((n) => !inToc.has(n)).sort((a, b) => a - b)
      .forEach((n) => items.push({ n, title: '(목차 외)', msg: '', body: slides[n] }));
  } else {
    items = Object.keys(slides).map(Number).sort((a, b) => a - b)
      .map((n) => ({ n, title: '슬라이드 ' + n, msg: '', body: slides[n] }));
  }

  const filled = items.filter((i) => i.body).length;
  const progressLabel = opts.progressLabel || '진행';

  // Change indicator sets (boss only)
  const ch = opts.changes || {};
  const modSet = new Set(ch.modified || []);
  const addSet = new Set(ch.added || []);
  const renSet = new Set(ch.renamed || []);
  const removed = ch.removed || [];
  const totalChanges = (ch.modified || []).length + (ch.added || []).length + (ch.renamed || []).length + (ch.removed || []).length;

  // Accordion head — progress + optional change pill + expand/collapse
  const head = document.createElement('div');
  head.className = 'accordion-head';
  let headHtml = `<span class="accordion-progress">${progressLabel}: <b>${filled}</b> / ${items.length}장</span>`;
  if (totalChanges > 0) {
    const summary = [];
    if ((ch.modified || []).length) summary.push(`${ch.modified.length}장 수정`);
    if ((ch.added || []).length) summary.push(`${ch.added.length}장 추가`);
    if ((ch.removed || []).length) summary.push(`${ch.removed.length}장 삭제`);
    if ((ch.renamed || []).length) summary.push(`${ch.renamed.length}장 제목변경`);
    headHtml += `<span class="change-pill" title="${escapeHtml(ch.entrySnippet || '')}">🟣 방금 ${summary.join(' · ')} <button class="change-dismiss" data-action="dismiss-changes" title="변경 표시 지우기">✕</button></span>`;
  }
  headHtml += `<button class="ghost mini" data-action="expand-all">전체 펼치기</button>
    <button class="ghost mini" data-action="collapse-all">전체 접기</button>`;
  head.innerHTML = headHtml;
  host.appendChild(head);

  // Removed slides notice
  if (removed.length > 0) {
    const rmNotice = document.createElement('div');
    rmNotice.className = 'removed-slides-notice';
    rmNotice.innerHTML = `🗑️ 삭제된 슬라이드: ${removed.map((n) => `<b>${n}번</b>`).join(', ')}`;
    host.appendChild(rmNotice);
  }

  // Items
  for (const it of items) {
    const det = document.createElement('details');
    let cls = 'slide-section' + (it.body ? ' has-body' : ' no-body');
    let changeBadge = '';
    if (addSet.has(it.n)) {
      cls += ' just-added';
      changeBadge = '<span class="change-badge added">➕ 추가됨</span>';
      det.open = true;
    } else if (modSet.has(it.n)) {
      cls += ' just-modified';
      changeBadge = '<span class="change-badge modified">✏️ 수정됨</span>';
      det.open = true;
    } else if (renSet.has(it.n)) {
      cls += ' just-renamed';
      changeBadge = '<span class="change-badge renamed">📝 제목변경</span>';
    }
    if (opts.openSlide && it.n === opts.openSlide) det.open = true;

    det.className = cls;
    det.dataset.slideN = String(it.n);
    const sum = document.createElement('summary');
    sum.className = 'slide-section-title';
    const status = it.body ? '✅' : '○';
    sum.innerHTML = `<span class="ss-status">${status}</span>` +
      `<span class="ss-num">${it.n}.</span>` +
      `<span class="ss-title">${escapeHtml(it.title)}</span>` +
      (it.msg ? `<span class="ss-msg">— ${escapeHtml(it.msg)}</span>` : '') +
      changeBadge;
    det.appendChild(sum);

    const body = document.createElement('div');
    body.className = 'slide-section-body';
    if (it.body) {
      const pre = document.createElement('pre');
      pre.className = 'slide-body-pre';
      pre.textContent = it.body;
      body.appendChild(pre);
    } else {
      body.innerHTML = `<div class="slide-pending">${opts.pendingMessage || '아직 작성 안 됨'}</div>`;
    }
    det.appendChild(body);
    host.appendChild(det);
  }

  // Wire up head actions (event delegation)
  head.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'expand-all') {
      host.querySelectorAll('details.slide-section').forEach((d) => (d.open = true));
    } else if (action === 'collapse-all') {
      host.querySelectorAll('details.slide-section').forEach((d) => (d.open = false));
    } else if (action === 'dismiss-changes') {
      e.stopPropagation();
      if (opts.onDismissChanges) opts.onDismissChanges();
    }
  });

  // Auto-open + flash + scroll for just-pinned slide
  if (opts.openSlide) {
    const target = host.querySelector(`details.slide-section[data-slide-n="${opts.openSlide}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('flash-update');
      setTimeout(() => target.classList.remove('flash-update'), 800);
    }
  } else if (opts.openTOC) {
    host.scrollTop = 0;
  }
}

// === Slide agent accordion (source: right-editor textarea) ===
function renderSlideAgentAccordion(opts) {
  const host = document.getElementById('slide-accordion');
  const editor = document.getElementById('right-editor');
  if (!host || !editor) return;
  renderAccordion(host, editor.value || '', {
    ...(opts || {}),
    pendingMessage: '아직 작성 안 됨 — 에이스 팀원과 협의 후 ✅ 슬라이드 정리에 📌 추가하면 여기 채워져요.',
  });
}

function initSlideAccordion() {
  if (!App.isSlideAgent) return;
  const wrap = document.getElementById('slide-accordion-wrap');
  const editor = document.getElementById('right-editor');
  const toggleBtn = document.getElementById('slide-edit-toggle');
  if (!wrap || !editor || !toggleBtn) return;

  wrap.classList.remove('hidden');
  editor.classList.add('hidden-by-toggle');

  toggleBtn.addEventListener('click', () => {
    App.slideEditMode = !App.slideEditMode;
    if (App.slideEditMode) {
      editor.classList.remove('hidden-by-toggle');
      document.getElementById('slide-accordion').classList.add('hidden');
      toggleBtn.innerHTML = '📋 미리보기로 돌아가기';
    } else {
      editor.classList.add('hidden-by-toggle');
      document.getElementById('slide-accordion').classList.remove('hidden');
      toggleBtn.innerHTML = '📝 직접 편집';
      renderSlideAgentAccordion();
    }
  });

  editor.addEventListener('input', () => {
    if (!App.slideEditMode) renderSlideAgentAccordion();
  });

  renderSlideAgentAccordion();
}

// === Boss work copy accordion (source: App.bossWorkCopy) ===
function renderBossWorkCopyAccordion() {
  const host = document.getElementById('boss-workcopy-accordion');
  if (!host) return;
  renderAccordion(host, App.bossWorkCopy || '', {
    progressLabel: '슬라이드',
    changes: App.bossRecentChanges || {},
    onDismissChanges: () => {
      App.bossRecentChanges = null;
      API.dismissChangeIndicators();
      renderBossWorkCopyAccordion();
    },
    emptyState: {
      emoji: '📋',
      title: '슬라이드 작업본 비어있음',
      sub: '에이스 팀원이 슬라이드 .md를 안 넘겼거나 빈 .md예요. 단일 사용 모드라면 부장님과 대화하면서 슬라이드 자료를 붙여넣고 시작하세요.',
    },
    pendingMessage: '아직 본문 없음',
  });
}

// =============================================================================
// §13 UI — Boss 2-pane (work copy + review log tabs)
// =============================================================================

function pinToReviewLog(content) {
  API.pinReviewLog(content);
  flashLogBadge();
  // Optimistic push (server will broadcast canonical state)
  App.bossReviewLog.push({
    id: 'tmp_' + Date.now(),
    content: String(content || ''),
    applied: false,
    appliedAt: null,
    createdAt: Date.now(),
    pending: true,
  });
  renderReviewLog();
}

function flashLogBadge() {
  const badge = document.getElementById('log-badge');
  if (!badge) return;
  badge.classList.add('flash');
  setTimeout(() => badge.classList.remove('flash'), 600);
}

function setBossTab(tab) {
  App.bossActiveTab = tab;
  document.querySelectorAll('.boss-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.boss-tab-content').forEach((c) => c.classList.toggle('hidden', c.dataset.tab !== tab));
  if (tab === 'work') renderBossWorkCopy();
  else renderReviewLog();
}

function renderReviewLog() {
  const host = document.getElementById('review-log-list');
  const badge = document.getElementById('log-badge');
  if (!host) return;
  if (badge) badge.textContent = String(App.bossReviewLog.length);
  host.innerHTML = '';

  if (App.bossReviewLog.length === 0) {
    host.innerHTML = `
      <div class="log-empty">
        <div class="log-empty-emoji">🔍</div>
        <div class="log-empty-title">아직 검토 로그가 비어있어요</div>
        <div class="log-empty-sub">부장님과 대화하다 ✅ Step 정리 메시지가 뜨면 <b>📌 검토 로그에 추가</b> 누르세요. 추가된 항목마다 ✓ 작업본 반영 버튼이 생깁니다.</div>
      </div>`;
    return;
  }

  App.bossReviewLog.forEach((entry, idx) => {
    const card = document.createElement('div');
    card.className = 'review-log-entry'
      + (entry.applied ? ' applied' : '')
      + (entry.pending ? ' pending' : '');
    card.dataset.entryId = entry.id;

    const head = document.createElement('div');
    head.className = 'rle-head';
    const meta = document.createElement('span');
    meta.className = 'rle-meta';
    meta.textContent = `검토 #${idx + 1}` + (entry.applied ? ' · ✅ 반영됨' : '');
    head.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'rle-actions';
    if (entry.applied) {
      const undo = document.createElement('button');
      undo.className = 'ghost mini';
      undo.textContent = '↺ 반영 표시 해제';
      undo.title = '작업본 자체는 그대로 두고, 이 항목의 반영 표시만 해제';
      undo.addEventListener('click', () => API.unapplyReviewLogEntry(entry.id));
      actions.appendChild(undo);
    } else {
      const apply = document.createElement('button');
      apply.className = 'apply-btn';
      apply.innerHTML = '✓ 작업본 반영';
      apply.title = 'AI가 이 검토 의견을 작업본 슬라이드에 반영 (5-15초 소요)';
      apply.addEventListener('click', () => {
        if (entry.pending) return;
        apply.disabled = true;
        apply.textContent = '반영 중...';
        API.applyReviewLogEntry(entry.id);
      });
      actions.appendChild(apply);
    }
    const del = document.createElement('button');
    del.className = 'ghost mini danger';
    del.textContent = '×';
    del.title = '이 검토 항목 삭제 (작업본은 그대로)';
    del.addEventListener('click', () => {
      if (confirm('이 검토 항목을 삭제할까요? (작업본은 영향 없음)')) {
        API.deleteReviewLogEntry(entry.id);
      }
    });
    actions.appendChild(del);
    head.appendChild(actions);

    const body = document.createElement('div');
    body.className = 'rle-body';
    body.textContent = entry.content;

    card.appendChild(head);
    card.appendChild(body);
    host.appendChild(card);
  });
}

function renderBossWorkCopy() {
  const wrap = document.getElementById('boss-workcopy-wrap');
  const editor = document.getElementById('boss-workcopy-editor');
  const accordion = document.getElementById('boss-workcopy-accordion');
  if (!wrap || !editor || !accordion) return;

  if (editor.value !== App.bossWorkCopy) editor.value = App.bossWorkCopy;

  if (App.bossWorkEditMode) {
    wrap.classList.add('hidden');
    editor.classList.remove('hidden-by-toggle');
  } else {
    wrap.classList.remove('hidden');
    editor.classList.add('hidden-by-toggle');
    renderBossWorkCopyAccordion();
  }
}

function initBossPanel() {
  if (!App.isBoss) return;
  document.querySelectorAll('.boss-tab').forEach((btn) => {
    btn.addEventListener('click', () => setBossTab(btn.dataset.tab));
  });
  const toggleBtn = document.getElementById('boss-workcopy-toggle');
  const editor = document.getElementById('boss-workcopy-editor');
  if (toggleBtn && editor) {
    toggleBtn.addEventListener('click', () => {
      App.bossWorkEditMode = !App.bossWorkEditMode;
      toggleBtn.innerHTML = App.bossWorkEditMode ? '📋 미리보기' : '📝 직접 편집';
      renderBossWorkCopy();
    });
    editor.addEventListener('input', () => {
      App.bossWorkCopy = editor.value;
      API.updateRightState({ workCopy: App.bossWorkCopy });
    });
  }
  setBossTab('work');
  renderReviewLog();
}

// =============================================================================
// §14 UI — right editors (draft / last result / notes / file upload)
// =============================================================================

function initRightEditor() {
  const editorId = App.activeRightMode === 'lastresult' ? 'right-editor-research' : 'right-editor';
  const editor = document.getElementById(editorId);
  if (!editor) return;
  const initialContent = App.activeRightMode === 'lastresult'
    ? ((RIGHT_STATE && RIGHT_STATE.lastResult) || '')
    : ((RIGHT_STATE && RIGHT_STATE.draft) || FINAL || '');
  editor.value = initialContent;
  editor.addEventListener('input', () => {
    const stateUpdate = App.activeRightMode === 'lastresult'
      ? { lastResult: editor.value }
      : { draft: editor.value };
    API.updateRightState(stateUpdate);
  });
}

function initEditMode() {
  const editor = document.getElementById('md-editor');
  const initialContent = (RIGHT_STATE && RIGHT_STATE.mdContent) || PREV || '';
  editor.value = initialContent;
  editor.addEventListener('input', () => API.updateRightState({ mdContent: editor.value }));
  document.getElementById('edit-reload').addEventListener('click', () => {
    if (confirm('현재 편집 중인 내용을 버리고 이전 단계 결과를 다시 불러올까요?')) {
      editor.value = PREV || '';
      API.updateRightState({ mdContent: editor.value });
    }
  });
  initNotes();
}

function initNotes() {
  const notesList = document.getElementById('notes-list');
  let notes = (RIGHT_STATE && RIGHT_STATE.notes) || [''];
  if (notes.length === 0) notes = [''];

  function persist() { API.updateRightState({ notes }); }

  function autoGrow(ta) {
    ta.style.height = 'auto';
    ta.style.height = Math.max(24, ta.scrollHeight) + 'px';
  }

  function renderNotes() {
    notesList.innerHTML = '';
    notes.forEach((text, i) => {
      const item = document.createElement('div');
      item.className = 'note-item';
      item.innerHTML = `
        <div class="note-num">${i + 1}</div>
        <textarea class="note-textarea" rows="1" placeholder="수정 요청 메모..."></textarea>
        <button class="note-remove" title="삭제">×</button>
      `;
      const ta = item.querySelector('textarea');
      ta.value = text;
      ta.addEventListener('input', (e) => {
        notes[i] = e.target.value;
        persist();
        autoGrow(ta);
      });
      autoGrow(ta);
      item.querySelector('.note-remove').addEventListener('click', () => {
        notes.splice(i, 1);
        if (notes.length === 0) notes = [''];
        persist();
        renderNotes();
      });
      notesList.appendChild(item);
    });
  }

  document.getElementById('add-note').addEventListener('click', () => {
    notes.push('');
    persist();
    renderNotes();
    const last = notesList.querySelector('.note-item:last-child textarea');
    if (last) last.focus();
  });

  renderNotes();
}

function initFileUpload() {
  const zone = document.getElementById('upload-zone');
  const input = document.getElementById('upload-input');
  const filesContainer = document.getElementById('uploaded-files');
  let uploaded = [];

  function renderFiles() {
    filesContainer.innerHTML = '';
    uploaded.forEach((f, i) => {
      const el = document.createElement('div');
      el.className = 'uploaded-file';
      el.innerHTML = `📄 <span>${f.name}</span><button class="remove" title="삭제">×</button>`;
      el.querySelector('.remove').addEventListener('click', () => {
        uploaded.splice(i, 1);
        persistFiles();
      });
      filesContainer.appendChild(el);
    });
  }

  function persistFiles() {
    API.updateRightState({ uploadedFiles: uploaded });
    renderFiles();
  }

  function handleFiles(fileList) {
    for (const f of fileList) {
      if (!/\.(md|txt)$/i.test(f.name)) continue;
      const reader = new FileReader();
      reader.onload = (e) => {
        uploaded.push({ name: f.name, content: e.target.result });
        persistFiles();
      };
      reader.readAsText(f);
    }
  }

  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', (e) => handleFiles(e.target.files));
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragging'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragging'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragging');
    handleFiles(e.dataTransfer.files);
  });

  if (RIGHT_STATE && RIGHT_STATE.uploadedFiles) {
    uploaded = RIGHT_STATE.uploadedFiles;
    renderFiles();
  }

  return { getFiles: () => uploaded, clearFiles: () => { uploaded = []; persistFiles(); } };
}

// =============================================================================
// §15 Event wiring (send, finalize, primary)
// =============================================================================

// Read the composer + attachments into a turn payload. Returns null if empty.
function readComposerTurn() {
  const text = DOM.inputEl.value.trim();
  const attachments = App.fileUpload ? App.fileUpload.getFiles() : [];
  if (!text && attachments.length === 0) return null;

  let displayText = text;
  if (attachments.length > 0) {
    displayText += `\n\n[첨부 ${attachments.length}개: ${attachments.map((a) => a.name).join(', ')}]`;
  }
  // Snapshot + clear the upload widget so the next message starts clean.
  if (App.fileUpload && attachments.length > 0) App.fileUpload.clearFiles();
  return { text, attachments, displayText };
}

// Actually dispatch a turn to the server (renders the user bubble + fires the call).
function dispatchTurn(turn) {
  if (App.mode !== 'result-rerequest-rightcopy') {
    addBubble('user', turn.displayText);
  } else {
    // Render user request as a card in research mode
    const card = document.createElement('div');
    card.className = 'research-card';
    card.style.borderLeftColor = '#cbd5e1';
    card.innerHTML = `<div class="research-card-meta">사용자 요청</div>`;
    const txt = document.createElement('div');
    txt.textContent = turn.displayText;
    card.appendChild(txt);
    document.getElementById('research-result').appendChild(card);
  }
  App.history.push({ role: 'user', content: turn.text || '(첨부 파일 검토 부탁)' });

  setBusy(true);
  showThinking();
  API.sendChat(turn.text, turn.attachments);
}

function send() {
  const turn = readComposerTurn();
  if (!turn) return;
  DOM.inputEl.value = '';

  if (App.isBusy) {
    // A turn is in flight — queue it. flushQueue() sends it when the turn ends.
    App.pendingQueue.push(turn);
    renderQueue();
    return;
  }
  dispatchTurn(turn);
}

// Send the next queued turn once the server is idle again.
function flushQueue() {
  if (App.isBusy) return;
  if (App.pendingQueue.length === 0) { renderQueue(); return; }
  const next = App.pendingQueue.shift();
  renderQueue();
  dispatchTurn(next);
}

function removeFromQueue(idx) {
  App.pendingQueue.splice(idx, 1);
  renderQueue();
}

// Render the pending-message chips above the textarea.
function renderQueue() {
  const host = DOM.pendingQueue;
  if (!host) return;
  if (App.pendingQueue.length === 0) {
    host.classList.add('hidden');
    host.innerHTML = '';
    return;
  }
  host.classList.remove('hidden');
  host.innerHTML = '';
  const label = document.createElement('span');
  label.className = 'pending-queue-label';
  label.textContent = `예약된 메시지 ${App.pendingQueue.length}개 · 응답 끝나면 순서대로 전송`;
  host.appendChild(label);
  App.pendingQueue.forEach((turn, i) => {
    const chip = document.createElement('span');
    chip.className = 'pending-chip';
    const preview = (turn.text || turn.displayText || '(첨부)').replace(/\s+/g, ' ').trim();
    const txt = document.createElement('span');
    txt.className = 'pending-chip-text';
    txt.textContent = preview.length > 40 ? preview.slice(0, 40) + '…' : preview;
    txt.title = turn.displayText;
    chip.appendChild(txt);
    const rm = document.createElement('button');
    rm.className = 'pending-chip-remove';
    rm.textContent = '×';
    rm.title = '예약 취소';
    rm.addEventListener('click', () => removeFromQueue(i));
    chip.appendChild(rm);
    host.appendChild(chip);
  });
}

function onFinalizeClick() {
  if (App.history.length === 0 && App.mode !== 'editable-md-notes') {
    setStatus('먼저 대화를 시작해주세요.', true);
    return;
  }
  if (App.mode === 'result-rerequest-rightcopy') {
    API.reviewLast();
    return;
  }
  setBusy(true);
  showThinking();
  API.finalize();
}

function onPrimaryClick() {
  const payload = {};
  let rightContent = '';

  if (App.activeRightMode === 'boss-2pane') {
    rightContent = App.bossWorkCopy || '';
    payload.workCopy = rightContent;
    const unapplied = App.bossReviewLog.filter((e) => !e.applied).length;
    if (!rightContent.trim()) {
      if (!confirm('작업본이 비어있어요. 그대로 디자이너에게 넘어갈까요?')) return;
    } else if (unapplied > 0) {
      if (!confirm(`아직 작업본에 반영 안 된 검토 로그가 ${unapplied}건 있어요. 그대로 디자이너에게 넘어갈까요?\n\n반영 안 된 항목은 04_final.md에 "미반영"으로 감사 이력에 남습니다.`)) return;
    }
  } else if (App.activeRightMode === 'draft') {
    rightContent = document.getElementById('right-editor').value;
    payload.summary = rightContent;
    payload.finalDraft = rightContent;
  } else if (App.activeRightMode === 'lastresult') {
    rightContent = document.getElementById('right-editor-research').value;
    payload.lastResult = rightContent;
  } else if (App.activeRightMode === 'notes') {
    rightContent = document.getElementById('md-editor').value;
    payload.mdContent = rightContent;
    payload.notes = (RIGHT_STATE && RIGHT_STATE.notes) || [];
  }

  // Empty-state confirmation (non-boss)
  if (App.activeRightMode !== 'boss-2pane' && (!rightContent || !rightContent.trim())) {
    if (!confirm('아직 우측에 추가한 내용이 없어요.\n\n각 ✅ 메시지의 📌 우측 추가 버튼을 눌러야 누적됩니다.\n\n이대로 다음 단계로 넘어갈까요?')) return;
  }

  setBusy(true);
  setStatus('다음 단계로 전달 중...');
  API.transferToNext(payload);
}

function wireEventHandlers() {
  if (DOM.sendBtn) DOM.sendBtn.addEventListener('click', send);
  if (DOM.inputEl) DOM.inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  if (DOM.finalizeBtn) DOM.finalizeBtn.addEventListener('click', onFinalizeClick);
  if (DOM.primaryBtn) DOM.primaryBtn.addEventListener('click', onPrimaryClick);
}

// =============================================================================
// §16 Incoming message router (extension → webview)
// =============================================================================

function handleIncomingMessage(msg) {
  switch (msg.type) {
    case 'message':
      if (msg.role !== 'assistant') return;
      hideThinking();
      App.history.push({ role: 'assistant', content: msg.content });
      if (App.mode === 'result-rerequest-rightcopy') {
        const host = document.getElementById('research-result');
        const empty = host.querySelector('.empty-state');
        if (empty) host.removeChild(empty);
        const card = buildResearchAssistantCard(msg.content, '리서치 결과');
        host.appendChild(card);
        card.scrollIntoView({ behavior: 'smooth', block: 'end' });
      } else {
        addBubble('assistant', msg.content);
      }
      setBusy(false);
      setStatus(null);
      break;

    case 'finalized':
      hideThinking();
      document.querySelectorAll('[data-rightmode]').forEach((el) => el.classList.add('hidden'));
      document.querySelector('[data-rightmode="draft"]').classList.remove('hidden');
      DOM.rightAction.classList.remove('hidden');
      showRightPanel();
      const editor = document.getElementById('right-editor');
      if (editor) editor.value = msg.value;
      if (App.isSlideAgent) {
        const wrap = document.getElementById('slide-accordion-wrap');
        if (wrap && wrap.classList.contains('hidden')) initSlideAccordion();
        else renderSlideAgentAccordion();
      }
      setBusy(false);
      setStatus('✓ 정리됨 — 오른쪽에서 검토·수정하세요.');
      setTimeout(() => setStatus(null), 2500);
      break;

    case 'reviewLogUpdated':
      App.bossReviewLog = msg.reviewLog || [];
      renderReviewLog();
      setBusy(false);
      setStatus(null);
      break;

    case 'workCopyUpdated':
      App.bossWorkCopy = msg.workCopy || '';
      App.bossReviewLog = msg.reviewLog || App.bossReviewLog;
      App.bossRecentChanges = msg.recentChanges || null;
      // Auto-switch to work tab so user sees the changes
      if (App.bossActiveTab !== 'work') setBossTab('work');
      else renderBossWorkCopy();
      renderReviewLog();
      // Flash the just-applied entry
      if (msg.appliedEntryId) {
        setTimeout(() => {
          const card = document.querySelector(`.review-log-entry[data-entry-id="${msg.appliedEntryId}"]`);
          if (card) {
            card.classList.add('flash-applied');
            setTimeout(() => card.classList.remove('flash-applied'), 1200);
          }
        }, 50);
      }
      setBusy(false);
      {
        const ch = App.bossRecentChanges;
        if (ch) {
          const parts = [];
          if (ch.modified && ch.modified.length) parts.push(`${ch.modified.length}장 수정`);
          if (ch.added && ch.added.length) parts.push(`${ch.added.length}장 추가`);
          if (ch.removed && ch.removed.length) parts.push(`${ch.removed.length}장 삭제`);
          setStatus(parts.length ? `✓ ${parts.join(' · ')} (작업본 갱신)` : '✓ 작업본 갱신됨');
        } else {
          setStatus('✓ 작업본 갱신됨');
        }
      }
      setTimeout(() => setStatus(null), 3000);
      break;

    case 'changeIndicatorsCleared':
      App.bossRecentChanges = null;
      renderBossWorkCopy();
      break;

    case 'reviewReady':
      document.querySelectorAll('[data-rightmode]').forEach((el) => el.classList.add('hidden'));
      document.querySelector('[data-rightmode="lastresult"]').classList.remove('hidden');
      DOM.rightAction.classList.remove('hidden');
      showRightPanel();
      const researchEditor = document.getElementById('right-editor-research');
      if (researchEditor) researchEditor.value = msg.value;
      setBusy(false);
      setStatus('✓ 마지막 리서치 결과를 오른쪽에 복사함');
      setTimeout(() => setStatus(null), 2500);
      break;

    case 'error':
      hideThinking();
      setBusy(false);
      setStatus(msg.value, true);
      break;

    case 'status':
      if (msg.value === 'applying') {
        setBusy(true);
        setStatus('AI가 검토 의견을 작업본에 반영 중...');
      }
      break;
  }
}

// =============================================================================
// §17 Bootstrap — runs once at load
// =============================================================================

function applyTheming() {
  document.body.style.setProperty('--char-color', App.agent.color);
  document.body.style.setProperty('--char-bg', App.agent.bgColor);
  document.documentElement.style.setProperty('--char-color', App.agent.color);
  document.documentElement.style.setProperty('--char-bg', App.agent.bgColor);
}

function initHeader() {
  const headSvg = CHARACTER_SVGS[App.agent.id];
  if (headSvg) document.getElementById('emoji').innerHTML = headSvg;
  else document.getElementById('emoji').textContent = App.agent.emoji;
  document.getElementById('accessory').textContent = App.agent.accessory;
  document.getElementById('step').textContent = `STEP ${STEP_NUMS[App.agent.id] || ''} · ${App.agent.role.toUpperCase()}`;
  document.getElementById('title').textContent = App.agent.label;
  document.getElementById('subtitle').textContent = App.agent.subtitle;
}

function initSecretaryUI() {
  // Mascot orb — SVG
  const sgMascotOrb = document.getElementById('sg-mascot-orb');
  if (sgMascotOrb && CHARACTER_SVGS[App.agent.id]) {
    sgMascotOrb.innerHTML = CHARACTER_SVGS[App.agent.id];
    sgMascotOrb.classList.add('has-svg');
  }
  // Folder picker
  const sgFolderPathEl = document.getElementById('sg-folder-path');
  const sgFolderBtnEl = document.getElementById('sg-folder-btn');
  if (sgFolderPathEl && RESULTS_DIR) {
    sgFolderPathEl.textContent = RESULTS_DIR.isCustom
      ? RESULTS_DIR.path
      : `${RESULTS_DIR.path} (워크스페이스 기본값)`;
    if (RESULTS_DIR.isCustom) sgFolderPathEl.classList.add('is-custom');
  }
  if (sgFolderBtnEl) sgFolderBtnEl.addEventListener('click', () => API.selectFolder());
}

function initPrevSection() {
  if (PREV) {
    document.getElementById('prev-section').classList.remove('hidden');
    document.getElementById('prev-content').textContent = PREV;
  }
}

function initMainModeContainer() {
  document.querySelectorAll('[data-mode]').forEach((el) => el.classList.add('hidden'));
  document.querySelector(`[data-mode="${App.activeMainMode}"]`).classList.remove('hidden');
}

function initRightArea() {
  document.querySelectorAll('[data-rightmode]').forEach((el) => el.classList.add('hidden'));

  const hasExistingRightContent =
    (RIGHT_STATE && (
      RIGHT_STATE.draft ||
      RIGHT_STATE.lastResult ||
      (RIGHT_STATE.notes && RIGHT_STATE.notes.some((n) => n && n.trim())) ||
      (RIGHT_STATE.reviewLog && RIGHT_STATE.reviewLog.length) ||
      (RIGHT_STATE.workCopy && RIGHT_STATE.workCopy.trim())
    )) ||
    FINAL;

  if (App.mode === SECRETARY_MODE) {
    document.querySelector('[data-rightmode="secretary"]').classList.remove('hidden');
    DOM.rightAction.classList.remove('hidden');
    showRightPanel();
  } else if (App.mode === 'editable-md-notes') {
    if (App.activeRightMode) {
      document.querySelector(`[data-rightmode="${App.activeRightMode}"]`).classList.remove('hidden');
    }
    DOM.rightAction.classList.remove('hidden');
    showRightPanel();
  } else if (App.isCumulative) {
    // Cumulative chat modes — right panel always visible for accumulating
    if (App.activeRightMode) {
      document.querySelector(`[data-rightmode="${App.activeRightMode}"]`).classList.remove('hidden');
    }
    DOM.rightAction.classList.remove('hidden');
    showRightPanel();
  } else if (hasExistingRightContent) {
    if (App.activeRightMode) {
      document.querySelector(`[data-rightmode="${App.activeRightMode}"]`).classList.remove('hidden');
    }
    DOM.rightAction.classList.remove('hidden');
    showRightPanel();
  }
  // else: right panel stays hidden until finalize
}

function initComposer() {
  if (!COMPOSER_MODES.includes(App.mode)) return;
  DOM.composer.classList.remove('hidden');
  if (App.agent.finalizeButton) {
    DOM.finalizeBtn.textContent = App.agent.finalizeButton;
    DOM.finalizeBtn.classList.remove('hidden');
  } else {
    DOM.finalizeBtn.classList.add('hidden');
  }

  // Placeholder per mode
  if (App.mode === SECRETARY_MODE) {
    DOM.inputEl.placeholder = '예: "비서가 할 수 있는 게 뭐야?" / "내 1단계 결과 보여줘" / "지금 어디 단계야?" / "프롬프트 [내용] 추가해줘"';
  } else if (App.mode === 'result-rerequest-rightcopy') {
    DOM.inputEl.placeholder = '예: "시장 규모를 더 최신 자료로 다시 찾아줘", "경쟁사 가격 정책 위주로"';
  } else if (App.mode === 'critique-finaldraft') {
    DOM.inputEl.placeholder = '부장님과 추가 논의 (Shift+Enter 줄바꿈, Enter 전송)';
  } else if (App.mode === 'plan-rerequest-finaldraft') {
    DOM.inputEl.placeholder = '디자인 방향 의견 (예: "더 모던한 톤으로", "한글 위주로")';
  } else {
    DOM.inputEl.placeholder = '여기에 입력 (Shift+Enter 줄바꿈, Enter 전송)';
  }
}

function initPrimaryButton() {
  if (App.agent.primaryButton && App.agent.primaryButtonLocation === 'right') {
    DOM.primaryBtn.textContent = App.agent.primaryButton;
  }
}

function initFileUploadIfAllowed() {
  if (App.agent.allowFileUpload) {
    document.getElementById('upload-section').classList.remove('hidden');
    App.fileUpload = initFileUpload();
  }
}

function initOpenFileButton() {
  const openBtn = document.getElementById('open-file-btn');
  if (openBtn && FINAL) {
    openBtn.style.display = 'block';
    openBtn.addEventListener('click', () => API.openFile());
  }
}

function bootstrap() {
  cacheDOM();
  applyTheming();
  initHeader();
  initSecretaryUI();
  initPrevSection();
  initMainModeContainer();
  initRightArea();
  initComposer();
  initPrimaryButton();
  initFileUploadIfAllowed();

  // Main mode init
  if (App.mode === 'editable-md-notes') {
    initEditMode();
  } else {
    initRightEditor();
    renderHistory();
  }

  // FINAL prefill (for already-completed steps)
  if (FINAL && App.activeRightMode === 'draft') {
    const editor = document.getElementById('right-editor');
    if (editor && !editor.value) editor.value = FINAL;
  }

  // Per-character special panels
  if (App.isSlideAgent && App.activeRightMode === 'draft') initSlideAccordion();
  if (App.isBoss) initBossPanel();

  // Wire events + open-file button
  wireEventHandlers();
  initOpenFileButton();

  // Incoming message listener
  window.addEventListener('message', (e) => handleIncomingMessage(e.data));
}

bootstrap();
