# Agent: Data Engineer
역할: 데이터 구조, 공공 API 연계, WebSocket 파이프라인 전담

## 활성화 조건
- vehicles.js 데이터 구조 변경
- V-World API 지오코딩/WFS 연동
- WebSocket 수신 파이프라인 구현
- 시뮬레이터 ↔ 실제 데이터 소스 교체

## 데이터 파이프라인 구조

```
[GPS 수신기 / UWB 앵커]
        ↓ 지휘차 엣지 서버 (Python)
        ↓ WebSocket ws://localhost:8765
[simulation.js: connectWebSocket()]
        ↓ updatePosition(id, lon, lat, alt)
[main.js: vehicleEntities[id].position = ...]
        ↓ onPositionUpdate 콜백
[ui.js: updateCardCoords(id, lon, lat)]
```

## 위치 데이터 패킷 스펙
```json
{
  "id":  "RSC-1",
  "lon": 127.0283,
  "lat": 37.4987,
  "alt": 8.5,
  "source": "uwb",
  "accuracy": 0.18,
  "ts":  1700000000000
}
```

## V-World API 연계 패턴

### 지오코딩 (주소 → 좌표)
```js
async function geocodeAddress(address, apiKey) {
  const url = `https://api.vworld.kr/req/address?`
    + `service=address&request=getcoord`
    + `&address=${encodeURIComponent(address)}`
    + `&type=road&format=json&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  const { x, y } = data.response.result.point;
  return { lon: parseFloat(x), lat: parseFloat(y) };
}
```

### WFS 레이어 (소방서관할구역)
```js
const wfsUrl = `https://api.vworld.kr/req/wfs?`
  + `service=WFS&version=1.0.0&request=GetFeature`
  + `&typeName=lt_c_uq111&bbox=${bbox}&srsName=EPSG:4326`
  + `&outputFormat=application/json&key=${apiKey}`;
const geoJson = await Cesium.GeoJsonDataSource.load(wfsUrl, { clampToGround: true });
viewer.dataSources.add(geoJson);
```

## 시뮬레이터 → 실제 데이터 교체 방법
simulation.js에서 startSimulation() 호출을 connectWebSocket()으로만 교체.
main.js, ui.js 수정 없음. 인터페이스 동일 보장.

## 금지
- vehicles.js에 비즈니스 로직 추가 금지 (순수 데이터 상수만)
- fetch 직접 호출 시 반드시 try/catch 래핑
- API 키를 코드에 하드코딩 금지 (.env의 VITE_VWORLD_KEY 사용)
