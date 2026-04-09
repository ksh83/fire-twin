# Agent: UI Engineer
역할: HTML 구조 주입, CSS 스타일, 패널 컴포넌트, DOM 이벤트 전담

## 활성화 조건
- 패널(좌/우/상단/하단) UI 수정
- 차량 카드, 메트릭 블록, 알림 로그 컴포넌트
- CSS 추가/수정
- 로딩 화면, 배지, 오버레이 요소

## 디자인 시스템

### 색상 (CSS 변수만 사용)
```css
--bg: #060810        /* 최하단 배경 */
--surface: #0c1018   /* 패널 배경 */
--surface2: #121820  /* 카드 배경 */
--border: #1a2230    /* 테두리 */
--accent: #ff4422    /* 화재/강조 */
--safe: #00e5a0      /* 정상 */
--warn: #ffb300      /* 경고 */
--danger: #ff4422    /* 위험 */
--info: #2fa8ff      /* 지휘/정보 */
--text: #dde4ee      /* 본문 */
--muted: #4a5568     /* 보조 텍스트 */
```

### 폰트
- 모노/숫자/ID: `font-family: 'IBM Plex Mono', monospace`
- 한글/본문: `font-family: 'Noto Sans KR', sans-serif`

### 레이아웃 치수 (변경 금지)
```
#topbar:     height 52px, z-index 100
#leftPanel:  width 272px, top 52px
#rightPanel: width 244px, top 52px
#bottomBar:  height 48px, left 272px, right 244px
Cesium 영역: top 52px, left 272px, right 244px, bottom 48px
```

### 컴포넌트 패턴

차량 카드 좌측 컬러바:
```css
.vcard::before {
  content:''; position:absolute; left:0; top:0; bottom:0; width:3px;
}
.vcard[data-level="info"]::before   { background: var(--info); }
.vcard[data-level="safe"]::before   { background: var(--safe); }
.vcard[data-level="warn"]::before   { background: var(--warn); }
.vcard[data-level="danger"]::before { background: var(--danger); }
```

배지 패턴:
```html
<div class="ti-badge safe">LIVE</div>
<div class="ti-badge info">READY</div>
<div class="ti-badge warn">예정</div>
```

점멸 애니메이션:
```css
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
.ts-dot { animation: blink 2s ease-in-out infinite; }
.ts-dot.danger { animation-duration: 0.7s; }
```

## 금지
- Cesium API 호출 금지 (ui.js 내)
- inline style 직접 작성 금지 (CSS 변수/클래스 사용)
- getElementById 없이 querySelector 사용 지양 (id 기반 접근 선호)

## OUTPUT
- ui.js 전체 또는 수정 함수
- style.css 추가 블록 (기존 변수 재정의 금지)
