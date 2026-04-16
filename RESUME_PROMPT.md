# FIRE.TWIN 프로젝트 재개 프롬프트

아래 내용을 새 대화 시작 시 첫 메시지로 붙여넣으세요.

---

## 붙여넣을 내용 ↓↓↓

```
FIRE.TWIN 프로젝트를 이어서 작업해줘.

## 프로젝트 개요
한국 소방 현장 지휘관용 실시간 디지털 트윈 지휘 시스템.
소방차·대원의 GPS/UWB 위치를 CesiumJS 3D 지도 위에 250ms 주기로 표시.

## 현재 상태
- GitHub: https://github.com/ksh83/fire-twin
- Vercel 배포: https://fire-twin.vercel.app
- 로컬 경로: C:\Users\snmsn\fire-twin\

## 구현 완료 기능

### 지도 / 시각화
- CesiumJS 1.112 + Vite + vite-plugin-cesium 구조
- 3개 소방서 13대 차량 (금암7·전미2·아중3·지휘1)
- 소속별 색상 아이콘: 금암=#0099dd, 전미=#dd6600, 아중=#9900cc
- 아이콘 외곽 링 = 운용상태 (info/safe/warn/danger)
- 아이콘 중앙 한글 텍스트 = 차종 (펌프/구급/탱크/굴절/고가/사다)
- OSM 3D 건물 레이어 (Cesium Ion)
- 화재건물 불꽃 마커

### 대원 개인 위치 추적
- 37명 대원 vehicles.js members 배열로 관리
- 28×28 소형 아이콘 (소속색 + 이름 마지막 글자)
- GA-FLX 3명 실내 진입 → 공기호흡기 잔압 22% → 빨간 ! 배지

### 클러스터링
- CustomDataSource 'tactical' 으로 차량+대원 엔티티 관리
- 하단바 클러스터 ON/OFF 토글 버튼

### WebSocket 연동 (simulation.js)
- ws://localhost:8765 자동 연결 시도 (3초 타임아웃)
- 실패 시 로컬 시뮬레이션 자동 전환
- 패킷: init / pos / member_pos / status / alert / vehicle_add
- Python 서버: server/uwb_server.py

### 동적 차량 수신
- WebSocket init 패킷으로 신규 차량/대원 동적 추가
- vehicleDataMap 런타임 레지스트리

### V-World 레이어 (src/layers/vworld.js)
- .env VITE_VWORLD_KEY 설정 시 국토부 WMTS 레이어 활성화
- 미설정 시 조용히 스킵

### 시나리오 재생 엔진 (src/scenario/)
- paths.js   : 금암/전미/아중 소방서 출발 좌표 + 13대 경유지 경로 + 타임라인 이벤트
- engine.js  : requestAnimationFrame 기반 ScenarioEngine 클래스
               easeInOut 경로 보간, 출발/도착/건물진입 상태 전환, 대원 위치 동기화
- panel.js   : 재생/일시정지/초기화/배속(1×2×4×8×) 컨트롤 패널
               타임라인 프로그레스바, 화면 중앙 자막 오버레이
- 촬영 모드 버튼(📽) : 모든 UI 패널 숨김 + 커서 제거
- 시나리오 흐름: T+0 신고접수 → T+3 금암출동 → T+40 전미출동 → T+55 아중출동
               → T+80 CMD-1 도착 → T+140 13대 배치완료 → T+162 건물진입 → T+220 완료
- 소방서 위치 육각형 마커 지도 표시

## 파일 구조
fire-twin/
├── .claude/          ← 에이전트·스킬 정의
├── src/
│   ├── main.js       ← Cesium Viewer + 엔티티 + 시뮬레이션 연결 + 시나리오 초기화
│   ├── ui.js         ← HTML 주입 + 카드 렌더링 + 동적 차량/알림/WS상태
│   ├── simulation.js ← WebSocket + 로컬 시뮬레이션 폴백 + setScenarioMode()
│   ├── style.css     ← CSS 변수 팔레트 + 전체 UI + 시나리오 패널 스타일
│   ├── layers/
│   │   └── vworld.js ← V-World WMTS 레이어
│   ├── scenario/
│   │   ├── paths.js  ← 소방서 좌표 + 차량 경로 + 타임라인 이벤트
│   │   ├── engine.js ← ScenarioEngine 클래스
│   │   └── panel.js  ← 시나리오 UI + 자막
│   └── data/
│       └── vehicles.js ← INCIDENT, VEHICLES(13대+37명 대원), 상수들
├── server/
│   ├── uwb_server.py   ← Python WebSocket 서버 (asyncio + websockets)
│   └── requirements.txt
├── index.html
├── vite.config.js
├── .env              ← VITE_CESIUM_TOKEN, VITE_WS_URL (git 제외)
└── .gitignore

## 핵심 절대 규칙 (.claude/CLAUDE.md 기준)
- Cesium: import * as Cesium from 'cesium' (CDN 금지)
- 색상: CSS 변수만 사용 (하드코딩 hex 금지)
- setInterval 최소 250ms
- Cesium.Cartesian3.fromDegrees() 앞에 new 키워드 금지
- 모듈 단방향 의존: main → ui/simulation/scenario → data

## 차량 ID 체계
CMD-1 / GA-PMP1, GA-PMP2, GA-AMB1, GA-AMB2, GA-TNK, GA-FLX, GA-ARL
JM-PMP, JM-AMB / AJ-PMP, AJ-AMB, AJ-SLD

## 현장 좌표
INCIDENT: lon 127.1085, lat 35.8420 (전주시 덕진구 금암동 가상현장)

## 소방서 좌표 (시나리오 출발지)
금암119: lon 127.1035, lat 35.8472
전미119: lon 127.1196, lat 35.8470
아중119: lon 127.1175, lat 35.8345

## 실행 방법
# 프론트엔드
cd C:\Users\snmsn\fire-twin
npm run dev
→ http://localhost:5173

# WebSocket 서버 (선택)
cd C:\Users\snmsn\fire-twin\server
python uwb_server.py

## 업데이트 방법
코드 수정 후: git add → git commit → git push → Vercel 자동 재배포

## 미완료 / 다음 작업 후보
- 이전 커밋으로 롤백 요청 있었음 (시나리오 없는 버전, 아직 미처리)
  → git log로 커밋 확인 후 사용자 의도 재확인 필요
- 실제 WebSocket UWB 하드웨어 연동
- V-World API 키 연동 테스트
- 대원 개인 산소잔압 실시간 수신
- 30대+ 차량 추가 테스트

이 정보를 바탕으로 작업을 이어서 진행해줘.
```
