# Skill: Realtime Position
GPS/UWB 위치 데이터 처리 및 Cesium 엔티티 동기화 패턴

## 시뮬레이터 패턴 (현재 사용)
```js
// 황금비 위상 간격으로 차량별 자연스러운 움직임
const phase = {};
VEHICLES.forEach((v, i) => { phase[v.id] = i * 0.618; });

setInterval(() => {
  simTime += 0.25;
  VEHICLES.forEach(v => {
    if (v.id === 'CMD-1') return;  // 지휘차 고정
    const ph = phase[v.id];
    const dLon = Math.sin(simTime * 0.28 + ph) * 0.000008;
    const dLat = Math.cos(simTime * 0.23 + ph) * 0.000008;
    const alt  = v.indoor ? v.alt + 3 + Math.sin(simTime * 0.4 + ph) * 0.25 : 3;
    updatePosition(v.id, v.lon + dLon, v.lat + dLat, alt);
  });
}, 250);
```

## WebSocket 수신 패턴 (실제 UWB 연동)
```js
// simulation.js의 startSimulation() 을 이 함수로 교체만 하면 됨
export function connectWebSocket(vehicleEntities, onUpdate, url = 'ws://localhost:8765') {
  _vehicleEntities = vehicleEntities;
  _onPositionUpdate = onUpdate;
  const ws = new WebSocket(url);
  ws.onmessage = (e) => {
    const { id, lon, lat, alt } = JSON.parse(e.data);
    updatePosition(id, lon, lat, alt);
  };
  // 재연결 로직 (3초 후)
  ws.onclose = () => setTimeout(() => connectWebSocket(vehicleEntities, onUpdate, url), 3000);
}
```

## UWB → WGS84 변환 (Python 엣지 서버)
```python
# 지휘차(CMD-1) 기준 상대좌표(m) → WGS84
import math

CMD_LON, CMD_LAT = 127.0278, 37.4977
EARTH_R = 6371000  # m

def uwb_to_wgs84(dx_m, dy_m):
    """UWB 상대좌표(동쪽+, 북쪽+) → (lon, lat)"""
    d_lat = dy_m / EARTH_R * (180 / math.pi)
    d_lon = dx_m / (EARTH_R * math.cos(math.radians(CMD_LAT))) * (180 / math.pi)
    return CMD_LON + d_lon, CMD_LAT + d_lat
```

## UI 동기화 콜백
```js
// main.js에서 정의, simulation.js에 주입
function onPositionUpdate(id, lon, lat, alt) {
  const card = document.getElementById(`vc-${id}`);
  if (!card) return;
  const v = VEHICLES.find(x => x.id === id);
  const absText = v.indoor
    ? 'GPS 음영 (UWB 추적중)'
    : `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`;
  card.querySelector('.vc-coords').innerHTML = `
    <div><span class="lbl">ABS </span><span class="val">${absText}</span></div>
    <div><span class="lbl">REL </span><span class="val">${v.relCoord}</span></div>`;
}
```
