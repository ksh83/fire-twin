import { TOTAL_TIME, STATIONS } from './paths.js';

/**
 * 시나리오 컨트롤 패널 및 자막 오버레이
 */

let _captionTimer = null;

// ── 패널 HTML 주입 ────────────────────────────────────────────
export function injectScenarioUI() {
  // 컨트롤 패널
  const panel = document.createElement('div');
  panel.id = 'scenarioPanel';
  panel.innerHTML = `
    <div class="sc-row sc-top">
      <div class="sc-title">🎬 시나리오 재생</div>
      <div class="sc-speeds">
        <button class="sc-speed" data-x="1">1×</button>
        <button class="sc-speed sc-speed-active" data-x="2">2×</button>
        <button class="sc-speed" data-x="4">4×</button>
        <button class="sc-speed" data-x="8">8×</button>
      </div>
      <div class="sc-btns">
        <button class="sc-btn" id="sc-reset" title="초기화">⏹</button>
        <button class="sc-btn sc-play" id="sc-play">▶ 재생</button>
        <button class="sc-btn" id="sc-film" title="촬영 모드">📽</button>
      </div>
    </div>
    <div class="sc-row sc-bar-row">
      <span class="sc-time" id="sc-elapsed">00:00</span>
      <div class="sc-track" id="sc-track">
        <div class="sc-fill" id="sc-fill"></div>
        <div class="sc-thumb" id="sc-thumb"></div>
      </div>
      <span class="sc-time" id="sc-total">${_fmt(TOTAL_TIME)}</span>
    </div>
    <div class="sc-event" id="sc-event">초기화 후 재생을 시작하세요</div>
  `;
  document.body.appendChild(panel);

  // 자막 오버레이
  const caption = document.createElement('div');
  caption.id = 'scenarioCaption';
  document.body.appendChild(caption);

  return panel;
}

// ── 소방서 마커 (시나리오 시작 시 지도에 표시) ───────────────
export function getStationMarkers() {
  return STATIONS;
}

// ── 버튼 이벤트 바인딩 ───────────────────────────────────────
export function bindScenarioPanel(engine) {
  const playBtn   = document.getElementById('sc-play');
  const resetBtn  = document.getElementById('sc-reset');
  const filmBtn   = document.getElementById('sc-film');
  const speedBtns = document.querySelectorAll('.sc-speed');

  playBtn?.addEventListener('click', () => {
    if (engine.isPlaying) {
      engine.pause();
      playBtn.textContent = '▶ 재생';
      playBtn.classList.remove('sc-playing');
    } else {
      engine.play();
      playBtn.textContent = '⏸ 일시정지';
      playBtn.classList.add('sc-playing');
    }
  });

  resetBtn?.addEventListener('click', () => {
    engine.reset();
    if (playBtn) {
      playBtn.textContent = '▶ 재생';
      playBtn.classList.remove('sc-playing');
    }
    updateScenarioTime(0, TOTAL_TIME);
    showCaption('');
  });

  speedBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const x = parseFloat(btn.dataset.x);
      engine.setSpeed(x);
      speedBtns.forEach(b => b.classList.remove('sc-speed-active'));
      btn.classList.add('sc-speed-active');
    });
  });

  // 촬영 모드 토글 (UI 패널 숨김)
  let _filmMode = false;
  filmBtn?.addEventListener('click', () => {
    _filmMode = !_filmMode;
    const panels = ['leftPanel', 'rightPanel', 'topbar', 'bottomBar',
                    'incidentBadge', 'accOverlay', 'scenarioPanel'];
    panels.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.display = _filmMode ? 'none' : '';
    });
    if (_filmMode) {
      document.body.style.cursor = 'none';
    } else {
      document.body.style.cursor = '';
    }
    filmBtn.classList.toggle('sc-speed-active', _filmMode);
  });

  // 시나리오 완료
  engine._cb.onComplete = () => {
    if (playBtn) {
      playBtn.textContent = '▶ 재생';
      playBtn.classList.remove('sc-playing');
    }
    showCaption('시나리오 완료');
  };
}

// ── 타임라인 갱신 ───────────────────────────────────────────
export function updateScenarioTime(elapsed, total) {
  const elEl    = document.getElementById('sc-elapsed');
  const fillEl  = document.getElementById('sc-fill');
  const thumbEl = document.getElementById('sc-thumb');

  if (elEl)    elEl.textContent = _fmt(elapsed);
  const pct = Math.min((elapsed / total) * 100, 100);
  if (fillEl)  fillEl.style.width = `${pct}%`;
  if (thumbEl) thumbEl.style.left = `${pct}%`;
}

// ── 현재 이벤트 텍스트 갱신 ─────────────────────────────────
export function updateScenarioEvent(text) {
  const el = document.getElementById('sc-event');
  if (el) el.textContent = text;
}

// ── 화면 중앙 자막 ───────────────────────────────────────────
export function showCaption(text) {
  const el = document.getElementById('scenarioCaption');
  if (!el) return;

  if (_captionTimer) { clearTimeout(_captionTimer); _captionTimer = null; }

  if (!text) { el.classList.remove('visible'); return; }

  el.textContent = text;
  el.classList.add('visible');
  _captionTimer = setTimeout(() => {
    el.classList.remove('visible');
  }, 3200);
}

// ── 시간 포맷 MM:SS ───────────────────────────────────────────
function _fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
