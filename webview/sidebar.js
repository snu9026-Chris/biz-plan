const vscode = acquireVsCodeApi();
const root = document.getElementById('agents');

function statusOf(a) {
  if (a.done) return { cls: 'done', text: 'DONE' };
  if (a.ready) return { cls: 'ready', text: 'READY' };
  return { cls: 'locked', text: 'LOCKED' };
}

function getHeadSvg(charKey) {
  const c = CHARACTERS && CHARACTERS[charKey];
  if (!c || !c.svg) return '';
  // Crop viewBox to face/head area (was 0 0 120 160 → now 22 14 76 76)
  return c.svg.replace(/viewBox="[^"]*"/, 'viewBox="22 14 76 76"');
}

function render() {
  root.innerHTML = '';
  AGENTS.forEach((a, i) => {
    const s = statusOf(a);
    const card = document.createElement('div');
    card.className = 'card' + (a.done ? ' done' : '') + (!a.ready ? ' locked' : '');
    card.style.setProperty('--char-color', a.color || '');
    card.style.setProperty('--char-bg', a.bgColor || '');
    const headSvg = getHeadSvg(a.id) || `<span class="avatar-emoji-fallback">${a.emoji}</span>`;
    card.innerHTML = `
      <div class="avatar" style="--char-color: ${a.color}; --char-bg: ${a.bgColor};">
        ${headSvg}
        <div class="avatar-glow" style="border-color: ${a.color};">${a.accessory || '✦'}</div>
      </div>
      <div class="body">
        <div class="row1">
          <span class="step">${String(i + 1).padStart(2, '0')}</span>
          <span class="label">${a.label}</span>
        </div>
        <div class="role">${a.role}</div>
      </div>
      <span class="status ${s.cls}">${s.text}</span>
    `;
    if (a.ready) {
      card.addEventListener('click', () => {
        vscode.postMessage({ type: 'openAgent', agentId: a.id });
        switchMascot(a.id);
      });
    }
    root.appendChild(card);
  });
}

document.getElementById('refresh').addEventListener('click', () => {
  vscode.postMessage({ type: 'refresh' });
});
document.getElementById('reset').addEventListener('click', () => {
  vscode.postMessage({ type: 'reset' });
});

// ===== Character mascots (SVG art + cycling dialogue) =====

const CHARACTERS = {
  '00_secretary': {
    color: '#a78bfa',
    title: '비서',
    dialogues: [
      '<strong>비서</strong>안녕하세요! 우측에 사용 가이드를 띄워뒀어요. 5단계 흐름 한 번 보고 시작하세요.',
      '<strong>다 보셨나요?</strong>"과장님과 시작하기 →" 버튼 누르면 1단계 검증부터 갑니다.',
      '<strong>도움이 필요하면</strong>좌측 카드의 비서를 다시 눌러주세요. 언제든 가이드 다시 띄워드려요.',
    ],
    svg: `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="60" cy="155" rx="22" ry="3" fill="rgba(0,0,0,0.1)"/>
      <!-- Blouse (lavender) -->
      <path d="M30,98 L48,86 L72,86 L90,98 L92,150 L28,150 Z" fill="#a78bfa"/>
      <!-- Inner blouse white -->
      <path d="M48,86 L60,103 L72,86 L66,86 L60,96 L54,86 Z" fill="white"/>
      <!-- Bow tie (gold) -->
      <path d="M52,103 L60,98 L68,103 L66,109 L60,107 L54,109 Z" fill="#fbbf24"/>
      <circle cx="60" cy="103" r="2" fill="#f59e0b"/>
      <!-- Belt -->
      <rect x="28" y="124" width="64" height="4" fill="#7c3aed"/>
      <rect x="56" y="123" width="8" height="6" fill="#fbbf24"/>
      <!-- Neck -->
      <rect x="55" y="76" width="10" height="14" fill="#fcd9a8"/>
      <!-- Head -->
      <circle cx="60" cy="55" r="26" fill="#fcd9a8" stroke="#a16e3f" stroke-width="0.5"/>
      <!-- Hair (back) -->
      <path d="M34,52 Q34,28 60,26 Q86,28 86,52 Q82,38 76,34 Q68,30 60,30 Q52,30 44,34 Q38,38 34,52 Z" fill="#451a03"/>
      <!-- Bun on top -->
      <ellipse cx="60" cy="22" rx="11" ry="7" fill="#451a03"/>
      <ellipse cx="60" cy="20" rx="11" ry="6" fill="#5b1f06"/>
      <!-- Hair pin -->
      <circle cx="68" cy="22" r="2" fill="#fbbf24"/>
      <!-- Headset arc -->
      <path d="M32,40 Q60,16 88,40" stroke="#1f2937" stroke-width="2.5" fill="none"/>
      <!-- Headset earpieces -->
      <ellipse cx="32" cy="44" rx="3" ry="5" fill="#1f2937"/>
      <ellipse cx="88" cy="44" rx="3" ry="5" fill="#1f2937"/>
      <circle cx="32" cy="44" r="1.5" fill="#a78bfa"/>
      <circle cx="88" cy="44" r="1.5" fill="#a78bfa"/>
      <!-- Microphone arm -->
      <path d="M88,48 Q92,55 86,68" stroke="#1f2937" stroke-width="1.5" fill="none"/>
      <circle cx="86" cy="68" r="2.5" fill="#1f2937"/>
      <circle cx="86" cy="68" r="1" fill="#fb7185"/>
      <!-- Glasses (light frame) -->
      <circle cx="50" cy="55" r="6" stroke="#1f2937" stroke-width="1.2" fill="rgba(255,255,255,0.5)"/>
      <circle cx="70" cy="55" r="6" stroke="#1f2937" stroke-width="1.2" fill="rgba(255,255,255,0.5)"/>
      <line x1="56" y1="55" x2="64" y2="55" stroke="#1f2937" stroke-width="1.2"/>
      <!-- Eyes (welcoming, slight curve) -->
      <path d="M47,55 Q50,58 53,55" stroke="#1f2937" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M67,55 Q70,58 73,55" stroke="#1f2937" stroke-width="2" fill="none" stroke-linecap="round"/>
      <!-- Eyelashes -->
      <line x1="48" y1="53" x2="47" y2="51" stroke="#1f2937" stroke-width="0.8"/>
      <line x1="52" y1="52" x2="52" y2="50" stroke="#1f2937" stroke-width="0.8"/>
      <line x1="68" y1="52" x2="68" y2="50" stroke="#1f2937" stroke-width="0.8"/>
      <line x1="72" y1="53" x2="73" y2="51" stroke="#1f2937" stroke-width="0.8"/>
      <!-- Mouth (warm welcoming smile) -->
      <path d="M52,68 Q60,74 68,68" stroke="#dc2626" stroke-width="2" fill="#fb7185" stroke-linecap="round"/>
      <!-- Cheeks (rosy) -->
      <ellipse cx="40" cy="65" rx="3.5" ry="2.5" fill="#fb7185" opacity="0.4"/>
      <ellipse cx="80" cy="65" rx="3.5" ry="2.5" fill="#fb7185" opacity="0.4"/>
      <!-- Earrings -->
      <circle cx="34" cy="62" r="1.5" fill="#fbbf24"/>
      <circle cx="86" cy="62" r="1.5" fill="#fbbf24"/>
      <!-- Clipboard in hand -->
      <rect x="18" y="115" width="16" height="20" fill="#fef3c7" stroke="#d97706" stroke-width="1" rx="1"/>
      <rect x="22" y="113" width="8" height="3" fill="#a16207" rx="0.5"/>
      <line x1="20" y1="120" x2="32" y2="120" stroke="#d97706" stroke-width="0.6"/>
      <line x1="20" y1="124" x2="32" y2="124" stroke="#d97706" stroke-width="0.6"/>
      <line x1="20" y1="128" x2="30" y2="128" stroke="#d97706" stroke-width="0.6"/>
      <line x1="20" y1="132" x2="28" y2="132" stroke="#d97706" stroke-width="0.6"/>
    </svg>`,
  },

  '01_manager': {
    color: '#f59e0b',
    title: '과장님',
    dialogues: [
      '<strong>과장님</strong>준비가 아직 철저히 안 됐군. 나랑 같이 들여다보자구~',
      '<strong>옵션 1</strong>이미 정리한 자료 있으면 위 채팅창에 첨부하시고요.',
      '<strong>옵션 2</strong>그냥 사업 아이템부터 던져도 됩니다. 11개 질문 같이 갑시다.',
    ],
    svg: `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="60" cy="155" rx="24" ry="3" fill="rgba(0,0,0,0.1)"/>
      <!-- Suit body -->
      <path d="M32,98 L48,86 L72,86 L88,98 L92,150 L28,150 Z" fill="#475569"/>
      <!-- Lapels -->
      <path d="M48,86 L60,100 L52,120 L42,108 Z" fill="#334155"/>
      <path d="M72,86 L60,100 L68,120 L78,108 Z" fill="#334155"/>
      <!-- Shirt -->
      <path d="M55,86 L65,86 L60,102 Z" fill="white"/>
      <!-- Tie -->
      <path d="M58,90 L62,90 L63,108 L60,135 L57,108 Z" fill="#dc2626"/>
      <!-- Neck -->
      <rect x="55" y="76" width="10" height="14" fill="#fcd9a8"/>
      <!-- Head -->
      <circle cx="60" cy="55" r="26" fill="#fcd9a8" stroke="#a16e3f" stroke-width="0.5"/>
      <!-- Hair -->
      <path d="M34,52 Q34,30 60,28 Q86,30 86,52 Q86,42 78,38 Q72,32 60,32 Q48,32 42,38 Q34,42 34,52 Z" fill="#1f2937"/>
      <!-- Glasses -->
      <circle cx="50" cy="55" r="6.5" stroke="#1f2937" stroke-width="1.5" fill="rgba(255,255,255,0.6)"/>
      <circle cx="70" cy="55" r="6.5" stroke="#1f2937" stroke-width="1.5" fill="rgba(255,255,255,0.6)"/>
      <line x1="56.5" y1="55" x2="63.5" y2="55" stroke="#1f2937" stroke-width="1.5"/>
      <!-- Eyes -->
      <circle cx="50" cy="56" r="1.5" fill="#1f2937"/>
      <circle cx="70" cy="56" r="1.5" fill="#1f2937"/>
      <!-- Eyebrows (slightly raised — questioning) -->
      <path d="M44,46 L55,45" stroke="#1f2937" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M65,45 L76,46" stroke="#1f2937" stroke-width="1.5" stroke-linecap="round"/>
      <!-- Mustache -->
      <path d="M52,67 Q56,69 60,68 Q64,69 68,67" stroke="#1f2937" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <!-- Mouth (slight pursed) -->
      <path d="M55,73 L65,73" stroke="#1f2937" stroke-width="1.5" stroke-linecap="round"/>
      <!-- Pocket square hint -->
      <rect x="45" y="105" width="6" height="3" fill="#dc2626"/>
    </svg>`,
  },

  '02_researcher': {
    color: '#34d399',
    title: '리서처',
    dialogues: [
      '<strong>리서처</strong>과장님 결과 받았어요. 인터넷에서 객관적 자료 모아올게요.',
      '<strong>마음에 안 들면</strong>밑 채팅창에 "다른 각도로 다시" 같이 요청하세요.',
      '<strong>검토하기 누르면</strong>마지막 결과만 우측에 복사돼요. 그게 슬라이드로 갑니다.',
    ],
    svg: `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="60" cy="155" rx="22" ry="3" fill="rgba(0,0,0,0.1)"/>
      <!-- Lab coat -->
      <path d="M30,98 L50,86 L70,86 L90,98 L94,150 L26,150 Z" fill="#f9fafb" stroke="#d1d5db" stroke-width="1"/>
      <!-- Coat opening -->
      <line x1="60" y1="86" x2="60" y2="150" stroke="#d1d5db" stroke-width="1"/>
      <!-- Inner shirt -->
      <path d="M50,86 L70,86 L65,100 L55,100 Z" fill="#34d399"/>
      <!-- Pocket -->
      <rect x="68" y="108" width="14" height="12" fill="none" stroke="#d1d5db" stroke-width="1" rx="1"/>
      <line x1="71" y1="108" x2="71" y2="120" stroke="#34d399" stroke-width="2"/>
      <!-- Neck -->
      <rect x="55" y="76" width="10" height="14" fill="#fcd9a8"/>
      <!-- Head -->
      <circle cx="60" cy="55" r="26" fill="#fcd9a8" stroke="#a16e3f" stroke-width="0.5"/>
      <!-- Hair (curly) -->
      <path d="M34,50 Q34,28 60,26 Q86,28 86,50 Q82,38 74,34 Q68,30 60,30 Q52,30 46,34 Q38,38 34,50 Z" fill="#7c2d12"/>
      <circle cx="40" cy="42" r="4" fill="#7c2d12"/>
      <circle cx="80" cy="42" r="4" fill="#7c2d12"/>
      <!-- Glasses (round) -->
      <circle cx="50" cy="55" r="7" stroke="#1f2937" stroke-width="1.5" fill="rgba(255,255,255,0.5)"/>
      <circle cx="70" cy="55" r="7" stroke="#1f2937" stroke-width="1.5" fill="rgba(255,255,255,0.5)"/>
      <line x1="57" y1="55" x2="63" y2="55" stroke="#1f2937" stroke-width="1.5"/>
      <!-- Eyes (curious, wider) -->
      <circle cx="50" cy="55" r="2" fill="#1f2937"/>
      <circle cx="70" cy="55" r="2" fill="#1f2937"/>
      <circle cx="50.5" cy="54.5" r="0.7" fill="white"/>
      <circle cx="70.5" cy="54.5" r="0.7" fill="white"/>
      <!-- Mouth (slight smile) -->
      <path d="M54,69 Q60,73 66,69" stroke="#1f2937" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <!-- Magnifying glass in hand -->
      <circle cx="98" cy="118" r="8" fill="rgba(52,211,153,0.15)" stroke="#10b981" stroke-width="2"/>
      <line x1="104" y1="124" x2="111" y2="131" stroke="#7c2d12" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`,
  },

  '03_slide_agent': {
    color: '#38bdf8',
    title: '에이스 팀원',
    dialogues: [
      '<strong>에이스 팀원</strong>리서치 잘 받았어요. Guide A 기반으로 슬라이드 한 장씩 같이 만들어볼게요.',
      '<strong>한 장씩 진행</strong>표지 → 문제 → 솔루션 → 차별점 → 시장... 한 장 끝날 때마다 ✅ 정리 emit.',
      '<strong>📌 우측 추가</strong>각 슬라이드 정리에 📌 누르면 우측 슬라이드 .md에 누적돼요.',
    ],
    svg: `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="60" cy="155" rx="22" ry="3" fill="rgba(0,0,0,0.1)"/>
      <!-- Sweater -->
      <path d="M32,98 L48,86 L72,86 L88,98 L90,150 L30,150 Z" fill="#38bdf8"/>
      <!-- Sweater pattern -->
      <line x1="40" y1="115" x2="80" y2="115" stroke="#0284c7" stroke-width="0.8"/>
      <line x1="38" y1="130" x2="82" y2="130" stroke="#0284c7" stroke-width="0.8"/>
      <!-- Collar -->
      <path d="M52,86 L60,93 L68,86" fill="white" stroke="#e0f2fe" stroke-width="1"/>
      <!-- Neck -->
      <rect x="55" y="76" width="10" height="14" fill="#fcd9a8"/>
      <!-- Head -->
      <circle cx="60" cy="55" r="26" fill="#fcd9a8" stroke="#a16e3f" stroke-width="0.5"/>
      <!-- Hair (short side-parted) -->
      <path d="M36,50 Q40,28 60,26 Q82,28 84,52 Q82,40 76,38 L66,42 L58,38 Q44,38 38,46 Q34,46 36,50 Z" fill="#3a2218"/>
      <!-- Eyes (focused) -->
      <ellipse cx="50" cy="56" rx="2" ry="1.5" fill="#1f2937"/>
      <ellipse cx="70" cy="56" rx="2" ry="1.5" fill="#1f2937"/>
      <!-- Eyebrows -->
      <path d="M44,49 L55,48" stroke="#3a2218" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M65,48 L76,49" stroke="#3a2218" stroke-width="1.8" stroke-linecap="round"/>
      <!-- Mouth (concentrated) -->
      <path d="M55,69 Q60,71 65,69" stroke="#1f2937" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <!-- Pencil behind ear -->
      <rect x="83" y="50" width="14" height="3" fill="#fbbf24" transform="rotate(-25 90 51)"/>
      <polygon points="83,50 79,51.5 83,53" fill="#1f2937" transform="rotate(-25 90 51)"/>
      <!-- Ruler in hand -->
      <rect x="22" y="115" width="22" height="6" fill="#fbbf24" stroke="#d97706" stroke-width="0.8"/>
      <line x1="26" y1="115" x2="26" y2="118" stroke="#1f2937" stroke-width="0.5"/>
      <line x1="32" y1="115" x2="32" y2="119" stroke="#1f2937" stroke-width="0.5"/>
      <line x1="38" y1="115" x2="38" y2="118" stroke="#1f2937" stroke-width="0.5"/>
    </svg>`,
  },

  '04_boss': {
    color: '#6366f1',
    title: '부장님',
    dialogues: [
      '<strong>부장님</strong>흠... 어디 한 번 가져와봐. 가차없이 까줄 테니까.',
      '<strong>9개 사고 원칙으로</strong>전제·실패역산·10x·focus·proxy 다 짚을 거야.',
      '<strong>최종본 만들기</strong>비판 다 받고 정리하면 디자이너한테 넘긴다.',
    ],
    svg: `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="60" cy="155" rx="24" ry="3" fill="rgba(0,0,0,0.12)"/>
      <!-- Power suit -->
      <path d="M30,98 L48,84 L72,84 L90,98 L94,150 L26,150 Z" fill="#1e1b3a"/>
      <!-- Dark lapels -->
      <path d="M48,84 L60,100 L50,124 L40,108 Z" fill="#0f0e21"/>
      <path d="M72,84 L60,100 L70,124 L80,108 Z" fill="#0f0e21"/>
      <!-- Shirt -->
      <path d="M55,84 L65,84 L60,102 Z" fill="#e5e7eb"/>
      <!-- Tie (dark navy with stripe) -->
      <path d="M58,88 L62,88 L63,110 L60,135 L57,110 Z" fill="#312e6b"/>
      <line x1="59" y1="95" x2="61" y2="120" stroke="#6366f1" stroke-width="0.5"/>
      <!-- Pocket square -->
      <rect x="44" y="103" width="7" height="4" fill="white"/>
      <!-- Neck -->
      <rect x="55" y="74" width="10" height="14" fill="#e8b890"/>
      <!-- Head -->
      <circle cx="60" cy="53" r="26" fill="#e8b890" stroke="#8b6240" stroke-width="0.5"/>
      <!-- Hair (gray, slicked back) -->
      <path d="M34,48 Q36,28 60,26 Q84,28 86,48 Q86,40 80,36 Q70,30 60,30 Q50,30 40,36 Q34,40 34,48 Z" fill="#52525b"/>
      <!-- Gray temples -->
      <ellipse cx="36" cy="50" rx="3" ry="6" fill="#a1a1aa"/>
      <ellipse cx="84" cy="50" rx="3" ry="6" fill="#a1a1aa"/>
      <!-- Glasses (rectangular, stern) -->
      <rect x="42" y="50" width="14" height="9" stroke="#1f2937" stroke-width="1.5" fill="rgba(255,255,255,0.5)" rx="1"/>
      <rect x="64" y="50" width="14" height="9" stroke="#1f2937" stroke-width="1.5" fill="rgba(255,255,255,0.5)" rx="1"/>
      <line x1="56" y1="54.5" x2="64" y2="54.5" stroke="#1f2937" stroke-width="1.5"/>
      <!-- Eyes (sharp) -->
      <line x1="46" y1="55" x2="52" y2="55" stroke="#1f2937" stroke-width="2" stroke-linecap="round"/>
      <line x1="68" y1="55" x2="74" y2="55" stroke="#1f2937" stroke-width="2" stroke-linecap="round"/>
      <!-- Eyebrows (frowning) -->
      <path d="M42,46 L54,44" stroke="#3f3f46" stroke-width="2" stroke-linecap="round"/>
      <path d="M66,44 L78,46" stroke="#3f3f46" stroke-width="2" stroke-linecap="round"/>
      <!-- Mouth (firm line) -->
      <path d="M52,71 L68,71" stroke="#1f2937" stroke-width="1.8" stroke-linecap="round"/>
      <!-- Slight wrinkle -->
      <path d="M50,40 Q56,38 60,40" stroke="#a16e3f" stroke-width="0.5" fill="none" opacity="0.5"/>
    </svg>`,
  },

  '05_designer': {
    color: '#f472b6',
    title: '디자이너',
    dialogues: [
      '<strong>디자이너</strong>드디어 나왔네! 톤·레퍼런스·시각 방향 같이 잡아봐요.',
      '<strong>Part 0 4질문</strong>청자·브랜드·도메인·사용처 정하면 매칭표 적용~',
      '<strong>최종 .md 추출</strong>Claude Design에 그대로 던질 수 있는 프롬프트 나와요.',
    ],
    svg: `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="60" cy="155" rx="22" ry="3" fill="rgba(0,0,0,0.1)"/>
      <!-- Trendy top -->
      <path d="M30,100 L48,86 L72,86 L90,100 L88,150 L32,150 Z" fill="#1f1f23"/>
      <!-- Sleeve detail -->
      <ellipse cx="32" cy="105" rx="6" ry="4" fill="#3f3f46"/>
      <ellipse cx="88" cy="105" rx="6" ry="4" fill="#3f3f46"/>
      <!-- Collar (statement V-neck) -->
      <path d="M50,86 L60,103 L70,86 L65,86 L60,96 L55,86 Z" fill="#fef3c7"/>
      <!-- Pin/jewelry -->
      <circle cx="55" cy="115" r="2" fill="#f472b6"/>
      <!-- Neck -->
      <rect x="55" y="76" width="10" height="14" fill="#fcd9a8"/>
      <!-- Head -->
      <circle cx="60" cy="55" r="26" fill="#fcd9a8" stroke="#a16e3f" stroke-width="0.5"/>
      <!-- Long hair flowing -->
      <path d="M34,52 Q30,80 36,95 L42,90 L40,72 Q38,60 38,52 Z" fill="#451a03"/>
      <path d="M86,52 Q90,80 84,95 L78,90 L80,72 Q82,60 82,52 Z" fill="#451a03"/>
      <path d="M34,46 Q34,28 60,26 Q86,28 86,46 Q86,38 80,34 Q70,28 60,28 Q50,28 40,34 Q34,38 34,46 Z" fill="#451a03"/>
      <!-- Beret (pink) -->
      <ellipse cx="60" cy="30" rx="22" ry="8" fill="#f472b6"/>
      <ellipse cx="60" cy="28" rx="22" ry="8" fill="#ec4899"/>
      <circle cx="74" cy="26" r="3" fill="#9d174d"/>
      <!-- Big round glasses -->
      <circle cx="50" cy="55" r="9" stroke="#1f2937" stroke-width="1.8" fill="rgba(255,255,255,0.4)"/>
      <circle cx="70" cy="55" r="9" stroke="#1f2937" stroke-width="1.8" fill="rgba(255,255,255,0.4)"/>
      <line x1="59" y1="55" x2="61" y2="55" stroke="#1f2937" stroke-width="1.8"/>
      <!-- Eyes (creative spark) -->
      <circle cx="50" cy="55" r="2" fill="#1f2937"/>
      <circle cx="70" cy="55" r="2" fill="#1f2937"/>
      <circle cx="50.5" cy="54" r="0.8" fill="white"/>
      <circle cx="70.5" cy="54" r="0.8" fill="white"/>
      <!-- Lips (creative smile) -->
      <path d="M54,70 Q60,75 66,70" stroke="#dc2626" stroke-width="2" fill="#fb7185" stroke-linecap="round"/>
      <!-- Earring -->
      <circle cx="34" cy="58" r="1.5" fill="#f472b6"/>
      <circle cx="86" cy="58" r="1.5" fill="#f472b6"/>
      <!-- Paint palette in hand -->
      <ellipse cx="22" cy="120" rx="9" ry="7" fill="#fef3c7" stroke="#d4a574" stroke-width="0.8"/>
      <circle cx="19" cy="118" r="1.5" fill="#dc2626"/>
      <circle cx="24" cy="116" r="1.5" fill="#3b82f6"/>
      <circle cx="22" cy="123" r="1.5" fill="#10b981"/>
      <circle cx="26" cy="122" r="1.5" fill="#f59e0b"/>
    </svg>`,
  },
};

// ===== Mascot state =====
let currentMascot = '00_secretary';
let dialogueIdx = 0;
let dialogueTimer = null;

const figureEl = document.getElementById('mascot-figure');
const bubbleEl = document.getElementById('mascot-bubble');
const bubbleTextEl = document.getElementById('bubble-text');
const closeBtn = document.getElementById('bubble-close');

function setMascotSVG(charKey) {
  const c = CHARACTERS[charKey];
  if (!c) return;
  figureEl.innerHTML = c.svg;
  // Update char-color CSS variable for the bubble
  bubbleEl.style.setProperty('--char-color', c.color);
}

function setBubbleText(html) {
  bubbleEl.classList.add('fading-text');
  setTimeout(() => {
    bubbleTextEl.innerHTML = html;
    bubbleEl.classList.remove('fading-text');
  }, 180);
}

function startCycling(charKey) {
  const c = CHARACTERS[charKey];
  if (!c) return;
  if (dialogueTimer) clearInterval(dialogueTimer);
  dialogueIdx = 0;
  bubbleTextEl.innerHTML = c.dialogues[0];
  if (c.dialogues.length > 1) {
    dialogueTimer = setInterval(() => {
      dialogueIdx = (dialogueIdx + 1) % c.dialogues.length;
      setBubbleText(c.dialogues[dialogueIdx]);
    }, 5000);
  }
}

function switchMascot(charKey) {
  currentMascot = charKey;
  setMascotSVG(charKey);
  bubbleEl.classList.add('show');
  startCycling(charKey);
}

// Init: secretary
switchMascot('00_secretary');

// Toggle bubble on figure click
figureEl.addEventListener('click', () => {
  bubbleEl.classList.toggle('show');
});

closeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  bubbleEl.classList.remove('show');
});

render();
