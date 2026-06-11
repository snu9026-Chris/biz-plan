// =============================================================================
// Biz Plan Agent — VS Code Extension Entry
//
// File layout:
//   §1  AGENTS config (immutable)
//   §2  State (single source of mutable runtime state)
//   §3  Filesystem utilities
//   §4  Slide markdown parser + diff (boss apply logic)
//   §5  Claude API
//   §6  Pipeline message handlers (chat / finalize / reviewLast / transfer)
//   §7  Boss 2-pane handlers (review log + work copy)
//   §8  Webview rendering (sidebar + center panel)
//   §9  Message router
//   §10 Extension lifecycle (activate / deactivate / commands)
// =============================================================================

// Desktop (Electron) build injects a shim into globalThis before this file is
// required, so we don't actually call require('vscode') when running outside
// the IDE. The .vsix build path is unchanged.
const vscode = globalThis.__bizPlanVscode || require('vscode');
const fs = require('fs');
const path = require('path');

// =============================================================================
// §1  AGENTS — immutable per-character configuration
// =============================================================================

const AGENTS = [
  {
    id: '00_secretary',
    emoji: '💁',
    accessory: '✦',
    name: 'Secretary',
    label: '비서',
    role: 'Pipeline Guide',
    subtitle: '이 익스텐션이 어떻게 작동하는지 안내해드릴게요. 우측에서 사용법을 보고 시작하세요.',
    output: '',
    isGuide: true,
    uiMode: 'secretary-chat',
    extraTools: ['Write', 'Edit'],
    primaryButton: '과장님과 시작하기 →',
    primaryButtonLocation: 'right',
    finalizeButton: null,
    allowFileUpload: false,
    color: '#a78bfa',
    bgColor: '#f3f0ff',
    greeting: '안녕하세요! 비서예요. 이 익스텐션 사용법을 우측 패널에 띄워뒀어요. 한 번 훑어보시고 궁금한 거 뭐든 물어보세요. 예를 들어:\n\n• "비서가 할 수 있는 게 뭐야?"\n• "내 1단계 결과 보여줘"\n• "지금 어디 단계야?"\n• "프롬프트 [내용] 추가해줘"\n\n다 보셨으면 우측 "과장님과 시작하기 →" 누르시면 본격 시작입니다.',
  },
  {
    id: '01_manager',
    emoji: '📋',
    accessory: '💬',
    name: 'Manager',
    label: '과장님',
    role: 'Validation + Direction',
    subtitle: '두 가지 방식으로 도와드립니다. ① 자료 첨부하면 검토받기 / ② 사업 아이템 던지면 같이 검증.',
    output: '01_decision_brief.md',
    uiMode: 'chat-summary',
    primaryButton: '리서처한테 넘기기 →',
    primaryButtonLocation: 'right',
    finalizeButton: null,
    allowFileUpload: true,
    color: '#f59e0b',
    bgColor: '#fffbeb',
    greeting: '안녕하세요, 과장님이에요. 시작 전에 한 가지 — 이 자료가 어떤 용도예요?\n\n① 투자자 IR (시드 / 시리즈 A·B)\n② 정부지원사업 신청서\n③ 파트너십 제안 / M&A\n④ 데이터·라이센싱 제안\n⑤ 일반 사업검토 / 내부 의사결정\n⑥ 기타 (직접 입력)\n\n그리고 사업 아이템 한 줄 같이 알려주세요. 정리한 자료 있으면 가운데 채팅 위 박스에 첨부도 가능해요.',
  },
  {
    id: '02_researcher',
    emoji: '🔬',
    accessory: '🔍',
    name: 'Researcher',
    label: '리서처',
    role: 'Pure Data Research',
    subtitle: '오피스 아워 결과를 받아 인터넷에서 시장·경쟁·수치를 객관적으로 조사합니다.',
    output: '02_research_data.md',
    dependsOn: '01_decision_brief.md',
    uiMode: 'result-rerequest-rightcopy',
    primaryButton: '에이스 팀원에게 넘기기 →',
    primaryButtonLocation: 'right',
    finalizeButton: null,
    color: '#34d399',
    bgColor: '#ecfdf5',
    greeting: '어디 보자... 과장님께 받은 명세 확인했어요 (없으면 단일 리서치 모드로 진행).\n\nGuide A 슬라이드 목차 순서로 9개 카테고리 가요:\n\n1. 문제 정의 데이터 ← 여기서 시작\n2. 현실 대체재\n3. 차별점·경쟁사 비교\n4. 시장 규모·트렌드\n5. 고객 세그먼트\n6. BM·단가 데이터\n7. GTM 채널 데이터\n8. Traction·마일스톤 벤치마크\n9. 규제·기술·신뢰 리스크\n\n각 카테고리 끝나면 ✅ 정리 메시지 띄울 테니 📌 우측 추가 누르시면 누적됩니다.\n\n1번 문제 정의 데이터부터 시작하시죠. 세 가지 각도로 검색 가능합니다:\n\nA. 산업 평균 통계 (영향받는 회사 %·시간 손실) — ⭐ 추천\nB. 단일 사례·인용구 (실제 인터뷰·기사)\nC. A + B 결합\n\nA부터 갈까요? 아니면 B/C?',
  },
  {
    id: '03_slide_agent',
    emoji: '📐',
    accessory: '✦',
    name: 'Ace',
    label: '에이스 팀원',
    role: 'Guide A Structure',
    subtitle: '리서치 결과를 받아 Guide A 기반 슬라이드를 한 장씩 만들고 우측에 누적합니다.',
    output: '03_slides.md',
    dependsOn: '02_research_data.md',
    uiMode: 'chat-summary',
    primaryButton: '부장님 검증받기 →',
    primaryButtonLocation: 'right',
    finalizeButton: null,
    color: '#38bdf8',
    bgColor: '#eff8fe',
    greeting: '리서치 자료 잘 받았어요! 에이스 팀원이에요. Guide A 기반으로 슬라이드 한 장씩 같이 만들어볼게요.\n\n기승전결 흐름으로 진행:\n1. 표지\n2. 문제 정의\n3. 솔루션 / 회사 정의\n4. 차별점·기술적 차별성\n5. 시장 규모\n6. BM\n7. GTM\n8. Traction\n9. 팀\n10. 마일스톤\n11. Summary\n\n⭐ 한 장씩 만들고 ✅ 정리 메시지마다 📌 우측 추가 누르시면 슬라이드 .md가 누적됩니다.\n\n1번 표지부터 시작할까요? 아니면 먼저 잡고 싶은 슬라이드 있으세요?\n\n(받은 리서치 .md 보고 사업·청자에 따라 11장 구성을 바꾸자고 제안할 수도 있어요 — 그건 첫 메시지에서 의견 드릴게요)',
  },
  {
    id: '04_boss',
    emoji: '👔',
    accessory: '⚡',
    name: '부장님',
    label: '부장님',
    role: 'CEO Review',
    subtitle: '슬라이드 초안을 CEO Review 가이드 기준으로 비판·검토하고 최종본을 만듭니다.',
    output: '04_final.md',
    dependsOn: '03_slides.md',
    uiMode: 'critique-finaldraft',
    primaryButton: '디자이너에게 전달하기 →',
    primaryButtonLocation: 'right',
    finalizeButton: null,
    color: '#6366f1',
    bgColor: '#eef2ff',
    greeting: '음... 가져온 슬라이드 보자.\n\n우측에 탭 두 개 있어:\n- 📋 **작업본** — 너 슬라이드 그대로 로드. 내 의견 적용할 때마다 슬라이드가 갱신됨.\n- 🔍 **검토 로그** — 내 의견 누적. 각 항목에 [✓ 작업본 반영] 버튼.\n\nCEO Review 8 Step으로 까볼 거야. 끝나면 ✅ 정리 띄우니까:\n1) 📌 검토 로그에 추가\n2) [✓ 작업본 반영] 누르면 AI가 작업본 슬라이드 갱신\n\n순서:\n1. Premise Challenge — 전제 도전\n2. 12-Month Dream State\n3. 전략 대안 2-3개\n4. 10x Check\n5. Scope Decision\n6. 11개 섹션별 점검 (★ 핵심)\n7. Failure Mode Review\n8. 최종 수정 지시 + 포지셔닝\n\n자, 1번 Premise Challenge부터 가자. **너 사업의 핵심 전제가 뭐야?** 한 줄로.',
  },
  {
    id: '05_designer',
    emoji: '🎨',
    accessory: '🌈',
    name: 'Designer',
    label: '디자이너',
    role: 'Design Prompt',
    subtitle: 'Claude Design에 넘길 디자인 프롬프트의 1차 계획서를 작성하고 최종본을 추출합니다.',
    output: '05_design_prompt.md',
    dependsOn: '04_final.md',
    uiMode: 'plan-rerequest-finaldraft',
    primaryButton: '클로드 디자인 .md 추출하기 →',
    primaryButtonLocation: 'right',
    finalizeButton: null,
    color: '#f472b6',
    bgColor: '#fdf2f8',
    greeting: '드디어 디자인이에요!\n\n부장님 최종본 잘 받았어요. 이제 Claude Design에 던질 디자인 프롬프트를 같이 만들어요.\n\n🎨 **4단계로 짧게** 갈게요. Claude Design이 똑똑해서 슬라이드별 디테일은 알아서 잡으니, 우리는 **방향성·시스템·회피 가이드만** 정해주면 됩니다.\n\n순서:\n1. Q1-Q4 (청자 / 브랜드 / 도메인 / 사용처)\n2. 디자인 시스템 결정 (컬러 / 타이포 / 격자 / 카드 / 도식)\n   → 컬러는 채팅창에 카드로 시각 미리보기\n3. (선택) 이상 케이스 플래그\n4. 자산 요청 + 회피 패턴\n\n각 ✅ 정리에 📌 우측 추가 누르시면 누적됩니다.\n\n자, Q1부터. **이 자료 누구한테 보여줄 거예요?**\n\nA. 보수적 VC / 금융권 / 대기업\nB. 임팩트 투자자 / 사회적 가치\nC. 테크·AI 펀드\nD. 정부 / 공공기관\nE. 일반 소비자 / D2C\nF. 기타 (직접 입력)',
  },
];

// =============================================================================
// §2  State — single source of mutable runtime state
//
// Every mutable global lives here. Never declare module-level `let` vars
// elsewhere. To access from helpers, use State.<key> (object reference is
// stable; only fields mutate).
// =============================================================================

const State = {
  // Per-agent conversation history: { [agentId]: [{role, content}, ...] }
  chatHistories: {},

  // Per-agent right panel snapshot: { [agentId]: { draft, lastResult, notes,
  //   mdContent, uploadedFiles, workCopy, reviewLog, recentChanges } }
  rightPanelState: {},

  // Active webview panel reference (null when closed).
  centerPanel: null,

  // Currently-focused agent id (null on first activation).
  currentAgentId: null,

  // VS Code extension context (for globalState access). Set in activate().
  context: null,
};

function getAgent(id) {
  return AGENTS.find((a) => a.id === id);
}

function getRightState(agentId) {
  return State.rightPanelState[agentId] || {};
}

function mergeRightState(agentId, patch) {
  State.rightPanelState[agentId] = { ...(State.rightPanelState[agentId] || {}), ...patch };
  persistState();
}

// Persist chatHistories + rightPanelState to a per-folder JSON file on disk.
// This means: each results folder gets its own state — switching folders gives
// a blank slate, returning to a previous folder restores its chat + right panel.
// Survives IDE restart, panel close, anything except actual file deletion.
//
// Also writes human-readable .md logs of every chat to <resultsDir>/.biz-plan-logs/
// (display only — extension reads back from .biz-plan-state.json, not the .md).

function getStateFilePath() {
  return path.join(getResultsDir(), '.biz-plan-state.json');
}

function getLogsDir() {
  return path.join(getResultsDir(), '.biz-plan-logs');
}

function persistState() {
  try {
    ensureDir(getResultsDir());
    const data = {
      version: 1,
      savedAt: new Date().toISOString(),
      chatHistories: State.chatHistories,
      rightPanelState: State.rightPanelState,
    };
    fs.writeFileSync(getStateFilePath(), JSON.stringify(data, null, 2), 'utf8');
    writeReadableLogs();
  } catch (e) {
    // best-effort — never break the chat flow if disk is unavailable
    console.error('[biz-plan-agent] persistState failed:', e);
  }
}

function loadState() {
  // Reset memory first — moving to a folder with no state.json = blank slate
  State.chatHistories = {};
  State.rightPanelState = {};
  try {
    const p = getStateFilePath();
    if (!fs.existsSync(p)) return;
    const raw = fs.readFileSync(p, 'utf8');
    const data = JSON.parse(raw);
    if (data && typeof data === 'object') {
      if (data.chatHistories && typeof data.chatHistories === 'object') {
        State.chatHistories = data.chatHistories;
      }
      if (data.rightPanelState && typeof data.rightPanelState === 'object') {
        State.rightPanelState = data.rightPanelState;
      }
    }
  } catch (e) {
    console.error('[biz-plan-agent] loadState failed:', e);
  }
}

// Write per-agent chat + right panel as human-readable .md inside .biz-plan-logs/
// so the user can browse "every conversation that ever happened" alongside the
// official .md outputs. Extension does NOT read these back — they are display only.
function writeReadableLogs() {
  try {
    const dir = getLogsDir();
    ensureDir(dir);
    for (const agent of AGENTS) {
      const history = State.chatHistories[agent.id];
      const right = State.rightPanelState[agent.id];
      if ((!history || history.length === 0) && !right) continue;
      const lines = [];
      lines.push(`# ${agent.emoji} ${agent.label} — 대화 로그`);
      lines.push('');
      lines.push(`_자동 저장: ${new Date().toISOString()}_`);
      lines.push('');
      if (history && history.length) {
        lines.push('## 💬 대화');
        lines.push('');
        for (const m of history) {
          const role = m.role === 'user' ? '🧑 사용자' : '🤖 ' + agent.label;
          lines.push(`### ${role}`);
          lines.push('');
          lines.push(String(m.content || ''));
          lines.push('');
        }
      }
      if (right) {
        lines.push('## 📋 우측 패널 상태');
        lines.push('');
        if (right.draft) {
          lines.push('### Draft');
          lines.push('');
          lines.push(right.draft);
          lines.push('');
        }
        // notes is a string[] (one entry per memo); render as a numbered list.
        // Tolerate a legacy string value too.
        const notesArr = Array.isArray(right.notes)
          ? right.notes.filter((n) => n && n.trim())
          : (right.notes && right.notes.trim() ? [right.notes] : []);
        if (notesArr.length) {
          lines.push('### Notes');
          lines.push('');
          notesArr.forEach((n, i) => lines.push(`${i + 1}. ${n}`));
          lines.push('');
        }
        if (right.workCopy) {
          lines.push('### Work copy');
          lines.push('');
          lines.push(right.workCopy);
          lines.push('');
        }
        if (right.reviewLog && right.reviewLog.length) {
          lines.push('### Review log');
          lines.push('');
          lines.push('```json');
          lines.push(JSON.stringify(right.reviewLog, null, 2));
          lines.push('```');
          lines.push('');
        }
      }
      const fname = `${agent.id}.md`;
      fs.writeFileSync(path.join(dir, fname), lines.join('\n'), 'utf8');
    }
  } catch (e) {
    console.error('[biz-plan-agent] writeReadableLogs failed:', e);
  }
}

// Wipe everything: state.json, readable logs, .md outputs, in-memory state.
// Used by sidebar's 2-step inline confirm + command palette reset.
function doReset() {
  // Whitelist-only deletion: never blindly empty the results dir, because the
  // user can point it at an arbitrary folder (customResultsDir) that holds
  // unrelated files. We delete ONLY the artifacts this extension creates:
  //   - each agent's output .md (e.g. 00_secretary.md … 05_designer.md)
  //   - .biz-plan-state.json
  //   - the .biz-plan-logs/ directory (our readable chat logs)
  const dir = getResultsDir();
  const rm = (p) => { try { fs.unlinkSync(p); } catch {} };

  for (const agent of AGENTS) {
    if (agent.output) rm(path.join(dir, agent.output));
  }
  rm(getStateFilePath());

  const logsDir = getLogsDir();
  try {
    if (fs.existsSync(logsDir)) {
      for (const inner of fs.readdirSync(logsDir)) rm(path.join(logsDir, inner));
      try { fs.rmdirSync(logsDir); } catch {}
    }
  } catch {}

  for (const k of Object.keys(State.chatHistories)) delete State.chatHistories[k];
  for (const k of Object.keys(State.rightPanelState)) delete State.rightPanelState[k];
  // state.json was deleted above; nothing to persist now
}

// =============================================================================
// §3  Filesystem utilities
// =============================================================================

function readFile(p) {
  return fs.readFileSync(p, 'utf8');
}

function safeRead(p) {
  try { return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; } catch { return ''; }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getResultsDir() {
  // 1) User-selected folder (via "📁 폴더 선택하기") wins
  if (State.context) {
    const customDir = State.context.globalState.get('customResultsDir');
    if (customDir && typeof customDir === 'string') return customDir;
  }
  // 2) Workspace folder + configurable subfolder
  const folders = vscode.workspace.workspaceFolders;
  const root = folders && folders.length ? folders[0].uri.fsPath : require('os').homedir();
  const cfg = vscode.workspace.getConfiguration('bizPlanAgent');
  const sub = cfg.get('workspaceFolder') || 'biz-plan-results';
  return path.join(root, sub);
}

// =============================================================================
// §4  Slide markdown parser + diff
//
// Used only by boss apply mechanism — parses the slide .md into per-slide
// bodies and TOC titles so we can compute which slides changed after an
// AI-applied edit. (The webview has its own parser for rendering; these two
// can't share code across the process boundary.)
// =============================================================================

function parseSlidesForDiff(text) {
  const slides = {};
  const tocTitles = {};
  if (!text) return { slides, tocTitles };

  // Slide bodies: ✅ **슬라이드 N: ... — 정리**
  const slideRe = /✅\s*\*\*슬라이드\s+(\d+)\s*[::][^*]*\*\*([\s\S]*?)(?=\n---\n|\n✅\s*\*\*|$)/g;
  let m;
  while ((m = slideRe.exec(text)) !== null) {
    const n = parseInt(m[1], 10);
    if (!isNaN(n)) slides[n] = m[2].trim();
  }

  // TOC titles: last "✅ **목차 ..."  block, parse table rows
  const tocStartRe = /✅\s*\*\*목차[^\n]*\*\*/g;
  let lastTocStart = -1;
  let tm;
  while ((tm = tocStartRe.exec(text)) !== null) lastTocStart = tm.index;
  if (lastTocStart >= 0) {
    const after = text.slice(lastTocStart);
    const endMatch = after.match(/\n---\n|\n✅\s*\*\*/);
    const tocBlock = endMatch ? after.slice(0, endMatch.index) : after;
    const rowRe = /^\|\s*(\d+)\s*\|\s*([^|\n]+?)\s*\|/gm;
    let r;
    while ((r = rowRe.exec(tocBlock)) !== null) {
      const n = parseInt(r[1], 10);
      const title = r[2].trim();
      if (!isNaN(n) && title) tocTitles[n] = title;
    }
  }
  return { slides, tocTitles };
}

function diffWorkCopies(oldText, newText) {
  const oldP = parseSlidesForDiff(oldText);
  const newP = parseSlidesForDiff(newText);
  const allSlides = new Set([
    ...Object.keys(oldP.slides).map(Number),
    ...Object.keys(newP.slides).map(Number),
    ...Object.keys(oldP.tocTitles).map(Number),
    ...Object.keys(newP.tocTitles).map(Number),
  ]);
  const modified = [];
  const added = [];
  const removed = [];
  const renamed = [];
  for (const n of allSlides) {
    const wasInOld = oldP.tocTitles[n] !== undefined || oldP.slides[n] !== undefined;
    const isInNew = newP.tocTitles[n] !== undefined || newP.slides[n] !== undefined;
    if (!wasInOld && isInNew) {
      added.push(n);
    } else if (wasInOld && !isInNew) {
      removed.push(n);
    } else {
      const oldBody = oldP.slides[n] || '';
      const newBody = newP.slides[n] || '';
      const oldTitle = oldP.tocTitles[n] || '';
      const newTitle = newP.tocTitles[n] || '';
      if (oldBody !== newBody) modified.push(n);
      else if (oldTitle !== newTitle) renamed.push(n);
    }
  }
  return { modified, added, removed, renamed };
}

// =============================================================================
// §5  Claude API
// =============================================================================

function buildSystemPrompt(agent) {
  const promptPath = path.join(State.context.extensionUri.fsPath, 'prompts', `${agent.id}.md`);
  let base = fs.existsSync(promptPath) ? fs.readFileSync(promptPath, 'utf8') : '';

  if (agent.dependsOn) {
    const prev = safeRead(path.join(getResultsDir(), agent.dependsOn));
    if (prev) {
      base += `\n\n---\n\n# 이전 단계 결과 (${agent.dependsOn})\n\n${prev}\n`;
    }
  }

  // Secretary gets workspace context — list of saved .md files in results dir
  if (agent.isGuide) {
    const resultsDir = getResultsDir();
    let files = [];
    try {
      if (fs.existsSync(resultsDir)) {
        files = fs.readdirSync(resultsDir).filter((f) => f.endsWith('.md'));
      }
    } catch {}
    base += `\n\n---\n\n# 워크스페이스 컨텍스트 (실시간)\n\n`;
    base += `결과 폴더 절대 경로: \`${resultsDir}\`\n`;
    base += `현재 저장된 .md 파일: ${files.length ? files.map((f) => '`' + f + '`').join(', ') : '(아직 없음)'}\n\n`;
    base += `Read 툴로 위 절대 경로의 파일을 조회할 수 있다. 사용자가 단계별 결과를 보여달라고 하면 해당 파일을 Read로 읽어서 요약/원문을 보여줘라.\n`;
  }

  return base;
}

async function callClaudeChat(systemPrompt, messages) {
  const cfg = vscode.workspace.getConfiguration('bizPlanAgent');
  const useClaudeCode = cfg.get('useClaudeCodeAuth');
  const apiKey = cfg.get('anthropicApiKey');
  const model = cfg.get('model') || 'claude-opus-4-7';

  if (useClaudeCode) {
    const { query } = require('@anthropic-ai/claude-agent-sdk');
    const promptString = messages
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');
    let full = '';
    // Default tools: read-only / web. Some agents (secretary) get write/edit too.
    const baseTools = ['WebSearch', 'WebFetch', 'Read'];
    const agent = getAgent(State.currentAgentId);
    const allowedTools = agent && agent.extraTools
      ? [...baseTools, ...agent.extraTools]
      : baseTools;
    const result = query({
      prompt: promptString,
      options: {
        systemPrompt,
        model,
        allowedTools,
        permissionMode: 'bypassPermissions',
      },
    });
    for await (const message of result) {
      if (message.type === 'assistant' && message.message && message.message.content) {
        for (const block of message.message.content) {
          if (block.type === 'text') full += block.text;
        }
      }
    }
    return full;
  }

  if (!apiKey) throw new Error('No API key set. Configure bizPlanAgent.anthropicApiKey or enable useClaudeCodeAuth.');
  const Anthropic = require('@anthropic-ai/sdk').default;
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model,
    max_tokens: 8000,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  return res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
}

// =============================================================================
// §6  Pipeline message handlers
// =============================================================================

function postToWebview(message) {
  if (State.centerPanel) State.centerPanel.webview.postMessage(message);
}

async function handleChat(agent, userText, attachments) {
  if (!State.chatHistories[agent.id]) State.chatHistories[agent.id] = [];
  const history = State.chatHistories[agent.id];

  let fullText = userText || '';
  if (attachments && attachments.length) {
    const blocks = attachments.map((a) => `\n\n[첨부 파일: ${a.name}]\n${a.content}`).join('');
    fullText = (fullText + blocks).trim();
  }
  if (!fullText) return;

  history.push({ role: 'user', content: fullText });
  postToWebview({ type: 'status', value: 'thinking' });

  try {
    const systemPrompt = buildSystemPrompt(agent);
    const reply = await callClaudeChat(systemPrompt, history);
    history.push({ role: 'assistant', content: reply });
    postToWebview({ type: 'message', role: 'assistant', content: reply });
  } catch (err) {
    postToWebview({ type: 'error', value: String(err.message || err) });
  }
  persistState();
}

async function handleFinalize(agent) {
  const history = State.chatHistories[agent.id] || [];
  if (history.length === 0 && agent.uiMode !== 'editable-md-notes') {
    postToWebview({ type: 'error', value: '먼저 캐릭터와 대화를 시작해주세요.' });
    return;
  }

  const finalizeInstruction =
    '지금까지 우리가 논의한 내용을 시스템 프롬프트의 "정리 모드 출력 형식"에 따라 최종 산출물로 정리해줘. ' +
    '대화 형태가 아니라 최종 .md 문서 형태로만 출력해줘. 인사말이나 부연 없이 문서만.';

  postToWebview({ type: 'status', value: 'finalizing' });

  try {
    const systemPrompt = buildSystemPrompt(agent);
    const messagesForFinalize = [...history, { role: 'user', content: finalizeInstruction }];
    const finalText = await callClaudeChat(systemPrompt, messagesForFinalize);
    mergeRightState(agent.id, { draft: finalText });
    postToWebview({ type: 'finalized', value: finalText, target: 'right' });
  } catch (err) {
    postToWebview({ type: 'error', value: String(err.message || err) });
  }
}

function handleReviewLast(agent) {
  // For Researcher: copy LAST assistant message into right panel as editable
  const history = State.chatHistories[agent.id] || [];
  const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant');
  if (!lastAssistant) {
    postToWebview({ type: 'error', value: '리서치 결과가 아직 없어요.' });
    return;
  }
  mergeRightState(agent.id, { lastResult: lastAssistant.content });
  postToWebview({ type: 'reviewReady', value: lastAssistant.content });
}

async function handleTransferToNext(agent, payload) {
  // Secretary has no output — just move to next
  if (agent.isGuide) {
    const idx = AGENTS.findIndex((a) => a.id === agent.id);
    const next = AGENTS[idx + 1];
    if (next) openCenterPanel(next.id);
    return;
  }

  // Save the right-panel content as the official output, then open next agent
  ensureDir(getResultsDir());
  const outputPath = path.join(getResultsDir(), agent.output);
  const rightState = getRightState(agent.id);

  // Determine what content to save based on agent uiMode
  let content = '';
  if (agent.id === '04_boss') {
    // Boss 2-pane: workCopy = revised slide deck; reviewLog = audit trail
    const workCopy = (payload && payload.workCopy) || rightState.workCopy || '';
    const reviewLog = rightState.reviewLog || [];
    let body = workCopy.trim();
    if (reviewLog.length) {
      body += '\n\n---\n\n## 부장님 검토 이력 (감사용)\n\n';
      reviewLog.forEach((e, i) => {
        const status = e.applied ? '✅ 반영됨' : '⬜ 미반영';
        body += `### ${i + 1}. ${status}\n\n${e.content}\n\n`;
      });
    }
    content = body;
  } else if (agent.uiMode === 'chat-summary') {
    content = payload.summary || rightState.draft || '';
  } else if (agent.uiMode === 'result-rerequest-rightcopy') {
    content = payload.lastResult || rightState.lastResult || '';
  } else if (agent.uiMode === 'editable-md-notes') {
    content = payload.mdContent || '';
    if (payload.notes && payload.notes.length) {
      content += '\n\n---\n\n## 사용자 메모 (사용자가 추가 수정 요청한 사항)\n\n';
      payload.notes.forEach((n, i) => {
        if (n && n.trim()) content += `${i + 1}. ${n.trim()}\n`;
      });
    }
  } else if (agent.uiMode === 'critique-finaldraft' || agent.uiMode === 'plan-rerequest-finaldraft') {
    content = payload.finalDraft || rightState.draft || '';
  }

  if (!content.trim()) {
    postToWebview({ type: 'error', value: '전달할 내용이 없습니다. 먼저 정리/검토를 진행해주세요.' });
    return;
  }

  fs.writeFileSync(outputPath, content, 'utf8');

  // Open the saved file in editor (user can still edit later)
  const doc = await vscode.workspace.openTextDocument(outputPath);
  await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preview: false });

  // Move to next agent
  const idx = AGENTS.findIndex((a) => a.id === agent.id);
  const next = AGENTS[idx + 1];
  if (next) {
    openCenterPanel(next.id);
  } else {
    vscode.window.showInformationMessage(`✓ 마지막 단계 완료. 결과는 ${path.basename(outputPath)}에 저장됨.`);
  }
}

async function openOutputFile(agent) {
  const outputPath = path.join(getResultsDir(), agent.output);
  if (fs.existsSync(outputPath)) {
    const doc = await vscode.workspace.openTextDocument(outputPath);
    await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preview: false });
  }
}

// =============================================================================
// §7  Boss 2-pane handlers (review log + work copy)
// =============================================================================

function genId() {
  return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function ensureBossState(agent, prevContent) {
  const cur = getRightState(agent.id);
  if (!cur.reviewLog) cur.reviewLog = [];
  if (typeof cur.workCopy !== 'string') cur.workCopy = prevContent || '';
  State.rightPanelState[agent.id] = cur;
  persistState();
  return cur;
}

function handlePinReviewLog(agent, content) {
  if (!content || !content.trim()) return;
  const state = ensureBossState(agent, '');
  state.reviewLog.push({
    id: genId(),
    content: content.trim(),
    applied: false,
    appliedAt: null,
    createdAt: Date.now(),
  });
  persistState();
  postToWebview({ type: 'reviewLogUpdated', reviewLog: state.reviewLog });
}

function handleUnapplyReviewLogEntry(agent, entryId) {
  const state = ensureBossState(agent, '');
  const entry = state.reviewLog.find((e) => e.id === entryId);
  if (!entry) return;
  entry.applied = false;
  entry.appliedAt = null;
  persistState();
  postToWebview({ type: 'reviewLogUpdated', reviewLog: state.reviewLog });
}

function handleDeleteReviewLogEntry(agent, entryId) {
  const state = ensureBossState(agent, '');
  state.reviewLog = state.reviewLog.filter((e) => e.id !== entryId);
  persistState();
  postToWebview({ type: 'reviewLogUpdated', reviewLog: state.reviewLog });
}

async function handleApplyReviewLogEntry(agent, entryId) {
  const state = ensureBossState(agent, '');
  const entry = state.reviewLog.find((e) => e.id === entryId);
  if (!entry) {
    postToWebview({ type: 'error', value: '검토 로그 항목을 찾지 못했습니다.' });
    return;
  }
  if (entry.applied) {
    postToWebview({ type: 'error', value: '이미 작업본에 반영된 항목이에요.' });
    return;
  }

  postToWebview({ type: 'status', value: 'applying' });

  const applySystemPrompt =
    '너는 사업소개서 슬라이드 .md를 부장님 검토 의견에 따라 수정하는 편집자다.\n\n' +
    '규칙:\n' +
    '- 입력: (A) 현재 슬라이드 작업본 .md, (B) 적용해야 할 검토 의견 한 건.\n' +
    '- 출력: 검토 의견을 충실히 반영한 새 슬라이드 작업본 .md 전체. 다른 설명·인사 없이 .md 본문만.\n' +
    '- 작업본의 기존 구조 (✅ **목차 — 합의** 표 + ✅ **슬라이드 N: ...** 블록들)는 가능한 한 유지.\n' +
    '- 슬라이드 추가/삭제/순서 변경이 의견에 포함되면 목차 표와 슬라이드 블록 모두 일관되게 갱신.\n' +
    '- 의견과 무관한 부분은 절대 건드리지 마라.\n' +
    '- 출처·인용·데이터는 사라지지 않게 보존.\n' +
    '- 출력은 .md 전문. 주석·메타·요약 X.\n';

  const userMessage =
    `# 현재 슬라이드 작업본 .md\n\n${state.workCopy || '(빈 작업본)'}\n\n---\n\n` +
    `# 적용할 검토 의견\n\n${entry.content}\n\n---\n\n` +
    '위 의견을 반영한 새 작업본 .md 전체를 출력해줘.';

  try {
    const oldWorkCopy = state.workCopy || '';
    const newWorkCopy = await callClaudeChat(applySystemPrompt, [
      { role: 'user', content: userMessage },
    ]);
    const newClean = String(newWorkCopy || '').trim();
    const diff = diffWorkCopies(oldWorkCopy, newClean);
    state.workCopy = newClean;
    state.recentChanges = {
      entryId: entry.id,
      entrySnippet: entry.content.slice(0, 80),
      ...diff,
      at: Date.now(),
    };
    entry.applied = true;
    entry.appliedAt = Date.now();
    persistState();
    postToWebview({
      type: 'workCopyUpdated',
      workCopy: state.workCopy,
      reviewLog: state.reviewLog,
      appliedEntryId: entryId,
      recentChanges: state.recentChanges,
    });
  } catch (err) {
    postToWebview({ type: 'error', value: '작업본 반영 실패: ' + String(err.message || err) });
  }
}

function handleDismissChangeIndicators(agent) {
  const cur = State.rightPanelState[agent.id];
  if (cur) delete cur.recentChanges;
  persistState();
  postToWebview({ type: 'changeIndicatorsCleared' });
}

// =============================================================================
// §8  Webview rendering
// =============================================================================

class SidebarProvider {
  constructor(extensionUri) {
    this.extensionUri = extensionUri;
    this._view = null;
  }

  resolveWebviewView(view) {
    this._view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    view.webview.html = this.renderHtml();
    view.webview.onDidReceiveMessage((msg) => {
      if (msg.type === 'openAgent') openCenterPanel(msg.agentId);
      else if (msg.type === 'refresh') this.refresh();
      else if (msg.type === 'reset') vscode.commands.executeCommand('bizPlanAgent.reset');
      else if (msg.type === 'confirmReset') {
        // Sidebar already showed 2-step inline confirm — skip modal, just wipe.
        // refresh() reloads disk state + re-renders sidebar AND center panel.
        doReset();
        this.refresh();
        // Tell sidebar to reset its confirm state and animate the success
        if (this._view) this._view.webview.postMessage({ type: 'resetDone' });
      }
    });
  }

  refresh() {
    // Hard reload: re-read persisted state from disk (.biz-plan-state.json),
    // then re-render the sidebar (DONE badges) and the open center panel so the
    // on-screen conversation + work artifacts exactly match what's saved on disk.
    // mergeRightState/handleChat persist on every edit, so nothing in-memory is
    // newer than disk — this reload never loses work.
    loadState();
    if (this._view) this._view.webview.html = this.renderHtml();
    if (State.centerPanel && State.currentAgentId) {
      renderCenterPanel(getAgent(State.currentAgentId));
    }
  }

  renderHtml() {
    const agentsState = AGENTS.map((a) => {
      if (a.isGuide) return { ...a, done: false, ready: true };
      const outputPath = path.join(getResultsDir(), a.output);
      const done = fs.existsSync(outputPath);
      // No locking — every agent always clickable. Each can run standalone.
      return { ...a, done, ready: true };
    });

    const html = readFile(path.join(this.extensionUri.fsPath, 'webview', 'sidebar.html'));
    const css = readFile(path.join(this.extensionUri.fsPath, 'webview', 'sidebar.css'));
    const js = readFile(path.join(this.extensionUri.fsPath, 'webview', 'sidebar.js'));
    return html
      .replace('/*CSS*/', css)
      .replace('/*JS*/', js)
      .replace('/*AGENTS*/', JSON.stringify(agentsState));
  }
}

function openCenterPanel(agentId) {
  State.currentAgentId = agentId;
  const agent = getAgent(agentId);
  if (!agent) return;

  // Auto-initialize chat with agent's greeting as first assistant message
  if (!State.chatHistories[agent.id]) State.chatHistories[agent.id] = [];
  if (State.chatHistories[agent.id].length === 0 && agent.greeting) {
    State.chatHistories[agent.id] = [{ role: 'assistant', content: agent.greeting }];
    persistState();
  }

  if (State.centerPanel) {
    State.centerPanel.reveal(vscode.ViewColumn.One);
  } else {
    State.centerPanel = vscode.window.createWebviewPanel(
      'bizPlanAgent.center',
      'Biz Plan Agent',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    State.centerPanel.onDidDispose(() => { State.centerPanel = null; });
    State.centerPanel.webview.onDidReceiveMessage((msg) => handleCenterMessage(msg));
  }

  renderCenterPanel(agent);
}

function renderCenterPanel(agent) {
  if (!State.centerPanel) return;
  const html = readFile(path.join(State.context.extensionUri.fsPath, 'webview', 'center.html'));
  const css = readFile(path.join(State.context.extensionUri.fsPath, 'webview', 'center.css'));
  const js = readFile(path.join(State.context.extensionUri.fsPath, 'webview', 'center.js'));

  const previousOutput = agent.dependsOn
    ? safeRead(path.join(getResultsDir(), agent.dependsOn))
    : '';
  const finalOutput = safeRead(path.join(getResultsDir(), agent.output));
  const history = State.chatHistories[agent.id] || [];

  // Boss: ensure 2-pane state initialized from previous .md (slide agent's output)
  if (agent.id === '04_boss') ensureBossState(agent, previousOutput);

  const rightState = getRightState(agent.id);

  State.centerPanel.title = `${agent.emoji} ${agent.label}`;
  const resultsDir = getResultsDir();
  const customDir = State.context ? State.context.globalState.get('customResultsDir') : null;
  State.centerPanel.webview.html = html
    .replace('/*CSS*/', css)
    .replace('/*JS*/', js)
    .replace('/*AGENT*/', JSON.stringify(agent))
    .replace('/*PREV*/', JSON.stringify(previousOutput))
    .replace('/*FINAL*/', JSON.stringify(finalOutput))
    .replace('/*HISTORY*/', JSON.stringify(history))
    .replace('/*RIGHT_STATE*/', JSON.stringify(rightState))
    .replace('/*RESULTS_DIR*/', JSON.stringify({ path: resultsDir, isCustom: !!customDir }));
}

// =============================================================================
// §9  Message router (webview → extension)
// =============================================================================

async function handleCenterMessage(msg) {
  const agent = getAgent(State.currentAgentId);
  if (!agent) return;

  switch (msg.type) {
    case 'chat':
      await handleChat(agent, msg.text, msg.attachments);
      break;
    case 'finalize':
      await handleFinalize(agent);
      break;
    case 'reviewLast':
      handleReviewLast(agent);
      break;
    case 'transferToNext':
      await handleTransferToNext(agent, msg.payload);
      break;
    case 'updateRightState':
      mergeRightState(agent.id, msg.state || {});
      break;
    case 'pinReviewLog':
      handlePinReviewLog(agent, msg.content);
      break;
    case 'applyReviewLogEntry':
      await handleApplyReviewLogEntry(agent, msg.entryId);
      break;
    case 'unapplyReviewLogEntry':
      handleUnapplyReviewLogEntry(agent, msg.entryId);
      break;
    case 'deleteReviewLogEntry':
      handleDeleteReviewLogEntry(agent, msg.entryId);
      break;
    case 'dismissChangeIndicators':
      handleDismissChangeIndicators(agent);
      break;
    case 'openFile':
      await openOutputFile(agent);
      break;
    case 'selectFolder':
      vscode.commands.executeCommand('bizPlanAgent.selectFolder');
      break;
    // (deprecated message types removed: 'next', 'clearChat', 'reset' — the
    // UI elements that triggered them have been removed. Reset is still
    // available as a command palette command.)
  }
}

// =============================================================================
// §10 Extension lifecycle
// =============================================================================

function registerCommands(context, provider) {
  context.subscriptions.push(
    vscode.commands.registerCommand('bizPlanAgent.openAgent', (agentId) => {
      openCenterPanel(agentId);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bizPlanAgent.selectFolder', async () => {
      const picked = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: '결과물 저장 폴더 선택',
        title: 'Biz Plan Agent — 산출물(.md) 저장 폴더 선택',
      });
      if (picked && picked[0]) {
        const fsPath = picked[0].fsPath;
        await context.globalState.update('customResultsDir', fsPath);
        vscode.window.showInformationMessage(`산출물 저장 폴더: ${fsPath}`);
        // refresh() reloads that folder's .biz-plan-state.json (or blank slate)
        // and re-renders the sidebar + open center panel.
        provider.refresh();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bizPlanAgent.reset', async () => {
      // Command palette entry still uses native modal (2-step is sidebar-only)
      const confirm = await vscode.window.showWarningMessage(
        'Reset all pipeline results & chat history?',
        { modal: true }, 'Reset'
      );
      if (confirm !== 'Reset') return;
      doReset();
      provider.refresh(); // reloads disk state + re-renders sidebar & center panel
      vscode.window.showInformationMessage('Pipeline reset.');
    })
  );
}

function activate(context) {
  State.context = context;
  loadState();
  const provider = new SidebarProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('bizPlanAgent.sidebar', provider)
  );

  registerCommands(context, provider);
}

function deactivate() {}

module.exports = { activate, deactivate };
