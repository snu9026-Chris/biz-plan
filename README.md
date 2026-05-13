# Biz Plan Agent

5개 캐릭터가 멀티턴 대화로 협업해 사업소개서 + Claude Design 입력 프롬프트까지 만드는 안티그래비티 / VS Code 익스텐션.

```
🔬 Researcher  → 💬 Validator  → 📐 Architect  → ✍️ Editor  → 🎨 Designer
   리서처          검증가          구조설계가       편집자        디자인 디렉터
   ├ Research      ├ Office Hours  ├ Guide A        ├ Final       ├ Design Direction
   └ Brief 정리    └ Decision Brief └ CEO Review     └ 최종본       └ Design Prompt
```

각 캐릭터는 사용자와 채팅으로 대화하며 작업을 진행하고, "정리해서 다음으로 →" 버튼을 누르면 표준 포맷의 산출물 .md를 작성해 다음 캐릭터에게 자동 인계한다.

마지막 디자인 디렉터의 산출물(`05_design_prompt.md`)이 Claude Design에 그대로 입력으로 들어가는 디자인 명세서다.

## 설치

### 개발 모드 (본인 PC에서 즉시 실행)

```bash
cd biz-plan-extension
npm install
```

안티그래비티(또는 VS Code)에서 이 폴더 열고 `F5` → 새 Extension Development Host 창 + 좌측 활동 표시줄 🚀 아이콘.

### 다른 사람 PC에 설치 (.vsix 빌드)

```bash
npm install
npx vsce package
```

생성된 `.vsix`를 안티그래비티의 `Extensions → ··· → Install from VSIX`로 설치.

## 사용법

1. 좌측 활동 표시줄 🚀 → `Agents` 사이드바
2. `🔬 Researcher` 카드 클릭 → 가운데 패널에 채팅 시작
3. 사업 아이템을 채팅으로 입력 → 캐릭터가 같이 리서치하고 질문 던짐
4. 충분히 논의되면 `📋 정리해서 다음으로 →` 버튼 → Brief가 `01_research_brief.md`로 저장
5. `다음 캐릭터로 →` 버튼 → 💬 Validator로 자동 이동
6. 5단계까지 반복

## 설정

`File → Preferences → Settings → Extensions → Biz Plan Agent`

| 옵션 | 기본값 | 설명 |
| --- | --- | --- |
| `bizPlanAgent.useClaudeCodeAuth` | `true` | Claude Code 월정액 토큰 사용 |
| `bizPlanAgent.anthropicApiKey` | `""` | API 종량제 사용 시에만 입력 |
| `bizPlanAgent.model` | `claude-opus-4-7` | Claude 모델 |
| `bizPlanAgent.workspaceFolder` | `biz-plan-results` | 결과물 저장 폴더 |

월정액 토큰 사용 시 PC에 Claude Code가 설치되고 로그인된 상태여야 함.

## 폴더 구조

```
biz-plan-extension/
├── extension.js              # 메인: 사이드바/중앙 패널, 채팅 히스토리, 정리 모드
├── package.json
├── webview/
│   ├── sidebar.html/css/js   # 5 캐릭터 카드 (좌측)
│   └── center.html/css/js    # 채팅 UI + 정리 결과 (가운데)
└── prompts/                  # 5 캐릭터 시스템 프롬프트 (자유 수정)
    ├── 01_researcher.md
    ├── 02_validator.md
    ├── 03_architect.md
    ├── 04_editor.md
    └── 05_designer.md
```

`prompts/*.md`를 수정하면 다음 대화 턴부터 즉시 반영 (재빌드 불필요).

## 결과물 위치

```
<workspace>/biz-plan-results/
├── 01_research_brief.md      ← Researcher 산출
├── 02_decision_brief.md      ← Validator 산출
├── 03_reviewed_draft.md      ← Architect 산출 (CEO 리뷰 반영)
├── 04_final.md               ← Editor 산출 (최종본)
└── 05_design_prompt.md       ← Designer 산출 (Claude Design 입력)
```

## 캐릭터별 책임 영역

| 캐릭터 | 멀티턴 대화에서 하는 일 | 정리 모드 산출물 |
| --- | --- | --- |
| 🔬 Researcher | 시장/고객/경쟁 자료를 같이 찾고 가정을 세움 | `01_research_brief.md` |
| 💬 Validator | 6개 forcing question으로 압박 검증 | `02_decision_brief.md` |
| 📐 Architect | 슬라이드 구조 설계 + CEO 관점 자체 리뷰 | `03_reviewed_draft.md` |
| ✍️ Editor | 슬라이드별 마지막 점검, 문장/출처/잡소리 정리 | `04_final.md` |
| 🎨 Designer | 톤·레퍼런스·시각 방향 논의 | `05_design_prompt.md` (Claude Design 입력) |

## 원칙

- 사업소개서를 바로 쓰지 않는다.
- 각 캐릭터는 다음 캐릭터용 brief를 만든다.
- 출처 없는 수치/추상어 금지.
- 고객 문제·수요 증거가 약하면 검증 액션을 먼저 제안.
