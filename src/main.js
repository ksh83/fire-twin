import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './style.css';

import { VEHICLES, INCIDENT, HYDRANTS, STATUS_COLOR, UNIT_COLOR, TYPE_ABBR } from './data/vehicles.js';
import {
  buildLayout, renderVehicleCards, addVehicleCard,
  startClock, startElapsed, hideLoading,
  updateVehicleCard, updateVehicleCoords,
  pushAlert, setWsStatus, setVWorldStatus,
  updateOxygenLevel,
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
const CESIUM_TOKEN = import.meta.env.VITE_CESIUM_TOKEN || 'YOUR_TOKEN_HERE';
if (!CESIUM_TOKEN || CESIUM_TOKEN === 'YOUR_TOKEN_HERE') {
  console.warn('[FIRE.TWIN] Cesium Ion 토큰이 설정되지 않았습니다. 지형/건물 로드가 제한될 수 있습니다.');
}
Cesium.Ion.defaultAccessToken = CESIUM_TOKEN;

// ── 3. Viewer 초기화 ─────────────────────────────────────────
let viewer;
try {
  viewer = new Cesium.Viewer('cesiumContainer', {
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
    msaaSamples:          4,
  });
} catch (err) {
  console.error('[FIRE.TWIN] Cesium Viewer 초기화 실패:', err);
  const container = document.getElementById('cesiumContainer');
  if (container) {
    container.innerHTML = `<div style="color:white;padding:20px;text-align:center;">
      <h3>3D 엔진 초기화 실패</h3>
      <p>브라우저가 WebGL을 지원하지 않거나 가속이 꺼져 있을 수 있습니다.</p>
    </div>`;
  }
}

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

/* AIP 관련 상수 및 유틸리티 (Step 5 - 순서 정정) */
const hydrantEntities = {};
const aipLines = {}; // 차량별 추천 경로 가이드 라인

function _makeHydrantCanvas(h) {
  const c = document.createElement('canvas');
  c.width = 48; c.height = 48;
  const ctx = c.getContext('2d');
  const col = h.status === '사용가능' ? '#2fa8ff' : '#9ca3af';
  ctx.beginPath(); ctx.moveTo(24, 4);
  ctx.bezierCurveTo(40, 24, 40, 44, 24, 44);
  ctx.bezierCurveTo(8, 44, 8, 24, 24, 4);
  ctx.fillStyle = col + 'cc'; ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = 'bold 16px "IBM Plex Mono", sans-serif';
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('H', 24, 28);
  return c.toDataURL();
}

function _addHydrantEntities() {
  HYDRANTS.forEach(h => {
    const entity = viewer.entities.add({
      id: `hydrant-${h.id}`,
      name: `소화전 ${h.id} (${h.type})`,
      position: Cesium.Cartesian3.fromDegrees(h.lon, h.lat, 0),
      billboard: {
        image: _makeHydrantCanvas(h),
        width: 32, height: 32,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
      label: {
        text: `${h.id}\n${h.status}`,
        font: 'bold 10px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.TOP,
        pixelOffset: new Cesium.Cartesian2(0, 4),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    hydrantEntities[h.id] = entity;
  });
}

function _checkAIPRecommendations(id) {
  const v = vehicleDataMap[id];
  if (!v || v.waterLevel == null || v.role === 'amb' || v.role === 'command') return;
  if (v.waterLevel < 0.3) {
    if (v._aipAlerted) return;
    v._aipAlerted = true;
    let minD = Infinity, bestH = null;
    HYDRANTS.filter(h => h.status === '사용가능').forEach(h => {
      const d = _calcDist(v.lat, v.lon, h.lat, h.lon);
      if (d < minD) { minD = d; bestH = h; }
    });
    if (bestH) {
      pushAlert({
        level: 'warn',
        text: `[AIP 추천] 용수 부족(${v.shortLabel}) - 최단거리 ${bestH.id} 소화전(${minD}m) 점유 권장`
      });
      if (aipLines[v.id]) viewer.entities.remove(aipLines[v.id]);
      aipLines[v.id] = viewer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            const hPos = Cesium.Cartesian3.fromDegrees(bestH.lon, bestH.lat, 2);
            const vPos = Cesium.Cartesian3.fromDegrees(v.lon, v.lat, 2);
            return [vPos, hPos];
          }, false),
          width: 3,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString('#2fa8ff'),
            dashLength: 12,
          }),
        }
      });
    }
  } else {
    v._aipAlerted = false;
    if (aipLines[v.id]) {
      viewer.entities.remove(aipLines[v.id]);
      delete aipLines[v.id];
    }
  }
}

/* roundRect 폴리필 */
function _rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

/* 5각별 경로 */
function _star5(ctx, cx, cy, r1, r2) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? r1 : r2;
    i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
            : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  ctx.closePath();
}

/* 지휘차: 오각형 + 별 */
function _iconCommand(ctx, col, cx, cy) {
  ctx.fillStyle = col + 'aa';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    i === 0 ? ctx.moveTo(cx + 26 * Math.cos(a), cy + 26 * Math.sin(a))
            : ctx.lineTo(cx + 26 * Math.cos(a), cy + 26 * Math.sin(a));
  }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffffff';
  _star5(ctx, cx, cy, 15, 6); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1.5;
  _star5(ctx, cx, cy, 15, 6); ctx.stroke();
}

/* 소방차 계열 (측면 실루엣) */
function _iconTruck(ctx, col, cx, cy, subtype) {
  const tx = cx - 30, ty = cy - 2;

  // 섀시
  ctx.fillStyle = '#111827';
  _rr(ctx, tx, ty + 18, 60, 7, 2); ctx.fill();

  // 후방 차체
  ctx.fillStyle = col + 'cc';
  _rr(ctx, tx + 17, ty, 43, 20, 3); ctx.fill();

  // 캡
  ctx.fillStyle = col;
  _rr(ctx, tx, ty + 3, 20, 17, 3); ctx.fill();

  // 앞유리
  ctx.fillStyle = 'rgba(130,210,255,0.65)';
  _rr(ctx, tx + 3, ty + 5, 13, 8, 2); ctx.fill();

  // 바퀴 2개
  [tx + 10, tx + 48].forEach(wx => {
    ctx.fillStyle = '#0d1117';
    ctx.beginPath(); ctx.arc(wx, ty + 27, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#374151'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(wx, ty + 27, 4, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#4B5563'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(wx, ty + 27, 7, 0, Math.PI * 2); ctx.stroke();
  });

  // 차종별 장비
  switch (subtype) {
    case 'pump': {
      // 호스 릴 (원형)
      const rx = tx + 36, ry = ty + 10;
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(rx, ry, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(rx, ry, 3, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(rx + 3 * Math.cos(a), ry + 3 * Math.sin(a));
        ctx.lineTo(rx + 8 * Math.cos(a), ry + 8 * Math.sin(a));
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(100,200,255,0.85)';
      ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('💧', tx + 25, ty + 10);
      break;
    }
    case 'tank': {
      // 물탱크 타원
      ctx.fillStyle = 'rgba(100,180,255,0.18)';
      ctx.strokeStyle = 'rgba(100,180,255,0.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(tx + 39, ty + 10, 17, 8, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(100,180,255,0.35)'; ctx.lineWidth = 1;
      [-8, -2, 4, 10].forEach(dx => {
        ctx.beginPath();
        ctx.moveTo(tx + 39 + dx, ty + 2);
        ctx.lineTo(tx + 39 + dx, ty + 18);
        ctx.stroke();
      });
      break;
    }
    case 'ladder':
    case 'smallladder': {
      // 사선 사다리
      const lx1 = tx + 18, ly1 = ty + 1, lx2 = tx + 56, ly2 = ty - 22;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(lx1,     ly1);     ctx.lineTo(lx2,     ly2);     ctx.stroke();
      ctx.beginPath(); ctx.moveTo(lx1 + 7, ly1 + 1); ctx.lineTo(lx2 + 7, ly2 + 1); ctx.stroke();
      ctx.lineWidth = 1.5;
      for (let i = 0; i <= 5; i++) {
        const t = i / 5;
        const rx = lx1 + t * (lx2 - lx1);
        const ry = ly1 + t * (ly2 - ly1);
        ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + 7, ry + 1); ctx.stroke();
      }
      break;
    }
    case 'aerial': {
      // 수직 붐 + 플랫폼
      ctx.strokeStyle = 'rgba(255,220,80,0.92)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(tx + 36, ty); ctx.lineTo(tx + 36, ty - 25); ctx.stroke();
      ctx.fillStyle = 'rgba(255,220,80,0.35)';
      ctx.strokeStyle = 'rgba(255,220,80,0.85)'; ctx.lineWidth = 1.5;
      ctx.fillRect(tx + 29, ty - 32, 14, 8); ctx.strokeRect(tx + 29, ty - 32, 14, 8);
      ctx.fillStyle = 'rgba(255,220,80,0.85)';
      ctx.beginPath(); ctx.arc(tx + 36, ty, 4, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'flex': {
      // 굴절 붐 (곡선)
      ctx.strokeStyle = 'rgba(255,170,50,0.92)'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(tx + 34, ty);
      ctx.bezierCurveTo(tx + 34, ty - 12, tx + 50, ty - 18, tx + 52, ty - 28);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,170,50,0.85)';
      ctx.beginPath(); ctx.arc(tx + 52, ty - 28, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(tx + 34, ty,     4, 0, Math.PI * 2); ctx.fill();
      break;
    }
  }
}

/* 구급차 (밴형) */
function _iconAmb(ctx, col, cx, cy) {
  const tx = cx - 28, ty = cy - 6;

  // 차체 (흰색)
  ctx.fillStyle = 'rgba(225,232,245,0.95)';
  _rr(ctx, tx, ty, 56, 24, 4); ctx.fill();

  // 소속색 사이드 스트라이프
  ctx.fillStyle = col + 'cc';
  ctx.fillRect(tx, ty + 12, 56, 8);

  // 적십자 (후면 패널)
  ctx.fillStyle = '#ee1111';
  ctx.fillRect(cx + 2,  ty + 4, 12, 4);  // 가로
  ctx.fillRect(cx + 6,  ty + 2, 4,  8);  // 세로

  // 지붕 경광등 (빨강/파랑)
  ctx.fillStyle = '#ee1111'; _rr(ctx, cx - 11, ty - 4, 7, 5, 2); ctx.fill();
  ctx.fillStyle = '#2288ff'; _rr(ctx, cx + 4,  ty - 4, 7, 5, 2); ctx.fill();

  // 앞유리
  ctx.fillStyle = 'rgba(130,210,255,0.7)';
  _rr(ctx, tx + 3, ty + 3, 14, 9, 2); ctx.fill();

  // 섀시
  ctx.fillStyle = '#111827';
  ctx.fillRect(tx, ty + 24, 56, 5);

  // 바퀴
  [tx + 10, tx + 46].forEach(wx => {
    ctx.fillStyle = '#0d1117';
    ctx.beginPath(); ctx.arc(wx, ty + 31, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#374151'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(wx, ty + 31, 3.5, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#4B5563'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(wx, ty + 31, 6,   0, Math.PI * 2); ctx.stroke();
  });
}

/* ── 차량 아이콘 메인 함수 (80×80 캔버스) ─────────────────── */
function _makeVehicleCanvas(v) {
  const c = document.createElement('canvas');
  c.width = 80; c.height = 80;
  const ctx = c.getContext('2d');

  const unitCol = UNIT_COLOR[v.unit] || '#888888';
  const statCol = STATUS_COLOR[v.statusLevel] || '#ffffff';

  // 1. 외곽 헤일로
  ctx.beginPath(); ctx.arc(40, 40, 38, 0, Math.PI * 2);
  ctx.fillStyle = unitCol + '18'; ctx.fill();

  // 2. 내부 배경 (클리핑)
  ctx.save();
  ctx.beginPath(); ctx.arc(40, 40, 34, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#050c14'; ctx.fillRect(0, 0, 80, 80);

  // 차종별 그리기
  const drawFns = {
    command:     () => _iconCommand(ctx, unitCol, 40, 40),
    pump:        () => _iconTruck(ctx, unitCol, 40, 44, 'pump'),
    tank:        () => _iconTruck(ctx, unitCol, 40, 44, 'tank'),
    ladder:      () => _iconTruck(ctx, unitCol, 40, 44, 'ladder'),
    smallladder: () => _iconTruck(ctx, unitCol, 40, 44, 'smallladder'),
    aerial:      () => _iconTruck(ctx, unitCol, 40, 48, 'aerial'),
    flex:        () => _iconTruck(ctx, unitCol, 40, 48, 'flex'),
    amb:         () => _iconAmb(ctx, unitCol, 40, 42),
  };
  (drawFns[v.role] || drawFns.pump)();
  ctx.restore();

  // 3. 잔량 게이지 (AIP 기초 - Step 5)
  // 실내 진입 대원 있을 시 산소 평균, 아니면 용수 잔량 사용
  let gaugePct = v.waterLevel ?? 1.0;
  if (v.indoor && v.members && v.members.length > 0) {
    const oxyMembers = v.members.filter(m => m.oxygenPct != null);
    if (oxyMembers.length > 0) {
      gaugePct = oxyMembers.reduce((sum, m) => sum + m.oxygenPct, 0) / (oxyMembers.length * 100);
    }
  }

  const gaugeCol = gaugePct < 0.3 ? STATUS_COLOR.danger : gaugePct < 0.8 ? STATUS_COLOR.warn : STATUS_COLOR.safe;
  
  // 배경 회색 아크 (전체 270도)
  ctx.beginPath();
  ctx.arc(40, 40, 31, -Math.PI * 1.25, Math.PI * 0.25);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 4;
  ctx.stroke();

  // 활성 잔량 아크
  ctx.beginPath();
  ctx.arc(40, 40, 31, -Math.PI * 1.25, -Math.PI * 1.25 + (Math.PI * 1.5 * gaugePct));
  ctx.strokeStyle = gaugeCol;
  ctx.lineWidth = 4;
  ctx.stroke();

  // 4. 상태 링
  ctx.beginPath(); ctx.arc(40, 40, 37, 0, Math.PI * 2);
  ctx.strokeStyle = statCol;
  ctx.lineWidth = v.statusLevel === 'danger' ? 5 : 3;
  ctx.stroke();

  // 5. 실내 층 배지
  if (v.indoor) {
    const floor = Math.round(v.alt / 3) + 1;
    ctx.beginPath(); ctx.arc(62, 16, 11, 0, Math.PI * 2);
    ctx.fillStyle = statCol; ctx.fill();
    ctx.font = 'bold 10px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#050c14';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${floor}F`, 62, 16);
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
      width: 80, height: 80,
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

  // ※ 방위선은 _initBearingLines() 에서 동적으로 생성
}

// ── 방위각 계산 helpers ──────────────────────────────────────
function _calcBearing(lat1, lon1, lat2, lon2) {
  const toR = d => d * Math.PI / 180;
  const dL  = toR(lon2 - lon1);
  const y   = Math.sin(dL) * Math.cos(toR(lat2));
  const x   = Math.cos(toR(lat1)) * Math.sin(toR(lat2))
              - Math.sin(toR(lat1)) * Math.cos(toR(lat2)) * Math.cos(dL);
  return Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360);
}
function _calcDist(lat1, lon1, lat2, lon2) {
  const R = 6371000, toR = d => d * Math.PI / 180;
  const dLat = toR(lat2 - lat1), dLon = toR(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
            + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
function _bearingDir(deg) {
  const D = ['북','북북동','북동','동북동','동','동남동','남동','남남동',
             '남','남남서','남서','서남서','서','서북서','북서','북북서'];
  return D[Math.round(deg / 22.5) % 16];
}

// ── 방위선 엔티티 관리 ───────────────────────────────────────
const bearingEntities = {};

function _initBearingLines() {
  const cmd = vehicleDataMap['CMD-1'];
  if (!cmd) return;
  VEHICLES.filter(v => v.id !== 'CMD-1').forEach(v => {
    const unitCol = UNIT_COLOR[v.unit] || '#888888';
    const dist    = _calcDist(cmd.lat, cmd.lon, v.lat, v.lon);
    const bear    = _calcBearing(cmd.lat, cmd.lon, v.lat, v.lon);

    bearingEntities[v.id] = viewer.entities.add({
      id:       `bearing-${v.id}`,
      position: Cesium.Cartesian3.fromDegrees(
        (cmd.lon + v.lon) / 2, (cmd.lat + v.lat) / 2, 4
      ),
      label: {
        text:        `${_bearingDir(bear)} ${dist}m`,
        font:        'bold 10px "IBM Plex Mono", monospace',
        fillColor:   Cesium.Color.fromCssColorString(unitCol).withAlpha(0.9),
        outlineColor:Cesium.Color.fromCssColorString('#060810'),
        outlineWidth: 2,
        style:        Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -4),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 700),
        scaleByDistance: new Cesium.NearFarScalar(50, 1.0, 600, 0.5),
      },
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights([
          cmd.lon, cmd.lat, 3,
          v.lon, v.lat, 3,
        ]),
        width: 1.5,
        material: new Cesium.PolylineDashMaterialProperty({
          color:      Cesium.Color.fromCssColorString(unitCol).withAlpha(0.5),
          dashLength: 14,
        }),
        clampToGround: false,
      },
    });
  });
}

function _updateBearingLine(id, lon, lat) {
  const entity = bearingEntities[id];
  if (!entity) return;
  const cmd = vehicleDataMap['CMD-1'];
  if (!cmd) return;

  const dist = _calcDist(cmd.lat, cmd.lon, lat, lon);
  const bear = _calcBearing(cmd.lat, cmd.lon, lat, lon);
  entity.polyline.positions = Cesium.Cartesian3.fromDegreesArrayHeights([
    cmd.lon, cmd.lat, 3, lon, lat, 3,
  ]);
  entity.position = Cesium.Cartesian3.fromDegrees(
    (cmd.lon + lon) / 2, (cmd.lat + lat) / 2, 4
  );
  entity.label.text = `${_bearingDir(bear)} ${dist}m`;
}

function _makeVehicleDescription(v) {
  const statCol = STATUS_COLOR[v.statusLevel] || '#ffffff';
  const waterPct = v.waterLevel != null ? Math.round(v.waterLevel * 100) : null;
  
  return `
    <div style="font-family:'IBM Plex Mono',monospace;background:#0c1018;
                color:#dde4ee;padding:13px;border-radius:6px;min-width:210px;">
      <div style="color:${statCol};font-weight:700;font-size:14px;margin-bottom:6px;">${v.shortLabel}</div>
      <div style="font-size:10px;color:#4a5568;margin-bottom:8px;">${v.type}</div>
      <table style="font-size:10px;width:100%;border-collapse:collapse;">
        <tr><td style="color:#2fa8ff;padding:2px 8px 2px 0;white-space:nowrap">상태</td>
            <td style="color:${statCol}">${v.status}</td></tr>
        ${waterPct !== null ? `
        <tr><td style="color:#2fa8ff;padding:2px 8px 2px 0;white-space:nowrap">용수잔량</td>
            <td style="color:${waterPct < 30 ? '#ff4422' : '#00e5a0'}">${waterPct}%</td></tr>
        ` : ''}
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

// 동적 방위선 초기화
_initBearingLines();

// 소화전 초기화 (Step 5)
_addHydrantEntities();

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

// 도착 카메라 잠금 (중첩 flyTo 방지)
let _cameraLocked = false;

/**
 * 차량 현장 도착 시 자동 카메라 시퀀스
 * ① 해당 차량 근거리 확대 (1.6s) → ② 1.8s 대기 → ③ 현장 전체 조망 복귀
 */
export function onVehicleArrive(id) {
  if (_cameraLocked) return;
  _cameraLocked = true;

  const v = vehicleDataMap[id];
  if (!v) { _cameraLocked = false; return; }

  // 단계 1: 차량 근접 확대
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(v.lon, v.lat - 0.0005, 110),
    orientation: {
      heading: Cesium.Math.toRadians(8),
      pitch:   Cesium.Math.toRadians(-48),
      roll: 0,
    },
    duration: 1.6,
    complete: () => {
      // 단계 2: 현장 전체 복귀
      setTimeout(() => {
        flyToIncident();
        setTimeout(() => { _cameraLocked = false; }, 2700);
      }, 1800);
    },
  });
}

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
  // vehicleDataMap 위치 최신화 (방위선·카메라 계산에 사용)
  v.lon = lon; v.lat = lat; v.alt = alt;
  updateVehicleCoords(id, lon, lat, alt, v);

  // AIP 추천 엔진 가동 (Step 5)
  _checkAIPRecommendations(id);

  // 방위선 갱신
  if (id === 'CMD-1') {
    // 기준차 이동 시 전체 방위선 재계산
    Object.keys(bearingEntities).forEach(vid => {
      const vd = vehicleDataMap[vid];
      if (vd) _updateBearingLine(vid, vd.lon, vd.lat);
    });
  } else {
    _updateBearingLine(id, lon, lat);
  }
}

// ── 산소량 시뮬레이션 (실내 대원 공기호흡기 잔압 감소) ────────
let _oxyLastTick = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt  = (now - _oxyLastTick) / 1000;   // 경과 초
  _oxyLastTick = now;

  VEHICLES.filter(v => v.indoor && v.members).forEach(v => {
    v.members.forEach(m => {
      if (m.oxygenPct == null) return;
      // 0.2%/초 소진 → 데모에서 ~1.5분 후 완전 소진
      m.oxygenPct = Math.max(0, m.oxygenPct - dt * 0.2);
      const pct = Math.round(m.oxygenPct);
      updateOxygenLevel(m.id, pct);

      // 임계치 경보 (1회성)
      if (!m._alerted15 && pct <= 15) {
        m._alerted15 = true;
        pushAlert({ level: 'danger', text: `🚨 ${m.name}(${v.shortLabel}) 잔압 15% — 위험` });
      }
      if (!m._alerted10 && pct <= 10) {
        m._alerted10 = true;
        pushAlert({ level: 'danger', text: `⛔ ${m.name}(${v.shortLabel}) 잔압 10% — 즉각 철수` });
      }
    });
  });
}, 2000);

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

  // 차량 현장 도착 → 자동 확대
  onArrive: onVehicleArrive,

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
