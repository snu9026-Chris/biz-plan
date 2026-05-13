# Biz Plan Agent — Setup Guide

다른 컴퓨터에서 이 레포만 클론해서 바로 쓰기 위한 셋업 가이드.

---

## 0. 익스텐션 개요 (30초)

VS Code / Antigravity 익스텐션. 사업소개서를 6명의 캐릭터 (비서 → 과장님 → 리서처 → 에이스 팀원 → 부장님 → 디자이너) 파이프라인으로 만들어 Claude Design 입력용 `.md`까지 추출.

각 단계 결과물은 `.md` 파일로 저장 → 다음 캐릭터가 받아 작업 → 누적.

---

## 1. 사전 요구사항

| 항목 | 최소 버전 | 설치 확인 |
|---|---|---|
| **Node.js** | 18+ (권장 20+) | `node -v` |
| **npm** | 9+ | `npm -v` |
| **Git** | any | `git --version` |
| **VS Code** 또는 **Antigravity** (또는 VS Code 호환 IDE) | VS Code 1.85+ | — |

### Claude 인증 (둘 중 하나 필요)

**Option A — Claude Code 구독 (권장, 토큰 부담 0)**
- [Claude Code CLI](https://docs.claude.com/en/docs/claude-code) 설치 + 로그인 완료된 상태여야 함
- 익스텐션이 `@anthropic-ai/claude-agent-sdk`를 통해 구독 토큰을 자동 사용
- 별도 API 키 입력 불필요

**Option B — Anthropic API 키 (per-token 과금)**
- [console.anthropic.com](https://console.anthropic.com) 에서 API 키 발급
- 익스텐션 설정에 키 입력 (아래 §4 참조)

---

## 2. 클론 + 의존성 설치

```bash
git clone <repo-url> biz-plan-extension
cd biz-plan-extension
npm install
```

`npm install` 후 `node_modules/` 폴더가 생성되어야 함. 약 30초~1분 소요.

설치되는 핵심 패키지:
- `@anthropic-ai/claude-agent-sdk` — Claude Code 구독 인증용
- `@anthropic-ai/sdk` — API 키 인증용 (fallback)
- `@types/vscode` — 타입 정의
- `@vscode/vsce` — `.vsix` 패키징용 (선택)

---

## 3. 에디터에서 열기 + 실행

### VS Code / Antigravity

1. **`biz-plan-extension` 폴더를 워크스페이스로 열기**
   - `extension.js`, `prompts/`, `webview/`가 루트에 보여야 함
   - 만약 상위 폴더를 잘못 열면 F5가 작동 안 함
2. **F5 누르기** → "Run Extension" 디버그 설정 자동 실행
3. **Extension Development Host** 라는 새 창이 뜸 — 여기가 실제 익스텐션 동작 환경
4. 잠시 후 비서 캐릭터가 자동으로 가운데 뜸. 좌측 사이드바 액티비티 바에 🚀 아이콘 (Biz Plan Agent) 보임.

### Antigravity 특이사항

Antigravity는 VS Code 호환이라 동일하게 F5로 작동. 단:
- `Run and Debug` 사이드바를 한 번 열어두면 F5가 더 안정적으로 잡힘
- `launch.json`은 레포에 이미 포함되어 있음 (`.vscode/launch.json`)

---

## 4. 익스텐션 설정 (첫 실행 시)

Extension Development Host 새 창에서:

**`Ctrl/Cmd + ,`** → 검색창에 **"biz plan"** 입력 → 다음 4개 설정 확인:

| 설정 키 | 기본값 | 설명 |
|---|---|---|
| `bizPlanAgent.useClaudeCodeAuth` | `true` | **Claude Code 구독 쓰면 true (권장)** |
| `bizPlanAgent.anthropicApiKey` | `""` | API 키 쓰면 여기 입력. `useClaudeCodeAuth=false`로 같이 바꿔야 함 |
| `bizPlanAgent.model` | `claude-opus-4-7` | 모델 ID. 변경 시 정확한 ID 사용 |
| `bizPlanAgent.workspaceFolder` | `biz-plan-results` | 산출물 .md 저장될 워크스페이스 하위 폴더 이름 (비서가 별도 폴더 선택하면 그게 우선) |

**대부분의 경우 `useClaudeCodeAuth=true` 그대로 두고 시작**.

---

## 5. 폴더 선택 (산출물 저장 위치)

첫 비서 화면 우측 패널에 "📁 결과물 저장 폴더" 박스가 보임:
- **선택 안 하면**: 현재 워크스페이스 루트 안에 `biz-plan-results/` 폴더 자동 생성하고 거기 저장
- **`📁 폴더 선택` 클릭**: 임의 폴더 지정 (전역 저장됨, 다음에 또 안 물어봄)

각 단계가 끝날 때마다 `01_decision_brief.md`, `02_research_data.md`, ... 가 이 폴더에 저장됨. 나중에 안티그래비티에서 직접 편집·복사 가능.

---

## 6. 첫 사이클 돌려보기 (스모크 테스트)

설치 후 실제 동작 검증:

1. 비서 우측에서 폴더 선택 → `과장님과 시작하기 →`
2. 과장님이 사업 용도를 물음 → 아무 사업 아이템 한 줄 입력 (예: "건설 PM SaaS / 시드 IR")
3. 11문답 진행 → 각 ✅ 정리에 `📌 우측 추가` 누르면 우측에 누적
4. `리서처한테 넘기기 →` → 02 단계로 자동 인계
5. 리서처가 검색 → 카드 결과에 📌 누르면 누적 → `에이스 팀원에게 넘기기 →`
6. 에이스 → 부장님 → 디자이너까지 진행

각 단계 정상 작동하면 셋업 완료.

---

## 7. 트러블슈팅

### F5 눌렀는데 새 창이 안 뜸
- `launch.json`이 `.vscode/launch.json`에 있는지 확인
- 워크스페이스가 `biz-plan-extension` 루트인지 확인 (상위 폴더 X)
- 명령 팔레트 (`Ctrl+Shift+P`) → "Debug: Start Debugging" 수동 시도

### 사이드바에 익스텐션이 안 보임
- Extension Development Host 새 창의 좌측 액티비티 바에 🚀 아이콘 찾기
- 없으면 명령 팔레트 → "Biz Plan: Open Agent" 입력해서 수동 활성화

### AI 호출에서 에러 (`No API key set...`)
- `useClaudeCodeAuth=true`인 경우: Claude Code CLI가 설치 및 로그인 되어 있는지
- `useClaudeCodeAuth=false`인 경우: `anthropicApiKey` 채웠는지
- 두 경우 모두 안 되면 → 익스텐션 설정 다시 확인 (`Ctrl/Cmd+,`)

### `Cannot find module '@anthropic-ai/claude-agent-sdk'`
- `npm install`을 안 했거나 `node_modules`가 손상됨
- 해결: `rm -rf node_modules package-lock.json && npm install`

### 콘솔에 에러가 보이는데 안 잡힘
- Extension Development Host 창에서 `Help > Toggle Developer Tools` → Console 탭 (웹뷰 에러)
- 메인 에디터 창에서 `View > Output > Drop-down → "Extension Host"` (extension.js 에러)

### 한국어가 깨져 보임
- 시스템 폰트 문제. 안티그래비티는 보통 알아서 해결. 안 되면 시스템 폰트에 한글 폰트 (Pretendard / Noto Sans KR / 맑은 고딕) 깔려있는지

### 부장님 `[✓ 작업본 반영]` 후 빈 .md 또는 깨진 출력
- AI 응답이 가끔 빈 문자열을 반환하거나 잘못된 형식으로 옴
- `[↺ 반영 표시 해제]` 눌러 entry 복구 후 다시 시도
- 작업본이 완전히 망가졌으면 우측 `📝 직접 편집` 토글로 raw markdown 직접 수정

---

## 8. 다른 컴퓨터로 옮길 때

이 레포를 다른 컴퓨터에서 클론한 뒤:

1. **꼭 `npm install`** 먼저 (node_modules가 .gitignore에 있어 안 옴)
2. **Claude 인증** 다시 설정 (구독 또는 API 키)
3. **결과물 저장 폴더**: 기본값 (`biz-plan-results`) 쓰면 워크스페이스 안에 생성됨. 다른 위치 쓰려면 비서 화면에서 폴더 선택 (globalState에 저장돼서 컴퓨터별로 별도)
4. F5 → 끝

`.gitignore`에 제외되는 것들:
- `node_modules/` (npm install 시 재생성)
- `*.vsix` (패키징 산출물)
- `.vscode-test/` (테스트 임시 디렉토리)
- `out/` (빌드 산출물)
- `biz-plan-results/` (사용자 산출물 — 워크플로별로 생성됨)

즉, 클론하면 의존성과 결과물만 빠진 상태. `npm install` 한 번이면 바로 동작.

---

## 9. 패키징 (선택) — `.vsix`로 만들어 배포

다른 사람한테 그냥 익스텐션으로 깔게 하고 싶으면:

```bash
npm run package
```

→ `biz-plan-agent-0.1.0.vsix` 파일 생성. 받는 사람은 VS Code에서:
- 명령 팔레트 → "Extensions: Install from VSIX..." → 파일 선택

이러면 F5 없이 일반 익스텐션처럼 영구 설치됨.

---

## 10. 주요 파일 위치

```
biz-plan-extension/
├── extension.js              # 익스텐션 엔트리 + AGENTS 설정 + 핸들러
├── package.json              # 의존성 + VS Code 메타데이터 + 설정 정의
├── prompts/                  # 6명 캐릭터의 시스템 프롬프트
│   ├── 00_secretary.md
│   ├── 01_manager.md
│   ├── 02_researcher.md
│   ├── 03_slide_agent.md
│   ├── 04_boss.md
│   └── 05_designer.md
├── webview/
│   ├── center.html           # 가운데 패널 레이아웃
│   ├── center.js             # 가운데 패널 로직
│   ├── center.css            # 스타일
│   ├── sidebar.html / .js / .css   # 좌측 사이드바
└── .vscode/launch.json       # F5 디버그 설정
```

캐릭터 추가/수정하고 싶으면 `prompts/` 안 .md를 직접 수정 + `extension.js`의 `AGENTS` 배열에 항목 추가.

---

## 11. 도움말

- VS Code 익스텐션 개발 일반: [code.visualstudio.com/api](https://code.visualstudio.com/api)
- Claude Code: [docs.claude.com/en/docs/claude-code](https://docs.claude.com/en/docs/claude-code)
- 이 레포 이슈: (레포 페이지 Issues 탭)

문제 생기면 위 §7 트러블슈팅 → 그래도 안 되면 콘솔 에러 캡처해서 이슈 등록.
