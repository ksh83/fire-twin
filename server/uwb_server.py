#!/usr/bin/env python3
"""
FIRE.TWIN WebSocket 서버 — GPS/UWB 위치 브로드캐스터

실행:
  pip install -r requirements.txt
  python uwb_server.py [--port 8765] [--host 0.0.0.0]

기능:
  · 연결 즉시 init 패킷 (차량 목록 + 대원 목록) 전송
  · 250ms 주기로 전체 차량/대원 위치 브로드캐스트
  · 시리얼/네트워크 UWB 하드웨어 데이터 포워딩 지원 (--uwb-port 옵션)
  · 다중 클라이언트 동시 지원

패킷 형식 (서버 → 클라이언트):
  { "type": "init",        "vehicles": [...], "members": [...] }
  { "type": "pos",         "id": "GA-PMP1", "lon": 127.107, "lat": 35.8428, "alt": 3.0 }
  { "type": "member_pos",  "id": "GA-PMP1-M1", "vehicleId": "GA-PMP1",
                           "lon": ..., "lat": ..., "alt": 1.0 }
  { "type": "status",      "id": "GA-PMP1", "statusLevel": "warn", "status": "수원부족" }
  { "type": "alert",       "time": "02:20", "level": "danger", "text": "..." }
  { "type": "vehicle_add", "vehicle": {...} }

패킷 형식 (클라이언트 → 서버, UWB 하드웨어에서 직접):
  { "type": "uwb", "id": "GA-FLX-M1", "x": 5.2, "y": -3.1, "z": 6.0 }
  { "type": "gps", "id": "GA-PMP1", "lon": 127.107, "lat": 35.8428, "alt": 0 }
"""

import asyncio
import json
import math
import time
import argparse
import logging
from datetime import datetime
import websockets
from websockets.server import serve

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [FIRE.TWIN] %(message)s',
    datefmt='%H:%M:%S',
)
logger = logging.getLogger('fire.twin')

# ── 현장 기준 좌표 ──────────────────────────────────────────────
INCIDENT = {'lon': 127.1085, 'lat': 35.8420}

# CMD-1 기준점 WGS84 (UWB 상대좌표 → 절대좌표 변환용)
CMD_LON = 127.1068
CMD_LAT = 35.8417
M_PER_DEG_LAT = 111000.0
M_PER_DEG_LON = 111000.0 * math.cos(math.radians(CMD_LAT))

def uwb_to_wgs84(x_m, y_m, z_m):
    """UWB 상대좌표(m) → WGS84 (CMD-1 기준)"""
    lon = CMD_LON + x_m / M_PER_DEG_LON
    lat = CMD_LAT + y_m / M_PER_DEG_LAT
    return lon, lat, z_m

# ── 차량 데이터 (vehicles.js 미러) ─────────────────────────────
VEHICLES = [
    {
        'id': 'CMD-1', 'shortLabel': 'CMD', 'label': '지휘차',
        'type': '지휘차 (기준점)', 'unit': 'CMD', 'role': 'command',
        'lon': 127.1068, 'lat': 35.8417, 'alt': 0,
        'indoor': False, 'status': '지휘중', 'statusLevel': 'info',
        'crew': 2, 'absCoord': '35.8417°N, 127.1068°E',
        'relCoord': '기준차량 (0m)', 'dist': '기준',
    },
    {
        'id': 'GA-PMP1', 'shortLabel': '금암펌1', 'label': '금암펌프1',
        'type': '펌프차', 'unit': '금암', 'role': 'pump',
        'lon': 127.1070, 'lat': 35.8428, 'alt': 0,
        'indoor': False, 'status': '진압중', 'statusLevel': 'safe',
        'crew': 4, 'absCoord': '35.8428°N, 127.1070°E',
        'relCoord': '북 122m / 358°', 'dist': '122m',
    },
    {
        'id': 'GA-PMP2', 'shortLabel': '금암펌2', 'label': '금암펌프2',
        'type': '펌프차', 'unit': '금암', 'role': 'pump',
        'lon': 127.1065, 'lat': 35.8413, 'alt': 0,
        'indoor': False, 'status': '진압중', 'statusLevel': 'safe',
        'crew': 4, 'absCoord': '35.8413°N, 127.1065°E',
        'relCoord': '남서 57m / 219°', 'dist': '57m',
    },
    {
        'id': 'GA-AMB1', 'shortLabel': '금암구1', 'label': '금암구급1',
        'type': '구급차', 'unit': '금암', 'role': 'amb',
        'lon': 127.1072, 'lat': 35.8432, 'alt': 0,
        'indoor': False, 'status': '대기중', 'statusLevel': 'safe',
        'crew': 2, 'absCoord': '35.8432°N, 127.1072°E',
        'relCoord': '북 166m / 3°', 'dist': '166m',
    },
    {
        'id': 'GA-AMB2', 'shortLabel': '금암구2', 'label': '금암구급2',
        'type': '구급차', 'unit': '금암', 'role': 'amb',
        'lon': 127.1062, 'lat': 35.8409, 'alt': 0,
        'indoor': False, 'status': '부상자 이송중', 'statusLevel': 'warn',
        'crew': 2, 'absCoord': '35.8409°N, 127.1062°E',
        'relCoord': '남서 138m / 228°', 'dist': '138m',
    },
    {
        'id': 'GA-TNK', 'shortLabel': '금암탱크', 'label': '금암물탱크',
        'type': '물탱크차', 'unit': '금암', 'role': 'tank',
        'lon': 127.1055, 'lat': 35.8420, 'alt': 0,
        'indoor': False, 'status': '급수중', 'statusLevel': 'safe',
        'crew': 3, 'absCoord': '35.8420°N, 127.1055°E',
        'relCoord': '서 266m / 270°', 'dist': '266m',
    },
    {
        'id': 'GA-FLX', 'shortLabel': '금암굴절', 'label': '금암굴절차',
        'type': '굴절사다리차', 'unit': '금암', 'role': 'flex',
        'lon': 127.1083, 'lat': 35.8427, 'alt': 6.0,
        'indoor': True, 'status': '건물 3F 진입', 'statusLevel': 'danger',
        'crew': 3, 'absCoord': 'GPS 음영 (실내)',
        'relCoord': 'UWB: 북동 20m / 고도 +6.0m', 'dist': '20m↑',
    },
    {
        'id': 'GA-ARL', 'shortLabel': '금암고가', 'label': '금암고가차',
        'type': '고가사다리차', 'unit': '금암', 'role': 'aerial',
        'lon': 127.1078, 'lat': 35.8430, 'alt': 0,
        'indoor': False, 'status': '전개완료', 'statusLevel': 'safe',
        'crew': 3, 'absCoord': '35.8430°N, 127.1078°E',
        'relCoord': '북 122m / 13°', 'dist': '122m',
    },
    {
        'id': 'JM-PMP', 'shortLabel': '전미펌프', 'label': '전미펌프',
        'type': '펌프차', 'unit': '전미', 'role': 'pump',
        'lon': 127.1098, 'lat': 35.8428, 'alt': 0,
        'indoor': False, 'status': '진압중', 'statusLevel': 'safe',
        'crew': 4, 'absCoord': '35.8428°N, 127.1098°E',
        'relCoord': '북동 148m / 55°', 'dist': '148m',
    },
    {
        'id': 'JM-AMB', 'shortLabel': '전미구급', 'label': '전미구급',
        'type': '구급차', 'unit': '전미', 'role': 'amb',
        'lon': 127.1110, 'lat': 35.8420, 'alt': 0,
        'indoor': False, 'status': '대기중', 'statusLevel': 'safe',
        'crew': 2, 'absCoord': '35.8420°N, 127.1110°E',
        'relCoord': '동 221m / 90°', 'dist': '221m',
    },
    {
        'id': 'AJ-PMP', 'shortLabel': '아중펌프', 'label': '아중펌프',
        'type': '펌프차', 'unit': '아중', 'role': 'pump',
        'lon': 127.1092, 'lat': 35.8410, 'alt': 0,
        'indoor': False, 'status': '수원부족', 'statusLevel': 'warn',
        'crew': 4, 'absCoord': '35.8410°N, 127.1092°E',
        'relCoord': '남동 122m / 140°', 'dist': '122m',
    },
    {
        'id': 'AJ-AMB', 'shortLabel': '아중구급', 'label': '아중구급',
        'type': '구급차', 'unit': '아중', 'role': 'amb',
        'lon': 127.1086, 'lat': 35.8405, 'alt': 0,
        'indoor': False, 'status': '대기중', 'statusLevel': 'safe',
        'crew': 2, 'absCoord': '35.8405°N, 127.1086°E',
        'relCoord': '남 166m / 178°', 'dist': '166m',
    },
    {
        'id': 'AJ-SLD', 'shortLabel': '아중소사', 'label': '아중소형사다리',
        'type': '소형사다리차', 'unit': '아중', 'role': 'smallladder',
        'lon': 127.1100, 'lat': 35.8412, 'alt': 0,
        'indoor': False, 'status': '진입준비', 'statusLevel': 'info',
        'crew': 2, 'absCoord': '35.8412°N, 127.1100°E',
        'relCoord': '남동 178m / 128°', 'dist': '178m',
    },
]

# ── 대원 데이터 ─────────────────────────────────────────────────
MEMBERS = [
    # CMD-1
    {'id': 'CMD-1-M1',   'vehicleId': 'CMD-1',   'name': '이현수', 'rank': '소방령', 'oxygenPct': None},
    {'id': 'CMD-1-M2',   'vehicleId': 'CMD-1',   'name': '박재훈', 'rank': '소방사', 'oxygenPct': None},
    # GA-PMP1
    {'id': 'GA-PMP1-M1', 'vehicleId': 'GA-PMP1', 'name': '김성호', 'rank': '소방장', 'oxygenPct': None},
    {'id': 'GA-PMP1-M2', 'vehicleId': 'GA-PMP1', 'name': '이준서', 'rank': '소방교', 'oxygenPct': None},
    {'id': 'GA-PMP1-M3', 'vehicleId': 'GA-PMP1', 'name': '최민준', 'rank': '소방사', 'oxygenPct': None},
    {'id': 'GA-PMP1-M4', 'vehicleId': 'GA-PMP1', 'name': '정도현', 'rank': '소방사', 'oxygenPct': None},
    # GA-PMP2
    {'id': 'GA-PMP2-M1', 'vehicleId': 'GA-PMP2', 'name': '박정우', 'rank': '소방장', 'oxygenPct': None},
    {'id': 'GA-PMP2-M2', 'vehicleId': 'GA-PMP2', 'name': '손유민', 'rank': '소방교', 'oxygenPct': None},
    {'id': 'GA-PMP2-M3', 'vehicleId': 'GA-PMP2', 'name': '윤기준', 'rank': '소방사', 'oxygenPct': None},
    {'id': 'GA-PMP2-M4', 'vehicleId': 'GA-PMP2', 'name': '임태양', 'rank': '소방사', 'oxygenPct': None},
    # GA-AMB1
    {'id': 'GA-AMB1-M1', 'vehicleId': 'GA-AMB1', 'name': '강지현', 'rank': '소방교', 'oxygenPct': None},
    {'id': 'GA-AMB1-M2', 'vehicleId': 'GA-AMB1', 'name': '한소희', 'rank': '소방사', 'oxygenPct': None},
    # GA-AMB2
    {'id': 'GA-AMB2-M1', 'vehicleId': 'GA-AMB2', 'name': '신예린', 'rank': '소방교', 'oxygenPct': None},
    {'id': 'GA-AMB2-M2', 'vehicleId': 'GA-AMB2', 'name': '조민서', 'rank': '소방사', 'oxygenPct': None},
    # GA-TNK
    {'id': 'GA-TNK-M1',  'vehicleId': 'GA-TNK',  'name': '권병수', 'rank': '소방교', 'oxygenPct': None},
    {'id': 'GA-TNK-M2',  'vehicleId': 'GA-TNK',  'name': '나동훈', 'rank': '소방사', 'oxygenPct': None},
    {'id': 'GA-TNK-M3',  'vehicleId': 'GA-TNK',  'name': '오성철', 'rank': '소방사', 'oxygenPct': None},
    # GA-FLX (실내 진입 — 공기호흡기 잔압 추적)
    {'id': 'GA-FLX-M1',  'vehicleId': 'GA-FLX',  'name': '최원준', 'rank': '소방장', 'oxygenPct': 22},
    {'id': 'GA-FLX-M2',  'vehicleId': 'GA-FLX',  'name': '서재민', 'rank': '소방사', 'oxygenPct': 24},
    {'id': 'GA-FLX-M3',  'vehicleId': 'GA-FLX',  'name': '홍성빈', 'rank': '소방사', 'oxygenPct': 20},
    # GA-ARL
    {'id': 'GA-ARL-M1',  'vehicleId': 'GA-ARL',  'name': '백승호', 'rank': '소방교', 'oxygenPct': None},
    {'id': 'GA-ARL-M2',  'vehicleId': 'GA-ARL',  'name': '유시완', 'rank': '소방사', 'oxygenPct': None},
    {'id': 'GA-ARL-M3',  'vehicleId': 'GA-ARL',  'name': '방준형', 'rank': '소방사', 'oxygenPct': None},
    # JM-PMP
    {'id': 'JM-PMP-M1',  'vehicleId': 'JM-PMP',  'name': '노태혁', 'rank': '소방장', 'oxygenPct': None},
    {'id': 'JM-PMP-M2',  'vehicleId': 'JM-PMP',  'name': '변성준', 'rank': '소방교', 'oxygenPct': None},
    {'id': 'JM-PMP-M3',  'vehicleId': 'JM-PMP',  'name': '구재원', 'rank': '소방사', 'oxygenPct': None},
    {'id': 'JM-PMP-M4',  'vehicleId': 'JM-PMP',  'name': '하민성', 'rank': '소방사', 'oxygenPct': None},
    # JM-AMB
    {'id': 'JM-AMB-M1',  'vehicleId': 'JM-AMB',  'name': '맹유진', 'rank': '소방교', 'oxygenPct': None},
    {'id': 'JM-AMB-M2',  'vehicleId': 'JM-AMB',  'name': '전혜원', 'rank': '소방사', 'oxygenPct': None},
    # AJ-PMP
    {'id': 'AJ-PMP-M1',  'vehicleId': 'AJ-PMP',  'name': '류승현', 'rank': '소방장', 'oxygenPct': None},
    {'id': 'AJ-PMP-M2',  'vehicleId': 'AJ-PMP',  'name': '마재영', 'rank': '소방교', 'oxygenPct': None},
    {'id': 'AJ-PMP-M3',  'vehicleId': 'AJ-PMP',  'name': '탁민준', 'rank': '소방사', 'oxygenPct': None},
    {'id': 'AJ-PMP-M4',  'vehicleId': 'AJ-PMP',  'name': '제갈현', 'rank': '소방사', 'oxygenPct': None},
    # AJ-AMB
    {'id': 'AJ-AMB-M1',  'vehicleId': 'AJ-AMB',  'name': '선예진', 'rank': '소방교', 'oxygenPct': None},
    {'id': 'AJ-AMB-M2',  'vehicleId': 'AJ-AMB',  'name': '팽수아', 'rank': '소방사', 'oxygenPct': None},
    # AJ-SLD
    {'id': 'AJ-SLD-M1',  'vehicleId': 'AJ-SLD',  'name': '은태원', 'rank': '소방교', 'oxygenPct': None},
    {'id': 'AJ-SLD-M2',  'vehicleId': 'AJ-SLD',  'name': '위준서', 'rank': '소방사', 'oxygenPct': None},
]

# ── 위상 계산 (JS 시뮬레이션과 동일한 공식) ──────────────────
PHI = 0.618  # 황금비 켤레
V_PHASE  = {v['id']: i * PHI for i, v in enumerate(VEHICLES)}
M_PHASE  = {}
for vi, v in enumerate(VEHICLES):
    v_members = [m for m in MEMBERS if m['vehicleId'] == v['id']]
    for mi, m in enumerate(v_members):
        M_PHASE[m['id']] = vi * PHI + mi * PHI + math.pi

# ── UWB 하드웨어 수신 위치 (하드웨어 연결 시 덮어씀) ─────────
_uwb_override = {}   # { member_id: (lon, lat, alt) }
_gps_override = {}   # { vehicle_id: (lon, lat, alt) }

# ── 연결된 클라이언트 집합 ──────────────────────────────────
CLIENTS: set = set()

def _get_position(v, t):
    """차량 위치 계산 (GPS 오버라이드 우선)"""
    if v['id'] in _gps_override:
        lon, lat, alt = _gps_override[v['id']]
        return lon, lat, alt

    if v['id'] == 'CMD-1':
        return v['lon'], v['lat'], 0.0

    ph = V_PHASE[v['id']]
    d_lon = (math.sin(t * 0.28 + ph) * 0.000008 +
             math.sin(t * 0.71 + ph * 1.3) * 0.000003)
    d_lat = (math.cos(t * 0.23 + ph) * 0.000008 +
             math.cos(t * 0.59 + ph * 0.9) * 0.000003)
    alt = (v['alt'] + 3 + math.sin(t * 0.4 + ph) * 0.25) if v['indoor'] else 3.0

    return v['lon'] + d_lon, v['lat'] + d_lat, alt

def _get_member_position(m, v_lon, v_lat, v_alt, t):
    """대원 위치 계산 (UWB 오버라이드 우선)"""
    if m['id'] in _uwb_override:
        return _uwb_override[m['id']]

    ph     = M_PHASE.get(m['id'], 0.0)
    offset = 0.000022  # ≈ 2.5m
    lon    = v_lon + math.sin(t * 0.11 + ph) * offset
    lat    = v_lat + math.cos(t * 0.13 + ph) * offset
    # 실내 대원은 차량 고도를 따름
    v_obj  = next((v for v in VEHICLES if v['id'] == m['vehicleId']), None)
    if v_obj and v_obj['indoor']:
        alt = v_obj['alt'] + 3 + math.sin(t * 0.3 + ph) * 0.3
    else:
        alt = 1.0
    return lon, lat, alt

# ── 브로드캐스트 ─────────────────────────────────────────────
async def _broadcast(msg: str):
    if not CLIENTS:
        return
    dead = set()
    for ws in CLIENTS:
        try:
            await ws.send(msg)
        except Exception:
            dead.add(ws)
    CLIENTS.difference_update(dead)

# ── 위치 브로드캐스트 루프 (250ms) ──────────────────────────
async def _broadcast_loop():
    start = time.monotonic()
    while True:
        await asyncio.sleep(0.25)
        if not CLIENTS:
            continue

        t = time.monotonic() - start
        messages = []

        # 차량 위치
        for v in VEHICLES:
            lon, lat, alt = _get_position(v, t)
            messages.append(json.dumps({
                'type': 'pos',
                'id':   v['id'],
                'lon':  round(lon, 7),
                'lat':  round(lat, 7),
                'alt':  round(alt, 2),
            }))

        # 대원 위치
        v_pos = {v['id']: _get_position(v, t) for v in VEHICLES}
        for m in MEMBERS:
            v_lon, v_lat, v_alt = v_pos.get(m['vehicleId'], (0, 0, 0))
            lon, lat, alt = _get_member_position(m, v_lon, v_lat, v_alt, t)
            messages.append(json.dumps({
                'type':      'member_pos',
                'id':        m['id'],
                'vehicleId': m['vehicleId'],
                'lon':  round(lon, 7),
                'lat':  round(lat, 7),
                'alt':  round(alt, 2),
            }))

        batch = '\n'.join(messages)
        # 배치를 개별 메시지로 분리해서 전송
        for msg in messages:
            await _broadcast(msg)

# ── 클라이언트 핸들러 ────────────────────────────────────────
async def _handle_client(ws):
    CLIENTS.add(ws)
    remote = ws.remote_address
    logger.info(f'클라이언트 연결: {remote}  (총 {len(CLIENTS)}개)')

    # init 패킷 전송
    init_msg = json.dumps({
        'type':     'init',
        'vehicles': VEHICLES,
        'members':  MEMBERS,
    })
    try:
        await ws.send(init_msg)
        logger.info(f'init 전송 → {remote}  차량:{len(VEHICLES)}대  대원:{len(MEMBERS)}명')
    except Exception as e:
        logger.warning(f'init 전송 실패: {e}')
        CLIENTS.discard(ws)
        return

    # 메시지 수신 루프 (하드웨어 UWB/GPS 포워딩)
    try:
        async for raw in ws:
            try:
                pkt = json.loads(raw)
                await _handle_hardware_packet(pkt, ws)
            except json.JSONDecodeError:
                pass
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        CLIENTS.discard(ws)
        logger.info(f'클라이언트 종료: {remote}  (남은 {len(CLIENTS)}개)')

async def _handle_hardware_packet(pkt, sender_ws):
    """UWB/GPS 하드웨어에서 수신한 패킷 처리"""
    ptype = pkt.get('type')

    if ptype == 'uwb':
        # UWB 상대좌표 → WGS84 변환 후 저장 및 전파
        mid = pkt.get('id')
        if not mid:
            return
        lon, lat, alt = uwb_to_wgs84(
            pkt.get('x', 0), pkt.get('y', 0), pkt.get('z', 0)
        )
        _uwb_override[mid] = (lon, lat, alt)
        m_obj = next((m for m in MEMBERS if m['id'] == mid), None)
        vehicle_id = m_obj['vehicleId'] if m_obj else 'unknown'
        await _broadcast(json.dumps({
            'type': 'member_pos', 'id': mid, 'vehicleId': vehicle_id,
            'lon': round(lon, 7), 'lat': round(lat, 7), 'alt': round(alt, 2),
        }))

    elif ptype == 'gps':
        # GPS 실측값 저장 및 전파
        vid = pkt.get('id')
        if not vid:
            return
        lon = pkt.get('lon', 0)
        lat = pkt.get('lat', 0)
        alt = pkt.get('alt', 3)
        _gps_override[vid] = (lon, lat, alt)
        await _broadcast(json.dumps({
            'type': 'pos', 'id': vid,
            'lon': round(lon, 7), 'lat': round(lat, 7), 'alt': round(alt, 2),
        }))

# ── 메인 ─────────────────────────────────────────────────────
async def main(host: str, port: int):
    logger.info(f'서버 시작: ws://{host}:{port}')
    logger.info(f'차량: {len(VEHICLES)}대  대원: {len(MEMBERS)}명')
    logger.info('브라우저에서 VITE_WS_URL=ws://localhost:8765 설정 필요')

    async with serve(_handle_client, host, port):
        await _broadcast_loop()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='FIRE.TWIN WebSocket 서버')
    parser.add_argument('--host', default='0.0.0.0', help='바인딩 호스트 (기본: 0.0.0.0)')
    parser.add_argument('--port', type=int, default=8765, help='포트 (기본: 8765)')
    args = parser.parse_args()

    try:
        asyncio.run(main(args.host, args.port))
    except KeyboardInterrupt:
        logger.info('서버 종료')
