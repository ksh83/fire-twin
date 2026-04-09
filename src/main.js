import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './style.css';

import { VEHICLES, INCIDENT, STATUS_COLOR, UNIT_COLOR, TYPE_ABBR } from './data/vehicles.js';
import {
  buildLayout, renderVehicleCards,
  startClock, startElapsed, hideLoading,
} from './ui.js';
import { startSimulation } from './simulation.js';

// ── 1. HTML 레이아웃 주입 ────────────────────────────────────
buildLayout();

// ── 2. Cesium 토큰 설정 ──────────────────────────────────────
Cesium.Ion.defaultAccessToken =
  import.meta.env.VITE_CESIUM_TOKEN || 'YOUR_TOKEN_HERE';

// ── 3. Viewer 초기화 ─────────────────────────────────────────
const viewer = new Cesium.Viewer('cesiumContainer', {
  terrain:                  Cesium.Terrain.fromWorldTerrain(),
  animation:                false,
  baseLayerPicker:          false,
  fullscreenButton:         false,
  geocoder:                 false,
  homeButton:               false,
  infoBox:                  true,
  sceneModePicker:          false,
  selectionIndicator:       true,
  timeline:                 false,
  navigationHelpButton:     false,
  shadows:                  true,
  shouldAnimate:            true,
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

// ── 5. 아이콘 생성 헬퍼 ─────────────────────────────────────
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

function makeFireCanvas() {
  const c = document.createElement('canvas');
  c.width = 42; c.height = 52;
  const ctx = c.getContext('2d');
  // 불꽃 경로
  const g = ctx.createRadialGradient(21, 38, 2, 21, 22, 22);
  g.addColorStop(0, 'rgba(255,200,50,0.95)');
  g.addColorStop(0.5, 'rgba(255,80,20,0.9)');
  g.addColorStop(1, 'rgba(200,20,0,0.7)');
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

// ── 6. 차량 엔티티 생성 ──────────────────────────────────────
const vehicleEntities = {};

VEHICLES.forEach(v => {
  const col = Cesium.Color.fromCssColorString(STATUS_COLOR[v.statusLevel] || '#ffffff');

  // 메인 엔티티
  const entity = viewer.entities.add({
    id: v.id,
    name: `[${v.unit}] ${v.shortLabel} — ${v.type}`,
    position: Cesium.Cartesian3.fromDegrees(v.lon, v.lat, v.alt + 3),
    billboard: {
      image: makeVehicleCanvas(v),
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
    description: `
      <div style="font-family:'IBM Plex Mono',monospace;background:#0c1018;
                  color:#dde4ee;padding:13px;border-radius:6px;min-width:210px;">
        <div style="color:${STATUS_COLOR[v.statusLevel]};font-weight:700;
                    font-size:14px;margin-bottom:6px;">${v.shortLabel}</div>
        <div style="font-size:10px;color:#4a5568;margin-bottom:8px;">${v.type}</div>
        <table style="font-size:10px;width:100%;border-collapse:collapse;">
          <tr><td style="color:#2fa8ff;padding:2px 8px 2px 0;white-space:nowrap">상태</td>
              <td style="color:${STATUS_COLOR[v.statusLevel]}">${v.status}</td></tr>
          <tr><td style="color:#2fa8ff;padding:2px 8px 2px 0;white-space:nowrap">절대위치</td>
              <td>${v.absCoord}</td></tr>
          <tr><td style="color:#2fa8ff;padding:2px 8px 2px 0;white-space:nowrap">상대위치</td>
              <td>${v.relCoord}</td></tr>
          <tr><td style="color:#2fa8ff;padding:2px 8px 2px 0;white-space:nowrap">탑승대원</td>
              <td>${v.crew}명</td></tr>
        </table>
      </div>`,
  });
  vehicleEntities[v.id] = entity;

  // 실내 차량 수직 점선 (지면 → 현재 고도)
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
});

// 화재건물 마커
viewer.entities.add({
  position: Cesium.Cartesian3.fromDegrees(INCIDENT.lon, INCIDENT.lat, 22),
  billboard: {
    image: makeFireCanvas(),
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

// ── 7. 카메라 함수 ───────────────────────────────────────────
export function flyToIncident() {
  // 카메라를 화재지점 남서쪽에 배치 → 북동방향으로 화재건물을 정면에서 바라보는 구도
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

function setView(type) {
  const views = {
    '3d':       { pos: [INCIDENT.lon - 0.002, INCIDENT.lat - 0.002, 500], h: 25,  p: -38 },
    'overhead': { pos: [INCIDENT.lon,          INCIDENT.lat,          400], h: 0,   p: -90 },
    // 전술시점: CMD-1 서쪽에 카메라 배치 → 현장 방향(동쪽)을 바라보는 지휘관 시점
    'tactical': { pos: [VEHICLES[0].lon - 0.001, VEHICLES[0].lat, 55], h: 80, p: -20 },
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

function selectVehicle(id) {
  const v = VEHICLES.find(x => x.id === id);
  if (!v) return;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(v.lon, v.lat, 200),
    orientation: {
      heading: 0,
      pitch: Cesium.Math.toRadians(-45),
      roll: 0,
    },
    duration: 1.8,
  });
  if (vehicleEntities[id]) viewer.selectedEntity = vehicleEntities[id];
}

// ── 8. UI 이벤트 바인딩 ──────────────────────────────────────
renderVehicleCards(selectVehicle);

// 하단 버튼
const btnMap = { 'btn-3d': '3d', 'btn-overhead': 'overhead', 'btn-tactical': 'tactical' };
Object.entries(btnMap).forEach(([btnId, viewKey]) => {
  document.getElementById(btnId)?.addEventListener('click', e => {
    document.querySelectorAll('.vbtn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    setView(viewKey);
  });
});
document.getElementById('btn-bldg')?.addEventListener('click', () => {
  if (buildingsTileset) buildingsTileset.show = !buildingsTileset.show;
});
document.getElementById('btn-fire')?.addEventListener('click', flyToIncident);

// ── 9. 시계 & 경과시간 ───────────────────────────────────────
startClock();
startElapsed();

// ── 10. 지도 로드 완료 → 로딩 화면 제거 → 카메라 이동 ──────
let loadingHidden = false;
viewer.scene.globe.tileLoadProgressEvent.addEventListener(remaining => {
  if (remaining === 0 && !loadingHidden) {
    loadingHidden = true;
    setTimeout(() => {
      hideLoading();
      flyToIncident();
    }, 400);
  }
});
// fallback
setTimeout(() => {
  if (!loadingHidden) {
    loadingHidden = true;
    hideLoading();
    flyToIncident();
  }
}, 5000);

// CMD-1 카드 기본 활성화
document.getElementById('vc-CMD-1')?.classList.add('active');

// ── STEP 3: 실시간 시뮬레이션 시작 ─────────────────────────

// 좌패널 좌표 텍스트 실시간 갱신 콜백
function onPositionUpdate(id, lon, lat, alt) {
  const card = document.getElementById(`vc-${id}`);
  if (!card) return;
  const coordEl = card.querySelector('.vc-coords');
  if (!coordEl) return;

  const v = VEHICLES.find(x => x.id === id);
  if (!v) return;

  // 실내 차량은 GPS 음영 표시, 실외는 실시간 좌표
  const absText = v.indoor
    ? 'GPS 음영 (UWB 추적중)'
    : `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`;

  coordEl.innerHTML = `
    <div><span class="lbl">ABS </span><span class="val">${absText}</span></div>
    <div><span class="lbl">REL </span><span class="val">${v.relCoord}</span></div>
  `;
}

startSimulation(vehicleEntities, onPositionUpdate);
