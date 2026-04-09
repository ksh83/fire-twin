import * as Cesium from 'cesium';
import { VEHICLES } from './data/vehicles.js';

/**
 * GPS/UWB 실시간 위치 시뮬레이터
 *
 * 실제 배포 시 이 모듈 전체를 WebSocket 수신으로 교체한다.
 * 인터페이스는 동일하게 유지: updatePosition(id, lon, lat, alt)
 */

// 외부에서 주입받는 Cesium 엔티티 맵
let _vehicleEntities = {};

// 위치 갱신 콜백 (UI 동기화용)
let _onPositionUpdate = null;

// ── 시뮬레이터 시작 ──────────────────────────────────────────
export function startSimulation(vehicleEntities, onPositionUpdate) {
  _vehicleEntities = vehicleEntities;
  _onPositionUpdate = onPositionUpdate;

  let simTime = 0;
  // 차량마다 다른 위상(phase)으로 자연스러운 움직임
  const phase = {};
  VEHICLES.forEach((v, i) => { phase[v.id] = i * 0.618; }); // 황금비 간격

  setInterval(() => {
    simTime += 0.25;

    VEHICLES.forEach(v => {
      if (v.id === 'CMD-1') return; // 지휘차는 고정

      const ph = phase[v.id];

      // GPS 오차 시뮬레이션 (±~1m 범위 진동)
      // 소수점 6자리 ≈ 0.11m → 0.000008 ≈ 0.88m
      const dLon = Math.sin(simTime * 0.28 + ph) * 0.000008
                 + Math.sin(simTime * 0.71 + ph * 1.3) * 0.000003;
      const dLat = Math.cos(simTime * 0.23 + ph) * 0.000008
                 + Math.cos(simTime * 0.59 + ph * 0.9) * 0.000003;

      // 실내 대원: 고도도 미세 변동 (호흡·이동)
      const alt = v.indoor
        ? v.alt + 3 + Math.sin(simTime * 0.4 + ph) * 0.25
        : 3;

      const newLon = v.lon + dLon;
      const newLat = v.lat + dLat;

      // Cesium 엔티티 위치 갱신
      updatePosition(v.id, newLon, newLat, alt);
    });
  }, 250);
}

// ── 위치 갱신 (내부 + WebSocket 공용 인터페이스) ─────────────
export function updatePosition(id, lon, lat, alt) {
  const entity = _vehicleEntities[id];
  if (entity) {
    entity.position = Cesium.Cartesian3.fromDegrees(lon, lat, alt);
  }
  // UI 콜백 호출
  if (_onPositionUpdate) {
    _onPositionUpdate(id, lon, lat, alt);
  }
}

// ── WebSocket 수신 인터페이스 (실제 UWB 연동 시 활성화) ──────
// 아래 함수를 startSimulation() 대신 호출하면 실제 데이터를 수신한다.
//
// export function connectWebSocket(vehicleEntities, onPositionUpdate, url = 'ws://localhost:8765') {
//   _vehicleEntities = vehicleEntities;
//   _onPositionUpdate = onPositionUpdate;
//
//   const ws = new WebSocket(url);
//   ws.onopen    = ()  => console.log('[FIRE.TWIN] WebSocket 연결됨:', url);
//   ws.onmessage = (e) => {
//     try {
//       const { id, lon, lat, alt } = JSON.parse(e.data);
//       // 예상 패킷 형태: { id:'RSC-1', lon:127.0283, lat:37.4987, alt:8.5, ts:1234567890 }
//       updatePosition(id, lon, lat, alt);
//     } catch (err) {
//       console.warn('[FIRE.TWIN] 패킷 파싱 에러:', err);
//     }
//   };
//   ws.onclose   = ()  => setTimeout(() => connectWebSocket(vehicleEntities, onPositionUpdate, url), 3000);
//   ws.onerror   = (e) => console.error('[FIRE.TWIN] WebSocket 에러:', e);
// }
