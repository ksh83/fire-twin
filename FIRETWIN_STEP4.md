# FIRE.TWIN · STEP 4
# 소속별 색상 식별 + 12대 실전 차량 확장
# ─────────────────────────────────────────────────────────────
# 전제: STEP 3이 완료되어 6대 시뮬레이션이 동작해야 한다.
# 수정 파일: src/data/vehicles.js, src/main.js (2개만)
# ─────────────────────────────────────────────────────────────

## 설계 원칙

```
식별 레이어 1 (즉각)  →  아이콘 배경색 = 소속 (금암/전미/아중)
식별 레이어 2 (확인)  →  아이콘 중앙 텍스트 = 차종 (펌프/구급/탱크 등)
식별 레이어 3 (정밀)  →  라벨 = 소속+차종+번호 (금암펌1, 전미구급 등)
상태 레이어     →  외곽 링 색상 = 운용상태 (정상/경고/위험) — 기존 유지
```

## 소속별 색상 배분 (상태색과 충돌 없음)

```
상태색 (기존 유지):
  safe   #00e5a0  초록    warn  #ffb300  노랑
  danger #ff4422  빨강    info  #2fa8ff  파랑

소속색 (신규, 상태색과 색상환 최대 분리):
  금암   #0099dd  청록    → 상태 파랑보다 채도 낮고 진함, 구별 가능
  전미   #dd6600  주황    → 경고 노랑·위험 빨강 중간, 명확히 구별됨
  아중   #9900cc  보라    → 색상환상 완전 분리, 어느 상태색과도 혼동 없음
```

---

## TASK 1 — src/data/vehicles.js 전면 교체

`fire-twin/src/data/vehicles.js`를 아래 내용으로 **전체 교체**해라.

```js
// ── 화재 현장 중심 좌표 (전주시 금암동 가상 현장) ─────────────
export const INCIDENT = {
  lon:      127.1085,
  lat:      35.8420,
  alt:      0,
  address:  '전주시 덕진구 금암동 455',
  building: '5층 근린생활시설',
  fireFloor: 3,
};

// ── 상태 색상 (statusLevel → hex) ───────────────────────────
// 차량 외곽 링 색상 = 운용 상태 표시
export const STATUS_COLOR = {
  info:   '#2fa8ff',  // 지휘 / 파랑
  safe:   '#00e5a0',  // 정상 / 초록
  warn:   '#ffb300',  // 경고 / 노랑
  danger: '#ff4422',  // 위험 / 빨강
};

// ── 소속 색상 (unit → hex) ───────────────────────────────────
// 아이콘 배경색 = 소속 식별. 상태색과 색상환 최대 분리.
export const UNIT_COLOR = {
  CMD:  '#2fa8ff',  // 지휘차 (info 파랑 유지)
  금암: '#0099dd',  // 금암소방서 — 청록
  전미: '#dd6600',  // 전미소방서 — 주황
  아중: '#9900cc',  // 아중소방서 — 보라
};

// ── 차종 약칭 (role → 아이콘 중앙 텍스트) ───────────────────
export const TYPE_ABBR = {
  command:     '지휘',
  pump:        '펌프',
  tank:        '탱크',
  ladder:      '사다',
  smallladder: '소사',
  aerial:      '고가',
  flex:        '굴절',
  amb:         '구급',
};

// ── 차량 13대 데이터 ─────────────────────────────────────────
// unit        → 소속 (UNIT_COLOR 키)
// shortLabel  → 지도 라벨 표시 문자열 (소속+차종+번호 약칭)
// indoor      → true 시 GPS 음영, UWB 추적 전환
// alt         → 실내 고도(m). 1층=0, 2층=3, 3층=6, 4층=9
export const VEHICLES = [

  // ── 지휘 ─────────────────────────────────────────────────
  {
    id:          'CMD-1',
    shortLabel:  'CMD',
    label:       '지휘차',
    type:        '지휘차 (기준점)',
    unit:        'CMD',
    role:        'command',
    lon:         127.1068,
    lat:         35.8417,
    alt:         0,
    indoor:      false,
    status:      '지휘중',
    statusLevel: 'info',
    crew:        2,
    absCoord:    '35.8417°N, 127.1068°E',
    relCoord:    '기준차량 (0m)',
    dist:        '기준',
  },

  // ── 금암소방서 (7대) ──────────────────────────────────────
  {
    id:          'GA-PMP1',
    shortLabel:  '금암펌1',
    label:       '금암펌프1',
    type:        '펌프차',
    unit:        '금암',
    role:        'pump',
    lon:         127.1070,
    lat:         35.8428,
    alt:         0,
    indoor:      false,
    status:      '진압중',
    statusLevel: 'safe',
    crew:        4,
    absCoord:    '35.8428°N, 127.1070°E',
    relCoord:    '북 122m / 358°',
    dist:        '122m',
  },
  {
    id:          'GA-PMP2',
    shortLabel:  '금암펌2',
    label:       '금암펌프2',
    type:        '펌프차',
    unit:        '금암',
    role:        'pump',
    lon:         127.1065,
    lat:         35.8413,
    alt:         0,
    indoor:      false,
    status:      '진압중',
    statusLevel: 'safe',
    crew:        4,
    absCoord:    '35.8413°N, 127.1065°E',
    relCoord:    '남서 57m / 219°',
    dist:        '57m',
  },
  {
    id:          'GA-AMB1',
    shortLabel:  '금암구1',
    label:       '금암구급1',
    type:        '구급차',
    unit:        '금암',
    role:        'amb',
    lon:         127.1072,
    lat:         35.8432,
    alt:         0,
    indoor:      false,
    status:      '대기중',
    statusLevel: 'safe',
    crew:        2,
    absCoord:    '35.8432°N, 127.1072°E',
    relCoord:    '북 166m / 3°',
    dist:        '166m',
  },
  {
    id:          'GA-AMB2',
    shortLabel:  '금암구2',
    label:       '금암구급2',
    type:        '구급차',
    unit:        '금암',
    role:        'amb',
    lon:         127.1062,
    lat:         35.8409,
    alt:         0,
    indoor:      false,
    status:      '부상자 이송중',
    statusLevel: 'warn',
    crew:        2,
    absCoord:    '35.8409°N, 127.1062°E',
    relCoord:    '남서 138m / 228°',
    dist:        '138m',
  },
  {
    id:          'GA-TNK',
    shortLabel:  '금암탱크',
    label:       '금암물탱크',
    type:        '물탱크차',
    unit:        '금암',
    role:        'tank',
    lon:         127.1055,
    lat:         35.8420,
    alt:         0,
    indoor:      false,
    status:      '급수중',
    statusLevel: 'safe',
    crew:        3,
    absCoord:    '35.8420°N, 127.1055°E',
    relCoord:    '서 266m / 270°',
    dist:        '266m',
  },
  {
    id:          'GA-FLX',
    shortLabel:  '금암굴절',
    label:       '금암굴절차',
    type:        '굴절사다리차',
    unit:        '금암',
    role:        'flex',
    lon:         127.1083,
    lat:         35.8427,
    alt:         6.0,     // 3층 진입 (층고 3m × 2층 + 보정)
    indoor:      true,    // ← UWB 추적 중
    status:      '건물 3F 진입',
    statusLevel: 'danger',
    crew:        3,
    absCoord:    'GPS 음영 (실내)',
    relCoord:    'UWB: 북동 20m / 고도 +6.0m',
    dist:        '20m↑',
  },
  {
    id:          'GA-ARL',
    shortLabel:  '금암고가',
    label:       '금암고가차',
    type:        '고가사다리차',
    unit:        '금암',
    role:        'aerial',
    lon:         127.1078,
    lat:         35.8430,
    alt:         0,
    indoor:      false,
    status:      '전개완료',
    statusLevel: 'safe',
    crew:        3,
    absCoord:    '35.8430°N, 127.1078°E',
    relCoord:    '북 122m / 13°',
    dist:        '122m',
  },

  // ── 전미소방서 (2대) ──────────────────────────────────────
  {
    id:          'JM-PMP',
    shortLabel:  '전미펌프',
    label:       '전미펌프',
    type:        '펌프차',
    unit:        '전미',
    role:        'pump',
    lon:         127.1098,
    lat:         35.8428,
    alt:         0,
    indoor:      false,
    status:      '진압중',
    statusLevel: 'safe',
    crew:        4,
    absCoord:    '35.8428°N, 127.1098°E',
    relCoord:    '북동 148m / 55°',
    dist:        '148m',
  },
  {
    id:          'JM-AMB',
    shortLabel:  '전미구급',
    label:       '전미구급',
    type:        '구급차',
    unit:        '전미',
    role:        'amb',
    lon:         127.1110,
    lat:         35.8420,
    alt:         0,
    indoor:      false,
    status:      '대기중',
    statusLevel: 'safe',
    crew:        2,
    absCoord:    '35.8420°N, 127.1110°E',
    relCoord:    '동 221m / 90°',
    dist:        '221m',
  },

  // ── 아중소방서 (3대) ──────────────────────────────────────
  {
    id:          'AJ-PMP',
    shortLabel:  '아중펌프',
    label:       '아중펌프',
    type:        '펌프차',
    unit:        '아중',
    role:        'pump',
    lon:         127.1092,
    lat:         35.8410,
    alt:         0,
    indoor:      false,
    status:      '수원부족',
    statusLevel: 'warn',
    crew:        4,
    absCoord:    '35.8410°N, 127.1092°E',
    relCoord:    '남동 122m / 140°',
    dist:        '122m',
  },
  {
    id:          'AJ-AMB',
    shortLabel:  '아중구급',
    label:       '아중구급',
    type:        '구급차',
    unit:        '아중',
    role:        'amb',
    lon:         127.1086,
    lat:         35.8405,
    alt:         0,
    indoor:      false,
    status:      '대기중',
    statusLevel: 'safe',
    crew:        2,
    absCoord:    '35.8405°N, 127.1086°E',
    relCoord:    '남 166m / 178°',
    dist:        '166m',
  },
  {
    id:          'AJ-SLD',
    shortLabel:  '아중소사',
    label:       '아중소형사다리',
    type:        '소형사다리차',
    unit:        '아중',
    role:        'smallladder',
    lon:         127.1100,
    lat:         35.8412,
    alt:         0,
    indoor:      false,
    status:      '진입준비',
    statusLevel: 'info',
    crew:        2,
    absCoord:    '35.8412°N, 127.1100°E',
    relCoord:    '남동 178m / 128°',
    dist:        '178m',
  },
];

// ── 현장 알림 로그 ───────────────────────────────────────────
export const ALERTS = [
  { time: '02:14', level: 'danger', text: '금암굴절 대원 3명 3층 진입 — 산소잔압 22% 주의' },
  { time: '02:11', level: 'warn',   text: '아중펌프 수원 잔량 29% — 금암탱크 급수 요청' },
  { time: '02:08', level: 'warn',   text: '금암구급2 부상자 1명 이송 출발' },
  { time: '02:05', level: 'info',   text: '금암고가 전개 완료 · 4층 진입 가능' },
  { time: '02:01', level: 'info',   text: '전미·아중 지원 도착 — 배치 완료' },
  { time: '01:55', level: 'info',   text: '3개 소방서 13대 배치 완료' },
];

// ── 데이터 연계 현황 ────────────────────────────────────────
export const DATA_SOURCES = [
  {
    name:  'OSM 3D 건물',
    badge: 'LIVE',
    level: 'safe',
    desc:  'Cesium OSM Buildings · 전국 3D 건물 스트리밍',
  },
  {
    name:  'V-World WebGL API',
    badge: 'READY',
    level: 'info',
    desc:  '국토부 오픈플랫폼 · LOD3 건물·지형 · API 키 필요',
  },
  {
    name:  'GPS + UWB 융합',
    badge: 'LIVE',
    level: 'safe',
    desc:  '실외 ±3m GPS / 실내 ±15cm UWB · 250ms 갱신',
  },
  {
    name:  'BIM 건물 평면도',
    badge: '예정',
    level: 'warn',
    desc:  '소방청 건물DB 연계 · 층별 대원 위치 오버레이',
  },
  {
    name:  '디지털 트윈 국토',
    badge: '예정',
    level: 'warn',
    desc:  '국토부 통합플랫폼 · 지하시설물 포함 완전 3D',
  },
];
```

---

## TASK 2 — src/main.js 수정 (4곳)

**수정 1: 상단 import 교체**

아래 줄을:
```js
import { VEHICLES, INCIDENT, STATUS_COLOR, ROLE_EMOJI } from './data/vehicles.js';
```
이것으로 교체해라:
```js
import { VEHICLES, INCIDENT, STATUS_COLOR, UNIT_COLOR, TYPE_ABBR } from './data/vehicles.js';
```

---

**수정 2: makeVehicleCanvas() 함수 전체 교체**

기존 `makeVehicleCanvas` 함수 전체를 아래로 교체해라.
(함수 시작 `function makeVehicleCanvas(v) {` 부터 끝 `}` 까지)

```js
function makeVehicleCanvas(v) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');

  const unitCol = UNIT_COLOR[v.unit] || '#888888';
  const statCol = STATUS_COLOR[v.statusLevel] || '#ffffff';

  // 1. 외곽 헤일로 (소속색, 넓은 반투명 원)
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, Math.PI * 2);
  ctx.fillStyle = unitCol + '22'; // 13% alpha
  ctx.fill();

  // 2. 배경 원 (소속색, 강한 채도 → 소속 즉각 식별)
  ctx.beginPath();
  ctx.arc(32, 32, 24, 0, Math.PI * 2);
  ctx.fillStyle = unitCol + 'cc'; // 80% alpha
  ctx.fill();

  // 3. 상태 링 (외곽, 운용 상태색)
  ctx.beginPath();
  ctx.arc(32, 32, 29, 0, Math.PI * 2);
  ctx.strokeStyle = statCol;
  ctx.lineWidth = v.statusLevel === 'danger' ? 4 : 2.5;
  ctx.stroke();

  // 4. 차종 텍스트 (중앙, 흰색 굵게)
  const abbr = TYPE_ABBR[v.role] || v.label.slice(0, 2);
  ctx.font = 'bold 13px "Malgun Gothic", "Noto Sans KR", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 3;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(abbr, 32, 32);
  ctx.shadowBlur = 0;

  // 5. 실내 층 배지 (indoor:true 시 좌상단)
  if (v.indoor) {
    const floor = Math.round(v.alt / 3) + 1;
    ctx.font = 'bold 10px "IBM Plex Mono", monospace';
    ctx.fillStyle = statCol;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${floor}F`, 32, 1);
  }

  return c.toDataURL();
}
```

---

**수정 3: billboard 크기 52→64 변경**

아이콘 canvas 크기가 64×64로 변경되었으므로
VEHICLES.forEach 내부 billboard 옵션을 수정해라.

```js
    billboard: {
      image: makeVehicleCanvas(v),
      width: 64, height: 64,       // ← 52, 52 에서 변경
```

---

**수정 4: 라벨 텍스트·폰트 변경**

label 옵션 내 `text`와 `font`를 변경해라.

```js
    label: {
      text: v.shortLabel,          // ← v.id 에서 변경 (예: '금암펌1')
      font: 'bold 13px "Malgun Gothic", "Noto Sans KR", monospace',  // ← 변경
```

label 옵션의 나머지 (`fillColor`, `outlineColor`, `outlineWidth`, `style`,
`verticalOrigin`, `pixelOffset`, `disableDepthTestDistance`, `heightReference`)
는 그대로 유지해라.

---

**수정 5: entity name 에서 ROLE_EMOJI 제거**

ROLE_EMOJI를 더 이상 import하지 않으므로,
entity name 줄을 아래처럼 교체해라.

```js
    name: `[${v.unit}] ${v.shortLabel} — ${v.type}`,   // ← ROLE_EMOJI 제거
```

---

**수정 6: 우패널 투입대원 숫자 수정**

main.js 하단 onPositionUpdate 위에 아무 코드도 변경하지 않는다.
ui.js의 투입대원 '19' 숫자는 buildLayout() HTML 안에 하드코딩되어 있으므로
필요 시 직접 계산하거나 나중에 수정한다.
(이번 STEP에서는 수정 생략 — 오류 최소화 우선)

---

## TASK 3 — 검증

```bash
cd fire-twin
npm run build
```

빌드 에러 없이 완료되어야 한다.

다음을 확인해라:
```
□ 빌드 성공 (에러 없음)
□ npm run dev 실행 후 브라우저에서 3D 지도 표시됨
□ 13대 아이콘이 3가지 배경색(청록/주황/보라)으로 구분되어 표시됨
□ 각 아이콘 중앙에 차종 한글(펌프/구급/탱크/굴절/고가/사다/소사/지휘) 표시됨
□ 아이콘 외곽 링 색상이 상태별(초록/노랑/빨강/파랑)로 유지됨
□ 지도 라벨에 '금암펌1', '전미구급', '아중소사' 등 단축명 표시됨
□ 금암굴절 아이콘 좌상단에 '2F' 배지 표시됨 (alt:6.0 → 3층)
□ 좌패널에 13개 차량 카드가 스크롤로 표시됨
□ 시뮬레이션 — CMD-1 제외 12대가 250ms마다 미세 이동됨
```

에러 발생 시 확인 포인트:
```
① "UNIT_COLOR is not defined"  → 수정 1 (import) 누락
② "TYPE_ABBR is not defined"   → 수정 1 (import) 누락
③ "shortLabel is not defined"  → 수정 4 (label text) 누락
④ 아이콘 여전히 52px          → 수정 3 (billboard 크기) 누락
⑤ 텍스트가 □□ 박스로 표시    → 시스템 한글 폰트 미지원 (무시 가능,
                                  태블릿 현장에서는 정상 표시됨)
```
