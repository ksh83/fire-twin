# FIRE.TWIN — Claude Code 프로젝트 지침

## 프로젝트 목적
한국 소방 현장 지휘관용 실시간 디지털 트윈 지휘 시스템.
대형화재 현장에서 소방차·대원의 위치를 CesiumJS 3D 지도 위에
250ms 주기로 표시한다.

## 절대 규칙 (위반 시 즉시 수정)
1. Cesium은 반드시 `import * as Cesium from 'cesium'`으로 import한다.
   CDN script 태그 절대 금지 → "Cesium is not defined" 에러 원인
2. 색상은 반드시 style.css의 CSS 변수 사용. 하드코딩 hex 금지.
   허용 변수: --bg --surface --surface2 --border --accent
              --safe --warn --danger --info --text --muted
3. setInterval 최소 간격 250ms. 그 이하는 Cesium 렌더 루프와 충돌.
4. Cesium.Cartesian3.fromDegrees()에 new 키워드 금지.
   올바른 사용: `Cesium.Cartesian3.fromDegrees(lon, lat, alt)`
5. entity.position 갱신 시 CallbackProperty 대신 직접 할당 사용.
   (250ms 주기 setInterval 내에서 직접 할당이 성능상 우수)
6. 모든 async Cesium 호출(createOsmBuildingsAsync 등)은 try/catch 필수.

## 파일 역할 분리 원칙
| 파일 | 책임 | 금지 |
|------|------|------|
| main.js | Cesium viewer 생성, 엔티티 등록, 이벤트 바인딩 | DOM 직접 조작 |
| ui.js | HTML 주입, DOM 렌더링, UI 이벤트 | Cesium API 호출 |
| simulation.js | 위치 갱신, WebSocket 수신 | DOM 조작, CSS |
| camera.js | flyTo, 시점 전환 | 데이터 변경 |
| data/vehicles.js | 상수 및 초기 데이터 | 로직, 사이드이펙트 |
| style.css | 모든 스타일 | inline style 생성 |

## 핵심 데이터 구조
```js
// src/data/vehicles.js 에 정의된 단일 진실 소스
INCIDENT  = { lon, lat, alt, address, building, fireFloor }
VEHICLES  = [{ id, label, type, role, lon, lat, alt, indoor,
               status, statusLevel, crew, absCoord, relCoord, dist }]
ALERTS    = [{ time, level, text }]
DATA_SOURCES = [{ name, badge, level, desc }]

STATUS_COLOR = { info:'#2fa8ff', safe:'#00e5a0', warn:'#ffb300', danger:'#ff4422' }
ROLE_EMOJI   = { command:'🚐', pump:'🚒', ladder:'🚒', rescue:'🚑', amb:'🚑' }
```

## 현장 도메인 지식 (코드 작성 시 참고)
- CMD-1 (지휘차): 기준점. 절대 이동 없음. 상대 좌표의 원점.
- RSC-1 (구조차): indoor:true → GPS 음영 → UWB 추적. alt=8.5m(3층)
- PMP-2 (펌프차2): statusLevel='warn' → 수원 부족 상태
- 층고 기준: 1층=0m, 2층=3m, 3층=6~9m (건물마다 상이, 8.5m 사용)
- UWB 좌표계: CMD-1 기준 상대좌표(m) → WGS84 변환 후 Cesium에 전달
- 갱신 주기: GPS 1Hz, UWB 4Hz → 250ms(4Hz)로 통일

## 에이전트 사용 가이드
새 기능 추가 시 → planner.md 먼저 읽고 작업 분해
Cesium 관련 작업 → geo-engineer.md 참고
UI 패널 수정 → ui-engineer.md 참고
데이터/API 연동 → data-engineer.md 참고
코드 완성 후 → reviewer.md 체크리스트 실행

## 에이전트 입출력 프로토콜

### 공통 INPUT 형식
```
AGENT: [에이전트명]
TASK:  [1줄 작업 설명]
FILES: [수정 대상 파일 목록]
CONTEXT: [관련 데이터/변수 (vehicles.js 상수명 등)]
```

### 공통 OUTPUT 형식
```
AGENT: [에이전트명]
STATUS: [DONE / BLOCKED]
BLOCKED_REASON: [BLOCKED 시 이유]
MODIFIED_FILES:
  - [파일명]: [변경 요약]
NEXT_AGENT: [reviewer / 다음 에이전트명]
```

### 에이전트별 입출력 규칙
| 에이전트 | INPUT 필수 항목 | OUTPUT 필수 항목 |
|---------|----------------|-----------------|
| planner | 요청 설명 | PLAN 블록 (순서, 담당, depends) |
| geo-engineer | 엔티티/카메라 스펙 | 수정된 main.js 또는 camera.js 전체 |
| ui-engineer | 컴포넌트 스펙 | 수정된 ui.js 또는 style.css 전체 |
| data-engineer | 데이터 스펙/API 스펙 | 수정된 vehicles.js 또는 simulation.js 전체 |
| reviewer | 수정된 파일 목록 | REVIEW RESULT 블록 |
