# 알아두실 점 — Biz Plan Agent Desktop Build

생성: 2026-06-07 (Electron 데스크탑 앱 1차 빌드 완료 시점)

## 결과물

- `dist-electron/BizPlanAgent-0.1.4-portable.exe` (91MB) — 단일 portable .exe, 더블클릭 실행, VSCode 불필요

## 알아두실 점 4가지

### 1. 코드 사이닝(code signing) 안 됨
- **현상**: Windows SmartScreen이 "알 수 없는 게시자" 경고 띄움. "추가 정보 → 실행" 눌러야 함.
- **원인**: Authenticode 코드 서명 인증서 (Windows EV/OV cert) 없음.
- **해결**: 인증서 구매 (연 ~$200) 후 `package.json` `build.win.certificateFile`/`certificatePassword` 설정.
- **임시 우회**: 그냥 사용자에게 "추가 정보 → 실행" 안내. 한 번 허용하면 그 PC에서는 다시 안 뜸.

### 2. 첫 NSIS installer 빌드 실패 → portable로 전환
- **현상**: NSIS 빌드 시 `winCodeSign` 캐시 해제 단계에서 symbolic link 생성 권한 없음으로 실패.
- **원인**: Windows Developer Mode 비활성 상태에서는 일반 사용자가 symlink 못 만듦.
- **해결책 (NSIS 다시 시도)**:
  1. 설정 → 개발자용 → "개발자 모드" 켜기
  2. `package.json`의 `build.win.target`을 다시 `[{ "target": "nsis", "arch": ["x64"] }]`로
  3. `nsis` 섹션 다시 추가 (oneClick:false, allowToChangeInstallationDirectory:true 등)
  4. `npm run dist:win`

### 3. 앱 아이콘 미설정
- **현상**: 기본 Electron 아이콘 (작업표시줄·창 좌상단·바로가기 전부 회색 행성 모양)
- **해결**: `desktop/icon.ico` (또는 PNG 512x512+) 추가 + `build.win.icon: "desktop/icon.ico"` 한 줄
- electron-builder는 PNG 512x512 한 장 주면 자동으로 멀티해상도 .ico로 변환해줌

### 4. Mac 빌드는 Mac에서만 가능
- 현재 Windows 환경 → `win`만 빌드됨
- Mac에서 동일 코드베이스 clone → `npm install` → `npm run dist:mac` → `.dmg` 산출

## 빌드 명령 요약

```bash
npm run electron      # 개발 모드 실행 (UI 즉시 뜸)
npm run dist:win      # Windows portable .exe (현재 설정)
npm run dist:mac      # Mac .dmg (Mac 환경 필요)
npm run package       # 기존 .vsix (VSCode 확장 — 변경 없음)
```

## Portable vs NSIS 차이

| 항목 | Portable (현재) | NSIS Installer |
|---|---|---|
| 실행 방식 | 더블클릭 → 임시 폴더 추출 후 실행 | "설치" 단계 거침 |
| 설치 경로 | 없음 (임시 폴더) | `C:\Program Files\Biz Plan Agent\` |
| 시작 메뉴 등록 | ❌ | ✅ |
| 바탕화면 바로가기 | ❌ | ✅ (옵션) |
| 제어판 → 프로그램 제거 | ❌ | ✅ |
| 사용자 데이터 (config 등) | `%APPDATA%\Biz Plan Agent\` | 동일 (userData 폴더) |
| 첫 실행 속도 | 약간 느림 (매번 추출) | 빠름 (이미 설치됨) |
| 배포 친화성 | "압축 풀고 실행" 느낌 | "진짜 앱 설치" 느낌 |

> "설치용 PC앱" 본래 의도가 정식 설치라면 **NSIS가 정답**.
> 단순 배포·체험용이면 portable도 충분.
