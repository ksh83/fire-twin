import {
  VEHICLES, ALERTS, DATA_SOURCES, INCIDENT,
} from './data/vehicles.js';

// ── HTML 구조 전체를 #app에 주입 ────────────────────────────
export function buildLayout() {
  // 차량 데이터에서 수량 계산 (하드코딩 제거)
  const totalCrew    = VEHICLES.reduce((s, v) => s + v.crew, 0);
  const indoorVeh    = VEHICLES.filter(v => v.indoor);
  const indoorCrew   = indoorVeh.reduce((s, v) => s + v.crew, 0);
  const vehicleCount = VEHICLES.length;
  const indoorFloor  = indoorVeh.length > 0
    ? Math.round(indoorVeh[0].alt / 3) + 1
    : 0;

  document.getElementById('app').innerHTML = `
    <!-- 로딩 화면 -->
    <div id="loading">
      <div class="load-logo">🔥 FIRE.TWIN</div>
      <div class="load-track"><div class="load-fill"></div></div>
      <div class="load-text">LOADING 3D TERRAIN &amp; BUILDING DATA...</div>
    </div>

    <!-- Cesium 컨테이너 -->
    <div id="cesiumContainer"></div>

    <!-- 상단바 -->
    <div id="topbar">
      <div class="logo">
        <div class="logo-box">🔥</div>
        <div>
          <div>FIRE.TWIN</div>
          <div class="logo-sub">DIGITAL TWIN INCIDENT COMMAND</div>
        </div>
      </div>
      <div class="top-status">
        <div class="ts-item">
          <span class="ts-dot"></span>
          <span>차량추적</span><span class="ts-val">${vehicleCount} / ${vehicleCount}</span>
        </div>
        <div class="ts-item">
          <span class="ts-dot danger"></span>
          <span>실내대원</span><span class="ts-val">${indoorCrew}명</span>
        </div>
        <div class="ts-item">
          <span class="ts-dot"></span>
          <span>OSM 3D</span><span class="ts-val">활성</span>
        </div>
        <div class="ts-item">
          <span class="ts-dot warn"></span>
          <span>V-World</span><span class="ts-val">연결중</span>
        </div>
        <div class="ts-item">
          <span class="ts-dot"></span>
          <span>갱신주기</span><span class="ts-val">250ms</span>
        </div>
      </div>
      <div class="top-clock" id="clock">00:00:00</div>
    </div>

    <!-- 좌 패널 -->
    <div id="leftPanel">
      <div class="panel-head">
        <div class="panel-label">배치 차량 현황</div>
        <div class="panel-title">화재현장 · ${INCIDENT.address}</div>
      </div>
      <div class="vcard-list" id="vcardList"></div>
    </div>

    <!-- 우 패널 -->
    <div id="rightPanel">
      <div class="rp-title">현장 요약</div>
      <div class="metric-grid">
        <div class="mblock">
          <div class="mb-label">투입대원</div>
          <div class="mb-val safe">${totalCrew}</div>
          <div class="mb-sub">명 현장</div>
        </div>
        <div class="mblock">
          <div class="mb-label">실내대원</div>
          <div class="mb-val danger" id="indoorCount">${indoorCrew}</div>
          <div class="mb-sub">명 (${indoorFloor}F)</div>
        </div>
        <div class="mblock">
          <div class="mb-label">차량</div>
          <div class="mb-val warn">${vehicleCount}</div>
          <div class="mb-sub">대 배치</div>
        </div>
        <div class="mblock">
          <div class="mb-label">경과시간</div>
          <div class="mb-val info" id="elapsed">23:47</div>
          <div class="mb-sub">경과</div>
        </div>
      </div>

      <div>
        <div class="rp-title">데이터 연계 현황</div>
        ${DATA_SOURCES.map(d => `
          <div class="ti">
            <div class="ti-h">
              <div class="ti-name">${d.name}</div>
              <div class="ti-badge ${d.level}">${d.badge}</div>
            </div>
            <div class="ti-desc">${d.desc}</div>
          </div>`).join('')}
      </div>

      <div>
        <div class="rp-title">현장 알림</div>
        ${ALERTS.map(a => `
          <div class="alert-item ${a.level}">
            <div class="alert-time">${a.time}</div>
            <div>${a.text}</div>
          </div>`).join('')}
      </div>
    </div>

    <!-- 하단바 -->
    <div id="bottomBar">
      <button class="vbtn active" id="btn-3d">3D 도시</button>
      <button class="vbtn" id="btn-overhead">수직 하강</button>
      <button class="vbtn" id="btn-tactical">전술 시점</button>
      <div class="bar-divider"></div>
      <button class="vbtn" id="btn-bldg">건물 투명화</button>
      <button class="vbtn" id="btn-fire">화재건물 🎯</button>
      <div class="bar-divider"></div>
      <div class="bar-info">
        <span class="lbl">좌표계</span><span class="val">WGS84</span>
        <span class="lbl" style="margin-left:10px">엔진</span><span class="val">CesiumJS</span>
        <span class="lbl" style="margin-left:10px">데이터</span><span class="val">OSM Buildings</span>
      </div>
    </div>

    <!-- 화재 배지 -->
    <div id="incidentBadge">
      <div class="ib-title"><span class="ib-dot"></span> 화재 — ${INCIDENT.address}</div>
      <div class="ib-sub">${INCIDENT.building} · ${INCIDENT.fireFloor}층 화재 진행중</div>
    </div>

    <!-- 정확도 오버레이 -->
    <div id="accOverlay">
      <div class="acc-row"><span class="acc-lbl">GPS 정확도</span><span class="acc-val">±3.2m</span></div>
      <div class="acc-row"><span class="acc-lbl">UWB 정확도</span><span class="acc-val">±18cm</span></div>
      <div class="acc-row"><span class="acc-lbl">통신 지연</span><span class="acc-val">42ms</span></div>
      <div class="acc-row"><span class="acc-lbl">3D 소스</span><span class="acc-val">OSM</span></div>
    </div>
  `;
}

// ── 차량 카드 목록 렌더링 ────────────────────────────────────
export function renderVehicleCards(onSelect) {
  const list = document.getElementById('vcardList');
  if (!list) return;
  list.innerHTML = VEHICLES.map(v => `
    <div
      class="vcard"
      id="vc-${v.id}"
      data-level="${v.statusLevel}"
      data-id="${v.id}"
    >
      <div class="vc-r1">
        <div>
          <div class="vc-id" data-level="${v.statusLevel}">
            ${v.shortLabel}${v.role === 'command' ? ' ★' : ''}
          </div>
          <div class="vc-type">${v.type}</div>
        </div>
        <div class="vc-badge" data-level="${v.statusLevel}">${v.status}</div>
      </div>
      <div class="vc-coords">
        <div><span class="lbl">ABS </span><span class="val">${v.absCoord}</span></div>
        <div><span class="lbl">REL </span><span class="val">${v.relCoord}</span></div>
      </div>
      <div class="vc-r3">
        <div class="vc-crew">
          <span class="crew-pip"></span>${v.crew}명 탑승
        </div>
        <div class="vc-dist">${v.dist}</div>
      </div>
    </div>
  `).join('');

  // 클릭 이벤트 위임
  list.addEventListener('click', e => {
    const card = e.target.closest('.vcard');
    if (!card) return;
    document.querySelectorAll('.vcard').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    onSelect(card.dataset.id);
  });
}

// ── 시계 갱신 ────────────────────────────────────────────────
export function startClock() {
  const el = document.getElementById('clock');
  const tick = () => {
    if (el) el.textContent = new Date().toTimeString().slice(0, 8);
  };
  tick();
  setInterval(tick, 1000);
}

// ── 경과시간 카운터 ──────────────────────────────────────────
export function startElapsed(initialSec = 2 * 60 + 14) {
  let sec = initialSec;
  const el = document.getElementById('elapsed');
  setInterval(() => {
    sec++;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (el) el.textContent =
      String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }, 1000);
}

// ── 로딩 화면 제거 ───────────────────────────────────────────
export function hideLoading() {
  const el = document.getElementById('loading');
  if (!el) return;
  el.classList.add('hidden');
  setTimeout(() => el.remove(), 900);
}
