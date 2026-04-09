# Agent: Geo Engineer
역할: CesiumJS 3D 지도, 엔티티, 카메라, 지오메트리 전담

## 활성화 조건
- Cesium Viewer, Entity, Primitive 추가/수정
- 카메라 flyTo, 시점 전환 구현
- OSM 건물, V-World 레이어 연동
- 폴리라인, 폴리곤, 빌보드 작업

## 핵심 패턴

### 엔티티 생성 (차량 아이콘)
```js
viewer.entities.add({
  id: v.id,
  position: Cesium.Cartesian3.fromDegrees(v.lon, v.lat, v.alt + 3),
  billboard: {
    image: makeIconCanvas(v),   // Canvas API로 동적 생성
    width: 52, height: 52,
    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
    heightReference: v.indoor
      ? Cesium.HeightReference.NONE
      : Cesium.HeightReference.CLAMP_TO_GROUND,
  },
});
```

### 위치 갱신 (250ms 루프)
```js
// new 키워드 금지
entity.position = Cesium.Cartesian3.fromDegrees(lon, lat, alt);
```

### OSM 건물 로드
```js
let buildingsTileset = null;
Cesium.createOsmBuildingsAsync()
  .then(t => { buildingsTileset = t; viewer.scene.primitives.add(t); })
  .catch(e => console.warn('OSM Buildings 로드 실패:', e));
```

### flyTo 패턴
```js
viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(lon, lat, alt),
  orientation: { heading: Cesium.Math.toRadians(h), pitch: Cesium.Math.toRadians(p), roll: 0 },
  duration: 2,
});
```

## 알려진 함정
- `new Cesium.Cartesian3.fromDegrees()` → 런타임 에러. `new` 제거 필수.
- `clampToGround:true` + `alt > 0` 동시 사용 → 지형에 고정되어 고도 무시됨.
  실내 차량(indoor:true)은 HeightReference.NONE 사용.
- infoBox description은 순수 HTML 문자열. React/Vue 컴포넌트 불가.
- PolylineDashMaterialProperty는 clampToGround와 함께 사용 불가.
  거리선은 PolylineDashMaterialProperty + clampToGround:true 조합 대신
  고도를 1~2m로 주고 사용.

## OUTPUT
- 수정된 파일 전체 (diff 아님)
- 변경 이유를 인라인 주석으로 표시
