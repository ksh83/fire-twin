import { VEHICLE_PATHS, SCENARIO_EVENTS, TOTAL_TIME } from './paths.js';

/**
 * 시나리오 재생 엔진
 *
 * requestAnimationFrame 기반으로 타임라인을 진행하며
 * 차량 위치를 경로 보간으로 계산해 콜백으로 전달한다.
 *
 * 콜백 목록:
 *   onPositionUpdate(id, lon, lat, alt)
 *   onStatusChange(id, statusLevel, status)
 *   onMemberPosition(id, lon, lat, alt)    ← 대원 위치 동기화
 *   onAlert({ level, text })
 *   onCaption(text)
 *   onTimeUpdate(elapsed, total)
 *   onReset()
 *   onComplete()
 */
export class ScenarioEngine {
  constructor(callbacks = {}) {
    this._t         = 0;
    this._playing   = false;
    this._speed     = 2;        // 기본 2배속
    this._lastTs    = null;
    this._raf       = null;
    this._fired     = new Set();
    this._state     = {};       // { vehicleId: 'parked'|'en_route'|'on_scene'|'indoor' }
    this._arriveAt  = {};       // { vehicleId: elapsed seconds when arrived }
    this._cb        = callbacks;
    this._vehicleDataMap = {};  // main.js에서 주입
  }

  // main.js의 vehicleDataMap 참조 주입 (대원 위치 계산용)
  setVehicleDataMap(map) {
    this._vehicleDataMap = map;
  }

  // ── 제어 ────────────────────────────────────────────────────
  play() {
    if (this._playing) return;
    this._playing = true;
    this._lastTs  = null;
    this._raf = requestAnimationFrame(ts => this._tick(ts));
    this._cb.onTimeUpdate?.(this._t, TOTAL_TIME);
  }

  pause() {
    if (!this._playing) return;
    this._playing = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    this._cb.onTimeUpdate?.(this._t, TOTAL_TIME);
  }

  reset() {
    this.pause();
    this._t        = 0;
    this._fired    = new Set();
    this._state    = {};
    this._arriveAt = {};

    // 전 차량 소방서 위치로 복원
    Object.entries(VEHICLE_PATHS).forEach(([id, path]) => {
      const wp0 = path.waypoints[0];
      this._cb.onPositionUpdate?.(id, wp0.lon, wp0.lat, 3);
      this._cb.onStatusChange?.(id, 'info', '대기중');
      this._syncMemberPositions(id, wp0.lon, wp0.lat, 3);
    });

    this._cb.onReset?.();
    this._cb.onTimeUpdate?.(0, TOTAL_TIME);
  }

  setSpeed(x) { this._speed = x; }

  get isPlaying() { return this._playing; }
  get elapsed()   { return this._t; }
  get totalTime() { return TOTAL_TIME; }

  // ── 메인 루프 ───────────────────────────────────────────────
  _tick(ts) {
    if (!this._playing) return;

    if (this._lastTs !== null) {
      const dtSec = (ts - this._lastTs) / 1000;
      this._t = Math.min(this._t + dtSec * this._speed, TOTAL_TIME);
    }
    this._lastTs = ts;

    this._checkEvents();
    this._updateAllPositions();
    this._cb.onTimeUpdate?.(this._t, TOTAL_TIME);

    if (this._t >= TOTAL_TIME) {
      this._playing = false;
      this._cb.onComplete?.();
      return;
    }

    this._raf = requestAnimationFrame(ts2 => this._tick(ts2));
  }

  // ── 이벤트 체크 ─────────────────────────────────────────────
  _checkEvents() {
    SCENARIO_EVENTS.forEach((ev, i) => {
      if (this._fired.has(i) || this._t < ev.t) return;
      this._fired.add(i);

      if (ev.type === 'alert')   this._cb.onAlert?.({ level: ev.level, text: ev.text });
      if (ev.type === 'caption') this._cb.onCaption?.(ev.text);
      if (ev.type === 'camera')  this._cb.onCamera?.(ev.target);
    });
  }

  // ── 전 차량 위치 업데이트 ───────────────────────────────────
  _updateAllPositions() {
    Object.entries(VEHICLE_PATHS).forEach(([id, path]) => {
      this._updateVehicle(id, path);
    });
  }

  _updateVehicle(id, path) {
    const elapsed = this._t - path.departTime;

    // 출발 전 → 소방서 정박
    if (elapsed < 0) {
      const wp0 = path.waypoints[0];
      this._cb.onPositionUpdate?.(id, wp0.lon, wp0.lat, 3);
      this._syncMemberPositions(id, wp0.lon, wp0.lat, 3);
      return;
    }

    const progress = elapsed / path.travelTime;

    // ── 이동 중 ───────────────────────────────────────────────
    if (progress < 1.0) {
      if (this._state[id] !== 'en_route') {
        this._state[id] = 'en_route';
        this._cb.onStatusChange?.(id, path.onDepart.statusLevel, path.onDepart.status);
      }

      const { lon, lat } = this._interpolate(path.waypoints, this._ease(progress));
      this._cb.onPositionUpdate?.(id, lon, lat, 3);
      this._syncMemberPositions(id, lon, lat, 3);
      return;
    }

    // ── 현장 도착 ─────────────────────────────────────────────
    const lastWp = path.waypoints[path.waypoints.length - 1];

    // 최초 도착 처리
    if (this._state[id] !== 'on_scene' && this._state[id] !== 'indoor') {
      this._state[id]    = 'on_scene';
      this._arriveAt[id] = this._t;
      this._cb.onStatusChange?.(id, path.onArrive.statusLevel, path.onArrive.status);
    }

    // GA-FLX 건물 진입 처리 (도착 후 고도 상승)
    if (path.indoorEntryDelay !== undefined && this._state[id] !== 'indoor') {
      const sinceArrive = this._t - this._arriveAt[id];

      if (sinceArrive >= path.indoorEntryDelay) {
        this._state[id] = 'indoor';
        this._cb.onStatusChange?.(id, path.onIndoor.statusLevel, path.onIndoor.status);
      }
    }

    if (this._state[id] === 'indoor' && path.altRiseDuration !== undefined) {
      const sinceIndoor = this._t - (this._arriveAt[id] + path.indoorEntryDelay);
      const riseP       = Math.min(sinceIndoor / path.altRiseDuration, 1.0);
      const alt         = 3 + this._ease(riseP) * 6.0;  // 3m → 9m (지면+3층)
      this._cb.onPositionUpdate?.(id, lastWp.lon, lastWp.lat, alt);
      this._syncMemberPositions(id, lastWp.lon, lastWp.lat, alt);
    } else {
      this._cb.onPositionUpdate?.(id, lastWp.lon, lastWp.lat, 3);
      this._syncMemberPositions(id, lastWp.lon, lastWp.lat, 3);
    }
  }

  // ── 대원 위치 동기화 (차량 주변 원형 배치) ──────────────────
  _syncMemberPositions(vehicleId, vLon, vLat, vAlt) {
    if (!this._cb.onMemberPosition) return;
    const v       = this._vehicleDataMap[vehicleId];
    const members = v?.members || [];
    const n       = members.length;
    if (n === 0) return;

    members.forEach((m, i) => {
      const angle  = (i / n) * Math.PI * 2;
      const offset = 0.000022;  // ≈ 2.5m
      const mLon   = vLon + Math.cos(angle) * offset;
      const mLat   = vLat + Math.sin(angle) * offset;
      const mAlt   = vAlt > 4 ? vAlt : 1;
      this._cb.onMemberPosition(m.id, mLon, mLat, mAlt);
    });
  }

  // ── 경로 보간 ────────────────────────────────────────────────
  _interpolate(waypoints, p) {
    for (let i = 0; i < waypoints.length - 1; i++) {
      const a = waypoints[i];
      const b = waypoints[i + 1];
      if (p >= a.p && p <= b.p + 1e-9) {
        const span = b.p - a.p;
        const t    = span < 1e-9 ? 1 : (p - a.p) / span;
        return {
          lon: a.lon + (b.lon - a.lon) * t,
          lat: a.lat + (b.lat - a.lat) * t,
        };
      }
    }
    const last = waypoints[waypoints.length - 1];
    return { lon: last.lon, lat: last.lat };
  }

  // ease-in-out 2차 함수 (가속→등속→감속)
  _ease(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }
}
