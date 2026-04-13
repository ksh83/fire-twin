import * as Cesium from 'cesium';

/**
 * V-World WMTS 레이어 관리
 *
 * VITE_VWORLD_KEY 환경변수가 설정된 경우에만 레이어를 추가한다.
 * 키가 없으면 조용히 null을 반환하고 OSM Buildings가 계속 사용된다.
 *
 * API 키 발급: https://www.vworld.kr/dev/v4dv_apikey_s001.do
 * .env 파일에 추가: VITE_VWORLD_KEY=your_key_here
 */

let _baseLayer  = null;
let _hybridLayer = null;
let _viewer     = null;

// ── V-World 레이어 추가 ──────────────────────────────────────
export function initVWorldLayer(viewer) {
  _viewer = viewer;
  const key = import.meta.env.VITE_VWORLD_KEY;

  if (!key || key === 'YOUR_VWORLD_KEY') {
    console.info('[V-World] API 키 미설정 — OSM Buildings 유지');
    return null;
  }

  try {
    // 기본 지도 레이어 (배경)
    _baseLayer = viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: `https://api.vworld.kr/req/wmts/1.0.0/${key}/Base/{z}/{y}/{x}.png`,
        minimumLevel:  7,
        maximumLevel: 18,
        credit: new Cesium.Credit('국토지리정보원 V-World', false),
        tilingScheme: new Cesium.WebMercatorTilingScheme(),
      }),
    );
    _baseLayer.alpha = 0.75;

    console.info('[V-World] 기본 레이어 활성화');
    return _baseLayer;
  } catch (e) {
    console.warn('[V-World] 레이어 초기화 실패:', e);
    return null;
  }
}

// ── 하이브리드(도로+건물 명칭) 레이어 토글 ──────────────────
export function toggleVWorldHybrid(viewer) {
  const key = import.meta.env.VITE_VWORLD_KEY;
  if (!key || key === 'YOUR_VWORLD_KEY') return;

  if (_hybridLayer) {
    viewer.imageryLayers.remove(_hybridLayer);
    _hybridLayer = null;
    return;
  }

  try {
    _hybridLayer = viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: `https://api.vworld.kr/req/wmts/1.0.0/${key}/Hybrid/{z}/{y}/{x}.png`,
        minimumLevel:  7,
        maximumLevel: 18,
        credit: new Cesium.Credit('국토지리정보원 V-World Hybrid', false),
        tilingScheme: new Cesium.WebMercatorTilingScheme(),
      }),
    );
    _hybridLayer.alpha = 0.85;
  } catch (e) {
    console.warn('[V-World] 하이브리드 레이어 실패:', e);
  }
}

// ── 기본 레이어 투명도 조절 ──────────────────────────────────
export function setVWorldOpacity(alpha) {
  if (_baseLayer) _baseLayer.alpha = Math.max(0, Math.min(1, alpha));
}

// ── V-World 활성 여부 ────────────────────────────────────────
export function isVWorldActive() {
  return _baseLayer !== null;
}
