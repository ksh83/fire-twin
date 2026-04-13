/**
 * 시나리오 경로 데이터
 *
 * 각 소방서 출발 좌표에서 현장 배치 위치까지의 이동 경로를 정의한다.
 * waypoints[].p : 경로 전체 진행률 (0.0 ~ 1.0)
 */

// ── 소방서 위치 ──────────────────────────────────────────────
export const STATIONS = {
  금암: { lon: 127.1035, lat: 35.8472, name: '금암119안전센터' },
  전미: { lon: 127.1196, lat: 35.8470, name: '전미119안전센터' },
  아중: { lon: 127.1175, lat: 35.8345, name: '아중119안전센터' },
};

// ── 시나리오 총 길이 (초) ────────────────────────────────────
export const TOTAL_TIME = 240;

// ── 차량별 이동 경로 정의 ────────────────────────────────────
// departTime : 시나리오 T+N초에 출발
// travelTime : 이동 소요 시간(초) — 배속에 따라 실시간 단축
// waypoints  : 경유 좌표 배열 [{lon, lat, p}], p = 진행률 0~1
// onDepart   : 출발 시 상태 전환
// onArrive   : 도착 시 상태 전환
export const VEHICLE_PATHS = {

  // ── 금암소방서 (7대) ───────────────────────────────────────
  'CMD-1': {
    departTime: 8,
    travelTime: 72,
    waypoints: [
      { lon: 127.1035, lat: 35.8472, p: 0.00 },
      { lon: 127.1043, lat: 35.8458, p: 0.28 },
      { lon: 127.1055, lat: 35.8440, p: 0.58 },
      { lon: 127.1062, lat: 35.8427, p: 0.80 },
      { lon: 127.1068, lat: 35.8417, p: 1.00 },
    ],
    onDepart: { status: '출동중',  statusLevel: 'info' },
    onArrive: { status: '지휘중',  statusLevel: 'info' },
  },

  'GA-PMP1': {
    departTime: 10,
    travelTime: 80,
    waypoints: [
      { lon: 127.1035, lat: 35.8472, p: 0.00 },
      { lon: 127.1045, lat: 35.8460, p: 0.25 },
      { lon: 127.1058, lat: 35.8448, p: 0.55 },
      { lon: 127.1065, lat: 35.8437, p: 0.78 },
      { lon: 127.1070, lat: 35.8428, p: 1.00 },
    ],
    onDepart: { status: '출동중',  statusLevel: 'warn' },
    onArrive: { status: '진압중',  statusLevel: 'safe' },
  },

  'GA-PMP2': {
    departTime: 11,
    travelTime: 84,
    waypoints: [
      { lon: 127.1035, lat: 35.8472, p: 0.00 },
      { lon: 127.1042, lat: 35.8456, p: 0.28 },
      { lon: 127.1052, lat: 35.8440, p: 0.56 },
      { lon: 127.1059, lat: 35.8426, p: 0.78 },
      { lon: 127.1065, lat: 35.8413, p: 1.00 },
    ],
    onDepart: { status: '출동중',  statusLevel: 'warn' },
    onArrive: { status: '진압중',  statusLevel: 'safe' },
  },

  'GA-AMB1': {
    departTime: 12,
    travelTime: 88,
    waypoints: [
      { lon: 127.1035, lat: 35.8472, p: 0.00 },
      { lon: 127.1044, lat: 35.8462, p: 0.28 },
      { lon: 127.1057, lat: 35.8452, p: 0.56 },
      { lon: 127.1066, lat: 35.8442, p: 0.78 },
      { lon: 127.1072, lat: 35.8432, p: 1.00 },
    ],
    onDepart: { status: '출동중',  statusLevel: 'warn' },
    onArrive: { status: '대기중',  statusLevel: 'safe' },
  },

  'GA-AMB2': {
    departTime: 12,
    travelTime: 88,
    waypoints: [
      { lon: 127.1035, lat: 35.8472, p: 0.00 },
      { lon: 127.1041, lat: 35.8456, p: 0.28 },
      { lon: 127.1050, lat: 35.8437, p: 0.56 },
      { lon: 127.1056, lat: 35.8422, p: 0.78 },
      { lon: 127.1062, lat: 35.8409, p: 1.00 },
    ],
    onDepart: { status: '출동중',  statusLevel: 'warn' },
    onArrive: { status: '대기중',  statusLevel: 'safe' },
  },

  'GA-TNK': {
    departTime: 13,
    travelTime: 97,  // 중량차 — 느림
    waypoints: [
      { lon: 127.1035, lat: 35.8472, p: 0.00 },
      { lon: 127.1038, lat: 35.8458, p: 0.30 },
      { lon: 127.1044, lat: 35.8443, p: 0.58 },
      { lon: 127.1050, lat: 35.8431, p: 0.78 },
      { lon: 127.1055, lat: 35.8420, p: 1.00 },
    ],
    onDepart: { status: '출동중',  statusLevel: 'warn' },
    onArrive: { status: '급수중',  statusLevel: 'safe' },
  },

  'GA-FLX': {
    departTime: 14,
    travelTime: 106,
    // 도착 후 건물 진입까지 대기 시간(초)
    indoorEntryDelay: 20,
    // 고도 상승 소요 시간(초) — 0m → 6m (지상~3층)
    altRiseDuration: 18,
    waypoints: [
      { lon: 127.1035, lat: 35.8472, p: 0.00 },
      { lon: 127.1048, lat: 35.8462, p: 0.25 },
      { lon: 127.1063, lat: 35.8450, p: 0.53 },
      { lon: 127.1076, lat: 35.8437, p: 0.78 },
      { lon: 127.1083, lat: 35.8427, p: 1.00 },
    ],
    onDepart: { status: '출동중',    statusLevel: 'warn'   },
    onArrive: { status: '진입준비',  statusLevel: 'warn'   },
    onIndoor: { status: '건물 3F 진입', statusLevel: 'danger' },
  },

  'GA-ARL': {
    departTime: 10,
    travelTime: 110, // 고가사다리 — 대형차
    waypoints: [
      { lon: 127.1035, lat: 35.8472, p: 0.00 },
      { lon: 127.1046, lat: 35.8464, p: 0.25 },
      { lon: 127.1060, lat: 35.8453, p: 0.53 },
      { lon: 127.1071, lat: 35.8441, p: 0.78 },
      { lon: 127.1078, lat: 35.8430, p: 1.00 },
    ],
    onDepart: { status: '출동중',    statusLevel: 'warn' },
    onArrive: { status: '전개완료',  statusLevel: 'safe' },
  },

  // ── 전미소방서 (2대) ──────────────────────────────────────
  'JM-PMP': {
    departTime: 43,
    travelTime: 87,
    waypoints: [
      { lon: 127.1196, lat: 35.8470, p: 0.00 },
      { lon: 127.1162, lat: 35.8465, p: 0.28 },
      { lon: 127.1130, lat: 35.8453, p: 0.56 },
      { lon: 127.1112, lat: 35.8440, p: 0.78 },
      { lon: 127.1098, lat: 35.8428, p: 1.00 },
    ],
    onDepart: { status: '출동중',  statusLevel: 'warn' },
    onArrive: { status: '진압중',  statusLevel: 'safe' },
  },

  'JM-AMB': {
    departTime: 44,
    travelTime: 86,
    waypoints: [
      { lon: 127.1196, lat: 35.8470, p: 0.00 },
      { lon: 127.1165, lat: 35.8462, p: 0.28 },
      { lon: 127.1138, lat: 35.8448, p: 0.56 },
      { lon: 127.1120, lat: 35.8435, p: 0.78 },
      { lon: 127.1110, lat: 35.8420, p: 1.00 },
    ],
    onDepart: { status: '출동중',  statusLevel: 'warn' },
    onArrive: { status: '대기중',  statusLevel: 'safe' },
  },

  // ── 아중소방서 (3대) ──────────────────────────────────────
  'AJ-PMP': {
    departTime: 58,
    travelTime: 82,
    waypoints: [
      { lon: 127.1175, lat: 35.8345, p: 0.00 },
      { lon: 127.1155, lat: 35.8368, p: 0.28 },
      { lon: 127.1130, lat: 35.8390, p: 0.56 },
      { lon: 127.1108, lat: 35.8403, p: 0.78 },
      { lon: 127.1092, lat: 35.8410, p: 1.00 },
    ],
    onDepart: { status: '출동중',   statusLevel: 'warn' },
    onArrive: { status: '수원부족', statusLevel: 'warn' },
  },

  'AJ-AMB': {
    departTime: 59,
    travelTime: 86,
    waypoints: [
      { lon: 127.1175, lat: 35.8345, p: 0.00 },
      { lon: 127.1155, lat: 35.8365, p: 0.28 },
      { lon: 127.1128, lat: 35.8385, p: 0.56 },
      { lon: 127.1105, lat: 35.8397, p: 0.78 },
      { lon: 127.1086, lat: 35.8405, p: 1.00 },
    ],
    onDepart: { status: '출동중',  statusLevel: 'warn' },
    onArrive: { status: '대기중',  statusLevel: 'safe' },
  },

  'AJ-SLD': {
    departTime: 60,
    travelTime: 80,
    waypoints: [
      { lon: 127.1175, lat: 35.8345, p: 0.00 },
      { lon: 127.1158, lat: 35.8367, p: 0.28 },
      { lon: 127.1135, lat: 35.8388, p: 0.56 },
      { lon: 127.1115, lat: 35.8402, p: 0.78 },
      { lon: 127.1100, lat: 35.8412, p: 1.00 },
    ],
    onDepart: { status: '출동중',    statusLevel: 'warn' },
    onArrive: { status: '진입준비',  statusLevel: 'info' },
  },
};

// ── 시나리오 타임라인 이벤트 ─────────────────────────────────
// type: 'alert'   → 우패널 알림 추가
//       'caption' → 화면 중앙 자막
//       'camera'  → 카메라 이동 (콜백에서 처리)
export const SCENARIO_EVENTS = [
  { t:   0, type: 'caption', text: '전주시 덕진구 금암동 화재 신고 접수' },
  { t:   0, type: 'alert',   level: 'danger',
    text: '🔴 화재 신고 접수 — 전주시 덕진구 금암동 455 · 5층 근린생활시설 3층 화재' },

  { t:   3, type: 'caption', text: '금암119안전센터 전 차량 출동 지령' },
  { t:   3, type: 'alert',   level: 'danger',
    text: '금암119안전센터 출동 지령 — CMD-1 외 6대 현장 출동' },

  { t:  40, type: 'caption', text: '전미119안전센터 지원 출동' },
  { t:  40, type: 'alert',   level: 'warn',
    text: '전미119안전센터 지원 출동 지령 (2대)' },

  { t:  55, type: 'caption', text: '아중119안전센터 지원 출동' },
  { t:  55, type: 'alert',   level: 'warn',
    text: '아중119안전센터 지원 출동 지령 (3대)' },

  { t:  80, type: 'caption', text: 'CMD-1 현장 도착 — 지휘 개시' },
  { t:  80, type: 'alert',   level: 'info',
    text: 'CMD-1 현장 도착 · 현장 지휘 개시 · 전파통신 개통' },
  { t:  80, type: 'camera',  target: 'incident' },

  { t:  92, type: 'caption', text: '금암펌프 도착 · 진압 시작' },

  { t: 120, type: 'alert',   level: 'info',
    text: '금암고가 전개 완료 · 4층 진입 가능' },
  { t: 122, type: 'caption', text: '금암고가 전개 완료' },

  { t: 132, type: 'caption', text: '전미·아중 지원대 현장 도착' },
  { t: 140, type: 'alert',   level: 'info',
    text: '전미·아중 지원 도착 — 3개 소방서 13대 배치 완료' },
  { t: 142, type: 'caption', text: '3개 소방서 13대 배치 완료' },

  { t: 150, type: 'alert',   level: 'warn',
    text: '금암구급2 부상자 1명 이송 출발' },

  { t: 162, type: 'caption', text: '금암굴절 건물 진입 — UWB 추적 전환' },
  { t: 162, type: 'alert',   level: 'danger',
    text: '금암굴절 건물 진입 시작 — GPS 음영 · UWB 추적 전환' },

  { t: 181, type: 'caption', text: '3층 진입 완료 · 산소잔압 22% 경고' },
  { t: 181, type: 'alert',   level: 'danger',
    text: '금암굴절 대원 3명 3층 진입 완료 — 산소잔압 22% 주의' },

  { t: 200, type: 'alert',   level: 'warn',
    text: '아중펌프 수원 잔량 29% — 금암탱크 급수 요청' },

  { t: 220, type: 'caption', text: '전 차량 작전 수행 중 — 현장 지휘 체계 확립' },
  { t: 220, type: 'alert',   level: 'info',
    text: '현장 지휘 체계 확립 완료 · 13대 / 37명 현장 작전 수행중' },
];
