import * as Cesium from 'cesium';
import { VEHICLES } from './data/vehicles.js';

/**
 * GPS/UWB 실시간 위치 시뮬레이터 + WebSocket 클라이언트
 *
 * 동작 순서:
 *   1. VITE_WS_URL (기본 ws://localhost:8765) 에 WebSocket 연결 시도
 *   2. 3초 안에 연결 성공 → WebSocket 모드 (서버 패킷 수신)
 *   3. 연결 실패 / 없음   → 로컬 시뮬레이션 모드 (자동 전환)
 *   4. WebSocket 연결 끊김 → 5초 후 재연결 시도
 *
 * WebSocket 패킷 (서버 → 클라이언트):
 *   { type: 'init',        vehicles: [...], members: [...] }
 *   { type: 'pos',         id, lon, lat, alt }
 *   { type: 'member_pos',  id, vehicleId, lon, lat, alt }
 *   { type: 'status',      id, statusLevel, status }
 *   { type: 'alert',       time, level, text }
 *   { type: 'vehicle_add', vehicle: {...} }
 *
 * WebSocket 패킷 (클라이언트 → 서버, 향후 UWB 하드웨어):
 *   { type: 'uwb', id, x, y, z }
 *   { type: 'gps', id, lon, lat }
 */

// ── 내부 상태 ────────────────────────────────────────────────
let _vehicleEntities = {};
let _callbacks       = {};
let _wsMode          = false;
let _simTimer        = null;
let _scenarioMode    = false;  // true 시 시뮬레이션 위치 업데이트 억제

// ── 시나리오 모드 전환 ───────────────────────────────────────
export function setScenarioMode(active) {
  _scenarioMode = active;
}

// ── 진입점 ───────────────────────────────────────────────────
/**
 * @param {Object}   vehicleEntities   main.js의 vehicleEntities 맵 (공유 참조)
 * @param {Function} onPositionUpdate  (id, lon, lat, alt) → UI 좌표 갱신
 * @param {Object}   callbacks         추가 이벤트 콜백
 *   .onMemberPosition (id, lon, lat, alt)
 *   .onInit           (vehicles, members)  ← WebSocket init 패킷
 *   .onVehicleAdd     (vehicle)            ← 동적 차량 추가
 *   .onStatusChange   (id, statusLevel, status)
 *   .onAlert          (alert)
 *   .onWsStatus       (connected: bool)
 */
export function startSimulation(vehicleEntities, onPositionUpdate, callbacks = {}) {
  _vehicleEntities = vehicleEntities;
  _callbacks = {
    onPosition:       onPositionUpdate,
    onMemberPosition: callbacks.onMemberPosition  || null,
    onInit:           callbacks.onInit            || null,
    onVehicleAdd:     callbacks.onVehicleAdd      || null,
    onStatusChange:   callbacks.onStatusChange    || null,
    onAlert:          callbacks.onAlert           || null,
    onWsStatus:       callbacks.onWsStatus        || null,
  };

  _tryWebSocket();
}

// ── WebSocket 연결 시도 ──────────────────────────────────────
function _tryWebSocket() {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const wsUrl   = (import.meta.env.VITE_WS_URL || 'ws://localhost:8765');

  // 배포 환경에서는 로컬 서버가 없을 확률이 99%이므로 로컬 시뮬레이션을 먼저 띄워둔다.
  if (!isLocal) {
    console.info('[FIRE.TWIN] 배포 환경 감지: 로컬 시뮬레이션 우선 모드');
    _startLocalSim();
    // 배포 환경에서도 서버가 있을 수 있으므로 연결은 시도하되 조용히 처리
  }

  let ws;
  try {
    ws = new WebSocket(wsUrl);
  } catch (err) {
    if (isLocal) console.warn('[FIRE.TWIN] WebSocket 생성 실패:', err);
    if (!_wsMode) _startLocalSim();
    return;
  }

  // 3초 연결 타임아웃 → 로컬 시뮬레이션으로 전환
  const timeout = setTimeout(() => {
    if (ws.readyState !== WebSocket.OPEN) {
      ws.close();
      if (!_wsMode) _startLocalSim();
    }
  }, 3000);

  ws.onopen = () => {
    clearTimeout(timeout);
    _wsMode = true;
    console.info('[FIRE.TWIN] WebSocket 연결됨:', wsUrl);
    if (_callbacks.onWsStatus) _callbacks.onWsStatus(true);
    // 기존 로컬 시뮬레이션 중단
    if (_simTimer) { clearInterval(_simTimer); _simTimer = null; }
  };

  ws.onmessage = (e) => {
    try {
      _handlePacket(JSON.parse(e.data));
    } catch (err) {
      console.warn('[FIRE.TWIN] 패킷 파싱 오류:', err);
    }
  };

  ws.onclose = () => {
    const wasConnected = _wsMode;
    _wsMode = false;
    if (wasConnected) {
      console.info('[FIRE.TWIN] WebSocket 연결 끊김 → 로컬 시뮬레이션 전환');
      if (_callbacks.onWsStatus) _callbacks.onWsStatus(false);
      _startLocalSim();
    }
    // 5초 후 재연결 시도
    setTimeout(_tryWebSocket, 5000);
  };

  ws.onerror = () => {
    clearTimeout(timeout);
    ws.close();
    if (!_wsMode) _startLocalSim();
  };
}

// ── 패킷 처리 ────────────────────────────────────────────────
function _handlePacket(pkt) {
  switch (pkt.type) {

    case 'init':
      // 서버에서 최초 현장 차량 목록 수신
      if (_callbacks.onInit) _callbacks.onInit(pkt.vehicles || [], pkt.members || []);
      break;

    case 'pos':
      _updateVehiclePos(pkt.id, pkt.lon, pkt.lat, pkt.alt);
      break;

    case 'member_pos':
      if (_callbacks.onMemberPosition)
        _callbacks.onMemberPosition(pkt.id, pkt.lon, pkt.lat, pkt.alt);
      break;

    case 'status':
      if (_callbacks.onStatusChange)
        _callbacks.onStatusChange(pkt.id, pkt.statusLevel, pkt.status);
      break;

    case 'alert':
      if (_callbacks.onAlert) _callbacks.onAlert(pkt);
      break;

    case 'vehicle_add':
      if (_callbacks.onVehicleAdd && pkt.vehicle)
        _callbacks.onVehicleAdd(pkt.vehicle);
      break;

    default:
      // 알 수 없는 패킷 무시
      break;
  }
}

// ── 공용 위치 갱신 ───────────────────────────────────────────
function _updateVehiclePos(id, lon, lat, alt) {
  const entity = _vehicleEntities[id];
  if (entity) entity.position = Cesium.Cartesian3.fromDegrees(lon, lat, alt);
  if (_callbacks.onPosition) _callbacks.onPosition(id, lon, lat, alt);
}

// ── 로컬 시뮬레이션 (WebSocket 미연결 폴백) ──────────────────
function _startLocalSim() {
  if (_simTimer) return; // 이미 실행 중
  console.info('[FIRE.TWIN] 로컬 시뮬레이션 모드');
  if (_callbacks.onWsStatus) _callbacks.onWsStatus(false);

  let simTime = 0;

  // 차량별 위상 (황금비 간격으로 자연스러운 분산)
  const vPhase = {};
  VEHICLES.forEach((v, i) => { vPhase[v.id] = i * 0.618; });

  // 대원별 위상
  const mPhase = {};
  VEHICLES.forEach((v, i) => {
    (v.members || []).forEach((m, mi) => {
      mPhase[m.id] = i * 0.618 + mi * 0.618 + Math.PI;
    });
  });

  _simTimer = setInterval(() => {
    simTime += 0.25;

    // 시나리오 모드 활성 시 위치 업데이트 억제
    if (_scenarioMode) return;

    VEHICLES.forEach(v => {
      const ph = vPhase[v.id];

      // 차량 위치 (CMD-1 고정)
      let newLon = v.lon;
      let newLat = v.lat;
      let alt    = v.indoor ? v.alt + 3 : 3;

      if (v.id !== 'CMD-1') {
        const dLon = Math.sin(simTime * 0.28 + ph) * 0.000008
                   + Math.sin(simTime * 0.71 + ph * 1.3) * 0.000003;
        const dLat = Math.cos(simTime * 0.23 + ph) * 0.000008
                   + Math.cos(simTime * 0.59 + ph * 0.9) * 0.000003;
        if (v.indoor) alt = v.alt + 3 + Math.sin(simTime * 0.4 + ph) * 0.25;
        newLon = v.lon + dLon;
        newLat = v.lat + dLat;
      }

      _updateVehiclePos(v.id, newLon, newLat, alt);

      // 대원 개인 위치 (차량 주변 ±2~4m 이동)
      if (_callbacks.onMemberPosition) {
        (v.members || []).forEach(m => {
          const mph    = mPhase[m.id];
          const offset = 0.000022; // ~2.5m
          const mLon   = newLon + Math.sin(simTime * 0.11 + mph) * offset;
          const mLat   = newLat + Math.cos(simTime * 0.13 + mph) * offset;
          const mAlt   = v.indoor
            ? v.alt + 3 + Math.sin(simTime * 0.3 + mph) * 0.3
            : 1;
          _callbacks.onMemberPosition(m.id, mLon, mLat, mAlt);
        });
      }
    });
  }, 250);
}

// ── 외부에서 직접 위치 주입 (하드웨어 UWB 연동 시 사용) ──────
export function injectPosition(id, lon, lat, alt) {
  _updateVehiclePos(id, lon, lat, alt);
}
