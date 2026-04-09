# Skill: Cesium Entity
Cesium 엔티티 생성·수정·삭제 패턴 레퍼런스

## 아이콘 Canvas 생성 (재사용 패턴)
```js
function makeVehicleCanvas(v) {
  const canvas = document.createElement('canvas');
  canvas.width = 52; canvas.height = 52;
  const ctx = canvas.getContext('2d');
  const col = STATUS_COLOR[v.statusLevel];

  // 외곽 원
  ctx.beginPath();
  ctx.arc(26, 26, 22, 0, Math.PI * 2);
  ctx.fillStyle = col + '28';  // 알파 16%
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = v.statusLevel === 'danger' ? 2.5 : 2;
  ctx.stroke();

  // 이모지
  ctx.font = '18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ROLE_EMOJI[v.role], 26, 26);

  // 실내 표시 (3F 텍스트)
  if (v.indoor) {
    ctx.font = 'bold 9px IBM Plex Mono, monospace';
    ctx.fillStyle = col;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('3F', 26, 2);
  }
  return canvas.toDataURL();
}
```

## 수직 점선 (실내 차량용)
```js
// 지면 → 현재 고도 연결선
viewer.entities.add({
  polyline: {
    positions: Cesium.Cartesian3.fromDegreesArrayHeights([
      v.lon, v.lat, 0,
      v.lon, v.lat, v.alt + 3,
    ]),
    width: 2,
    material: new Cesium.PolylineDashMaterialProperty({
      color: Cesium.Color.fromCssColorString(STATUS_COLOR[v.statusLevel]),
      dashLength: 8,
    }),
  },
});
```

## 거리 연결선 (CMD-1 → 각 차량)
```js
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
```

## InfoBox HTML 템플릿
```js
description: `
  <div style="font-family:'IBM Plex Mono',monospace;
              background:#0c1018;color:#dde4ee;
              padding:13px;border-radius:6px;min-width:210px;">
    <div style="color:${col};font-weight:700;font-size:14px;
                margin-bottom:6px;">${v.id} ${emoji}</div>
    <table style="font-size:10px;width:100%;">
      <tr><td style="color:#2fa8ff;padding:2px 8px 2px 0">상태</td>
          <td style="color:${col}">${v.status}</td></tr>
      <tr><td style="color:#2fa8ff;padding:2px 8px 2px 0">절대위치</td>
          <td>${v.absCoord}</td></tr>
      <tr><td style="color:#2fa8ff;padding:2px 8px 2px 0">상대위치</td>
          <td>${v.relCoord}</td></tr>
      <tr><td style="color:#2fa8ff;padding:2px 8px 2px 0">탑승대원</td>
          <td>${v.crew}명</td></tr>
    </table>
  </div>`
```
