# Skill: UI Panel
지휘 대시보드 패널 컴포넌트 수정 가이드

## 차량 카드 추가/수정
vehicles.js의 VEHICLES 배열에 데이터를 추가하면
ui.js의 renderVehicleCards()가 자동으로 반영한다.
ui.js 코드를 직접 수정할 필요 없음.

## 알림 로그 추가
vehicles.js의 ALERTS 배열에 항목 추가:
```js
{ time: 'HH:MM', level: 'info|warn|danger', text: '알림 내용' }
```

## 우패널 메트릭 동적 갱신
```js
// id 기반으로 직접 접근
document.getElementById('indoorCount').textContent = count;
document.getElementById('elapsed').textContent = 'MM:SS';
```

## 새 오버레이 요소 추가 패턴
```js
// ui.js buildLayout()의 HTML 문자열에 추가
// position:absolute, z-index:50, backdrop-filter:blur(8px) 유지
`<div id="newOverlay" style="position:absolute;...">...</div>`
```

## 하단 버튼 추가
```js
// ui.js HTML에 버튼 추가
`<button class="vbtn" id="btn-new">새 기능</button>`

// main.js 이벤트 바인딩에 추가
document.getElementById('btn-new')?.addEventListener('click', newFunction);
```

## 금지 패턴
- buildLayout() 외부에서 innerHTML 덮어쓰기 금지
- Cesium infoBox 스타일 오염 방지: .cesium-infoBox 클래스 건드리지 않음
