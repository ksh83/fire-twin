import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './style.css';

import { VEHICLES, INCIDENT, STATUS_COLOR, UNIT_COLOR, TYPE_ABBR } from './data/vehicles.js';
import {
  buildLayout, renderVehicleCards, addVehicleCard,
  startClock, startElapsed, hideLoading,
  updateVehicleCard, updateVehicleCoords,
  pushAlert, setWsStatus, setVWorldStatus,
} from './ui.js';
import { startSimulation, setScenarioMode } from './simulation.js';
import { initVWorldLayer } from './layers/vworld.js';
import { ScenarioEngine } from './scenario/engine.js';
import {
  injectScenarioUI, bindScenarioPanel,
  updateScenarioTime, showCaption, getStationMarkers,
} from './scenario/panel.js';

// ── 1. HTML 레이아웃 주입 ────────────────────────────────────
buildLayout();

// ── 2. Cesium 토큰 설정 ──────────────────────────────────────
Cesium.Ion.defaultAccessToken =
  import.meta.env.VITE_CESIUM_TOKEN || 'YOUR_TOKEN_HERE';

// ── 3. Viewer 초기화 ─────────────────────────────────────────
const viewer = new Cesium.Viewer('cesiumContainer', {
  terrain:              Cesium.Terrain.fromWorldTerrain(),
  animation:            false,
  baseLayerPicker:      false,
  fullscreenButton:     false,
  geocoder:             false,
  homeButton:           false,
  infoBox:              true,
  sceneModePicker:      false,
  selectionIndicator:   true,
  timeline:             false,
  navigationHelpButton: false,
  shadows:              true,
  shouldAnimate:        true,
});

viewer.scene.skyAtmosphere = new Cesium.SkyAtmosphere();
viewer.scene.globe.enableLighting = true;

// ── 4. OSM 3D 건물 레이어 ────────────────────────────────────
let buildingsTileset = null;

Cesium.createOsmBuildingsAsync()
  .then(tileset => {
    buildingsTileset = tileset;
    viewer.scene.primitives.add(tileset);
  })
  .catch(e => console.warn('OSM Buildings 로드 실패:', e));

// ── 5. V-World 레이어 ────────────────────────────────────────
const vworldLayer = initVWorldLayer(viewer);
setVWorldStatus(!!vworldLayer);

// ── 6. 전술 DataSource (차량 + 대원 엔티티) ─────────────────
// CustomDataSource를 사용해야 EntityCluster 클러스터링이 동작한다
const tacticalDS = new Cesium.CustomDataSource('tactical');
viewer.dataSources.add(tacticalDS);

// 클러스터링 초기 설정 (기본 OFF, 버튼으로 토글)
tacticalDS.clustering.enabled = false;
tacticalDS.clustering.pixelRange = 30;
tacticalDS.clustering.minimumClusterSize = 4;

// 클러스터 외관 커스터마이징
tacticalDS.clustering.clusterEvent.addEventListener((clusteredEntities, cluster) => {
  cluster.label.show = false;
  cluster.billboard.show = true;
  cluster.billboard.id    = cluster.label.id;
  cluster.billboard.verticalOrigin = Cesium.VerticalOrigin.BOTTOM;
  cluster.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY;

  const count = clusteredEntities.length;
  const color = count >= 10 ? '#ff4422' : count >= 6 ? '#ffb300' : '#2fa8ff';
  cluster.billboard.image = _makeClusterCanvas(count, color);
});

// ── 7. 아이콘 생성 헬퍼 ─────────────────────────────────────
function _makeVehicleCanvas(v) {
  const c   = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');

  const unitCol = UNIT_COLOR[v.unit] || '#888888';
  const statCol = STATUS_COLOR[v.statusLevel] || '#ffffff';

  // 헤일로 (소속색 반투명)
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, Math.PI * 2);
  ctx.fillStyle = unitCol + '22';
  ctx.fill();

  // 배경 원 (소속색)
  ctx.beginPath();
  ctx.arc(32, 32, 24, 0, Math.PI * 2);
  ctx.fillStyle = unitCol + 'cc';
  ctx.fill();

  // 상태 링 (운용 상태색)
  ctx.beginPath();
  ctx.arc(32, 32, 29, 0, Math.PI * 2);
  ctx.strokeStyle = statCol;
  ctx.lineWidth = v.statusLevel === 'danger' ? 4 : 2.5;
  ctx.stroke();

  // 차종 텍스트
  const abbr = TYPE_ABBR[v.role] || v.label.slice(0, 2);
  ctx.font = 'bold 13px "Malgun Gothic", "Noto Sans KR", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur  = 3;
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(abbr, 32, 32);
  ctx.shadowBlur = 0;

  // 실내 층 배지
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

function _makeMemberCanvas(member, vehicle) {
  const c   = document.createElement('canvas');
  c.width = 28; c.height = 28;
  const ctx = c.getContext('2d');

  const unitCol = UNIT_COLOR[vehicle.unit] || '#888888';
  const statCol = STATUS_COLOR[vehicle.statusLevel] || '#ffffff';

  // 배경 원
  ctx.beginPath();
  ctx.arc(14, 14, 12, 0, Math.PI * 2);
  ctx.fillStyle = unitCol + '99';
  ctx.fill();

  // 테두리
  ctx.beginPath();
  ctx.arc(14, 14, 12, 0, Math.PI * 2);
  ctx.strokeStyle = statCol;
  ctx.lineWidth = vehicle.statusLevel === 'danger' ? 2.5 : 1.5;
  ctx.stroke();

  // 이름 마지막 글자
  const initial = member.name ? member.name.slice(-1) : '대';
  ctx.font = 'bold 9px "Malgun Gothic", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initial, 14, 14);

  // 산소 경고 배지 (30% 미만)
  if (member.oxygenPct !== null && member.oxygenPct !== undefined && member.oxygenPct < 30) {
    ctx.beginPath();
    ctx.arc(22, 6, 5, 0, Math.PI * 2);
    ctx.fillStyle = STATUS_COLOR.danger;
    ctx.fill();
    ctx.font = 'bold 7px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 22, 6);
  }

  return c.toDataURL();
}

function _makeClusterCanvas(count, color) {
  const c   = document.createElement('canvas');
  c.width = 48; c.height = 48;
  const ctx = c.getContext('2d');

  // 외곽 링
  ctx.beginPath();
  ctx.arc(24, 24, 22, 0, Math.PI * 2);
  ctx.fillStyle = color + '33';
  ctx.fill();

  // 내부 원
  ctx.beginPath();
  ctx.arc(24, 24, 15, 0, Math.PI * 2);
  ctx.fillStyle = color + 'dd';
  ctx.fill();

  // 테두리
  ctx.beginPath();
  ctx.arc(24, 24, 22, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 숫자
  ctx.font = 'bold 14px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(count), 24, 24);

  return c.toDataURL();
}

function _makeFireCanvas() {
  const c   = document.createElement('canvas');
  c.width = 42; c.height = 52;
  const ctx = c.getContext('2d');
  const g   = ctx.createRadialGradient(21, 38, 2, 21, 22, 22);
  g.addColorStop(0,   'rgba(255,200,50,0.95)');
  g.addColorStop(0.5, 'rgba(255,80,20,0.9)');
  g.addColorStop(1,   'rgba(200,20,0,0.7)');
  ctx.beginPath();
  ctx.moveTo(21, 50);
  ctx.bezierCurveTo(4, 42, 4, 26, 12, 18);
  ctx.bezierCurveTo(12, 30, 19, 32, 19, 32);
  ctx.bezierCurveTo(17, 22, 21, 10, 26, 2);
  ctx.bezierCurveTo(30, 14, 36, 22, 32, 34);
  ctx.bezierCurveTo(36, 28, 38, 44, 21, 50);
  ctx.fillStyle = g;
  ctx.fill();
  return c.toDataURL();
}

// ── 8. 차량 엔티티 생성 ──────────────────────────────────────
const vehicleEntities = {};
const memberEntities  = {};

// vehicles.js + 동적 추가 차량을 포함하는 런타임 맵
const vehicleDataMap = {};
VEHICLES.forEach(v => { vehicleDataMap[v.id] = v; });

function _addVehicleEntity(v) {
  if (vehicleEntities[v.id]) return; // 이미 존재

  const col = Cesium.Color.fromCssColorString(STATUS_COLOR[v.statusLevel] || '#ffffff');

  const entity = tacticalDS.entities.add({
    id: v.id,
    name: `[${v.unit}] ${v.shortLabel} — ${v.type}`,
    position: Cesium.Cartesian3.fromDegrees(v.lon, v.lat, v.alt + 3),
    billboard: {
      image: _makeVehicleCanvas(v),
      width: 64, height: 64,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      heightReference: v.indoor
        ? Cesium.HeightReference.NONE
        : Cesium.HeightReference.CLAMP_TO_GROUND,
    },
    label: {
      text: v.shortLabel,
      font: 'bold 13px "Malgun Gothic", "Noto Sans KR", monospace',
      fillColor: col,
      outlineColor: Cesium.Color.fromCssColorString('#060810'),
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.TOP,
      pixelOffset: new Cesium.Cartesian2(0, 6),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      heightReference: v.indoor
        ? Cesium.HeightReference.NONE
        : Cesium.HeightReference.CLAMP_TO_GROUND,
    },
    description: _makeVehicleDescription(v),
  });

  vehicleEntities[v.id] = entity;

  // 실내 차량 수직 점선
  if (v.indoor) {
    viewer.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights([
          v.lon, v.lat, 0,
          v.lon, v.lat, v.alt + 3,
        ]),
        width: 2,
        material: new Cesium.PolylineDashMaterialProperty({
          color: col, dashLength: 8,
        }),
      },
    });
  }

  // CMD-1 → 각 차량 거리선
  if (v.id !== 'CMD-1') {
    const cmd = VEHICLES[0];
    viewer.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights([
          cmd.lon, cmd.lat, 1,
          v.lon, v.lat, 1,
        ]),
        width: 1,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.fromCssColorString('#1a2230'),
          dashLength: 12,
        }),
        clampToGround: true,
      },
    });
  }
}

function _makeVehicleDescription(v) {
  const statCol = STATUS_COLOR[v.statusLevel] || '#ffffff';
  return `
    <div style="font-family:'IBM Plex Mono',monospace;background:#0c1018;
                color:#dde4ee;padding:13px;border-radius:6px;min-width:210px;">
      <div style="color:${statCol};font-weight:700;font-size:14px;margin-bottom:6px;">${v.shortLabel}</div>
      <div style="font-size:10px;color:#4a5568;margin-bottom:8px;">${v.type}</div>
      <table style="font-size:10px;width:100%;border-collapse:collapse;">
        <tr><td style="color:#2fa8ff;padding:2px 8px 2px 0;white-space:nowrap">상태</td>
            <td style="color:${statCol}">${v.status}</td></tr>
        <tr><td style="color:#2fa8ff;padding:2px 8px 2px 0;white-space:nowrap">절대위치</td>
            <td>${v.absCoord}</td></tr>
        <tr><td style="color:#2fa8ff;padding:2px 8px 2px 0;white-space:nowrap">상대위치</td>
            <td>${v.relCoord}</td></tr>
        <tr><td style="color:#2fa8ff;padding:2px 8px 2px 0;white-space:nowrap">탑승대원</td>
            <td>${v.crew}명</td></tr>
      </table>
    </div>`;
}

// ── 9. 대원 엔티티 생성 ──────────────────────────────────────
function _addMemberEntities(vehicle) {
  const members = vehicle.members || [];
  const n = members.length;
  if (n === 0) return;

  members.forEach((member, i) => {
    if (memberEntities[member.id]) return;

    // 차량 중심에서 원형 배치 (~2.5m 반경)
    const angle  = (i / n) * Math.PI * 2;
    const offset = 0.000022; // ≈ 2.5m
    const mLon   = vehicle.lon + Math.cos(angle) * offset;
    const mLat   = vehicle.lat + Math.sin(angle) * offset;
    const mAlt   = vehicle.indoor ? vehicle.alt + 3 : 1;

    const entity = tacticalDS.entities.add({
      id:   `member-${member.id}`,
      name: `${member.name} (${member.rank}) · ${vehicle.shortLabel}`,
      position: Cesium.Cartesian3.fromDegrees(mLon, mLat, mAlt),
      billboard: {
        image: _makeMemberCanvas(member, vehicle),
        width:  28, height: 28,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        heightReference: vehicle.indoor
          ? Cesium.HeightReference.NONE
          : Cesium.HeightReference.CLAMP_TO_GROUND,
        // 줌아웃 시 점점 작아짐 (과도한 렌더링 방지)
        scaleByDistance: new Cesium.NearFarScalar(50, 1.0, 800, 0.2),
        translucencyByDistance: new Cesium.NearFarScalar(100, 1.0, 1200, 0.0),
      },
    });

    memberEntities[member.id] = { entity, vehicleId: vehicle.id, data: member };
  });
}

// 전체 차량 엔티티 생성
VEHICLES.forEach(v => {
  _addVehicleEntity(v);
  _addMemberEntities(v);
});

// ── 10. 화재건물 마커 ────────────────────────────────────────
viewer.entities.add({
  position: Cesium.Cartesian3.fromDegrees(INCIDENT.lon, INCIDENT.lat, 22),
  billboard: {
    image: _makeFireCanvas(),
    width: 42, height: 52,
    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  },
  label: {
    text: '🔥 화재건물\n5층 / 3층 화재',
    font: 'bold 11px "IBM Plex Mono", monospace',
    fillColor: Cesium.Color.fromCssColorString('#ff4422'),
    outlineColor: Cesium.Color.fromCssColorString('#060810'),
    outlineWidth: 3,
    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    verticalOrigin: Cesium.VerticalOrigin.TOP,
    pixelOffset: new Cesium.Cartesian2(0, 8),
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
    showBackground: true,
    backgroundColor: Cesium.Color.fromCssColorString('rgba(255,68,34,0.1)'),
    backgroundPadding: new Cesium.Cartesian2(6, 4),
  },
});

// ── 11. 엔티티 상태 업데이트 (WebSocket status 패킷) ────────
function _updateEntityStatus(id, statusLevel, status) {
  const entity = vehicleEntities[id];
  const v      = vehicleDataMap[id];
  if (!entity || !v) return;

  // 런타임 데이터 갱신
  v.statusLevel = statusLevel;
  v.status      = status;

  // Cesium 엔티티 아이콘·색상 재생성
  entity.billboard.image = _makeVehicleCanvas(v);
  const col = Cesium.Color.fromCssColorString(STATUS_COLOR[statusLevel] || '#ffffff');
  entity.label.fillColor = col;
  entity.description     = _makeVehicleDescription(v);

  // UI 카드 업데이트
  updateVehicleCard(id, status, statusLevel);
}

// ── 12. 동적 차량 추가 (WebSocket vehicle_add / init) ───────
function _handleVehicleAdd(v) {
  if (vehicleDataMap[v.id]) return; // 이미 있으면 스킵
  vehicleDataMap[v.id] = v;
  _addVehicleEntity(v);
  _addMemberEntities(v);
  addVehicleCard(v, _selectVehicle);
}

// ── 13. 카메라 함수 ──────────────────────────────────────────
export function flyToIncident() {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(
      INCIDENT.lon - 0.001,
      INCIDENT.lat - 0.002,
      320,
    ),
    orientation: {
      heading: Cesium.Math.toRadians(20),
      pitch:   Cesium.Math.toRadians(-40),
      roll: 0,
    },
    duration: 2.5,
  });
}

function _setView(type) {
  const views = {
    '3d':       { pos: [INCIDENT.lon - 0.002, INCIDENT.lat - 0.002, 500], h: 25,  p: -38 },
    'overhead': { pos: [INCIDENT.lon,          INCIDENT.lat,          400], h: 0,   p: -90 },
    'tactical': { pos: [VEHICLES[0].lon - 0.001, VEHICLES[0].lat, 55],    h: 80,  p: -20 },
  };
  const v = views[type];
  if (!v) return;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(...v.pos),
    orientation: {
      heading: Cesium.Math.toRadians(v.h),
      pitch:   Cesium.Math.toRadians(v.p),
      roll: 0,
    },
    duration: 2,
  });
}

function _selectVehicle(id) {
  const v = vehicleDataMap[id];
  if (!v) return;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(v.lon, v.lat, 200),
    orientation: {
      heading: 0,
      pitch:   Cesium.Math.toRadians(-45),
      roll: 0,
    },
    duration: 1.8,
  });
  const entity = vehicleEntities[id];
  if (entity) viewer.selectedEntity = entity;
}

// ── 14. UI 이벤트 바인딩 ─────────────────────────────────────
renderVehicleCards(_selectVehicle);

const btnMap = { 'btn-3d': '3d', 'btn-overhead': 'overhead', 'btn-tactical': 'tactical' };
Object.entries(btnMap).forEach(([btnId, viewKey]) => {
  document.getElementById(btnId)?.addEventListener('click', e => {
    document.querySelectorAll('.vbtn').forEach(b => b.classList.remove('active'));
    e.currentTarget.classList.add('active');
    _setView(viewKey);
  });
});

document.getElementById('btn-bldg')?.addEventListener('click', () => {
  if (buildingsTileset) buildingsTileset.show = !buildingsTileset.show;
});

document.getElementById('btn-fire')?.addEventListener('click', flyToIncident);

// 클러스터링 토글
let _clusterEnabled = false;
document.getElementById('btn-cluster')?.addEventListener('click', e => {
  _clusterEnabled = !_clusterEnabled;
  tacticalDS.clustering.enabled = _clusterEnabled;
  e.currentTarget.textContent = `클러스터 ${_clusterEnabled ? 'OFF' : 'ON'}`;
  e.currentTarget.classList.toggle('active', _clusterEnabled);
});

// ── 15. 시계 & 경과시간 ──────────────────────────────────────
startClock();
startElapsed();

// ── 16. 지도 로드 완료 → 로딩 해제 → 카메라 이동 ───────────
let _loadingHidden = false;
viewer.scene.globe.tileLoadProgressEvent.addEventListener(remaining => {
  if (remaining === 0 && !_loadingHidden) {
    _loadingHidden = true;
    setTimeout(() => { hideLoading(); flyToIncident(); }, 400);
  }
});
setTimeout(() => {
  if (!_loadingHidden) {
    _loadingHidden = true;
    hideLoading();
    flyToIncident();
  }
}, 5000);

document.getElementById('vc-CMD-1')?.classList.add('active');

// ── 17. 실시간 시뮬레이션 / WebSocket 시작 ──────────────────
startSimulation(vehicleEntities, _onPositionUpdate, {

  // 대원 위치 갱신
  onMemberPosition(id, lon, lat, alt) {
    const rec = memberEntities[id];
    if (rec?.entity) {
      rec.entity.position = Cesium.Cartesian3.fromDegrees(lon, lat, alt);
    }
  },

  // WebSocket init → 동적 차량/대원 처리
  onInit(vehicles, members) {
    vehicles.forEach(v => _handleVehicleAdd(v));
    // 대원 데이터 갱신 (미등록 대원 추가)
    members.forEach(m => {
      const vehicle = vehicleDataMap[m.vehicleId];
      if (vehicle && !memberEntities[m.id]) {
        if (!vehicle.members) vehicle.members = [];
        vehicle.members.push(m);
        _addMemberEntities(vehicle);
      }
    });
  },

  // 신규 차량 현장 도착
  onVehicleAdd: _handleVehicleAdd,

  // 차량 상태 변경
  onStatusChange: _updateEntityStatus,

  // 알림 수신
  onAlert: pushAlert,

  // WebSocket 연결 상태
  onWsStatus: setWsStatus,
});

// ── 위치 갱신 콜백 ────────────────────────────────────────────
function _onPositionUpdate(id, lon, lat, alt) {
  const v = vehicleDataMap[id];
  if (!v) return;
  updateVehicleCoords(id, lon, lat, alt, v);
}

// ── 소방서 마커 (시나리오용) ─────────────────────────────────
function _addStationMarkers() {
  const stations = getStationMarkers();
  Object.entries(stations).forEach(([unit, st]) => {
    viewer.entities.add({
      id:       `station-${unit}`,
      name:     st.name,
      position: Cesium.Cartesian3.fromDegrees(st.lon, st.lat, 5),
      billboard: {
        image: _makeStationCanvas(unit),
        width: 48, height: 48,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
      label: {
        text: st.name,
        font: 'bold 11px "Malgun Gothic", "Noto Sans KR", monospace',
        fillColor: Cesium.Color.fromCssColorString('#dde4ee'),
        outlineColor: Cesium.Color.fromCssColorString('#060810'),
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.TOP,
        pixelOffset: new Cesium.Cartesian2(0, 6),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    });
  });
}

function _makeStationCanvas(unit) {
  const UNIT_COL = { 금암: '#0099dd', 전미: '#dd6600', 아중: '#9900cc' };
  const col = UNIT_COL[unit] || '#888888';
  const c   = document.createElement('canvas');
  c.width = 48; c.height = 48;
  const ctx = c.getContext('2d');

  // 소방서 아이콘 (육각형)
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 - Math.PI / 6;
    const x = 24 + 20 * Math.cos(a);
    const y = 24 + 20 * Math.sin(a);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = col + 'bb';
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.stroke();

  // 중앙 텍스트 (소) - 소방서 약칭
  ctx.font = 'bold 14px "Malgun Gothic", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('소', 24, 24);

  return c.toDataURL();
}

// ── 시나리오 엔진 초기화 ─────────────────────────────────────
const scenario = new ScenarioEngine({
  // 차량 위치 갱신
  onPositionUpdate(id, lon, lat, alt) {
    const entity = vehicleEntities[id];
    if (entity) entity.position = Cesium.Cartesian3.fromDegrees(lon, lat, alt);
    _onPositionUpdate(id, lon, lat, alt);
  },

  // 대원 위치 갱신
  onMemberPosition(id, lon, lat, alt) {
    const rec = memberEntities[id];
    if (rec?.entity) rec.entity.position = Cesium.Cartesian3.fromDegrees(lon, lat, alt);
  },

  // 차량 상태 변경
  onStatusChange: _updateEntityStatus,

  // 알림
  onAlert: pushAlert,

  // 자막
  onCaption: showCaption,

  // 타임라인 진행률 갱신
  onTimeUpdate: updateScenarioTime,

  // 카메라 이벤트
  onCamera(target) {
    if (target === 'incident') flyToIncident();
  },

  // 초기화
  onReset() {
    // 로컬 시뮬레이션 재개
    setScenarioMode(false);
  },
});

scenario.setVehicleDataMap(vehicleDataMap);

// 소방서 마커 추가
_addStationMarkers();

// 시나리오 UI 주입 + 버튼 바인딩
injectScenarioUI();
bindScenarioPanel(scenario);

// 재생 시작 시 시뮬레이션 억제
const _origPlay = scenario.play.bind(scenario);
scenario.play = function () {
  setScenarioMode(true);
  _origPlay();
};
