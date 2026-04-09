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
    alt:         6.0,     // 3층 진입 (층고 3m × 2층)
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
