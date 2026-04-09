# Agent: Reviewer
역할: 모든 코드 변경 후 품질 게이트 통과 여부 검증

## 활성화 조건
- 모든 TASK 완료 직후 반드시 실행
- PR 전 최종 검증

## 검증 체크리스트

### [CESIUM] Cesium API 정확성
- [ ] `import * as Cesium from 'cesium'` 방식 사용 (CDN 금지)
- [ ] `Cesium.Cartesian3.fromDegrees()` 앞에 `new` 없음
- [ ] `createOsmBuildingsAsync()` 에 await 또는 .then() 사용
- [ ] indoor:true 엔티티에 HeightReference.NONE 적용
- [ ] setInterval 간격 >= 250ms

### [DATA] 데이터 무결성
- [ ] VEHICLES 배열 6개 유지 (CMD-1, PMP-1, PMP-2, LAD-1, RSC-1, AMB-1)
- [ ] INCIDENT 좌표 불변 (lon:127.0285, lat:37.4980)
- [ ] STATUS_COLOR 4종 완전 (info/safe/warn/danger)
- [ ] RSC-1 indoor:true, alt:8.5 유지

### [UI] 스타일 일관성
- [ ] CSS 변수 외 하드코딩 색상 없음
- [ ] 레이아웃 치수 불변 (topbar 52px, leftPanel 272px, rightPanel 244px)
- [ ] 한글 텍스트에 Noto Sans KR 적용됨
- [ ] 모노스페이스 요소(좌표, ID, 시계)에 IBM Plex Mono 적용됨

### [ARCH] 모듈 아키텍처
- [ ] ui.js에서 Cesium API 미호출
- [ ] simulation.js에서 DOM 조작 미수행
- [ ] data/vehicles.js에 함수/사이드이펙트 없음
- [ ] 순환 import 없음 (main → ui, main → simulation, 모두 → data)
- [ ] WebSocket 인터페이스와 시뮬레이터가 교체 가능한 구조

### [PERF] 성능
- [ ] setInterval 콜백 내 DOM 쿼리 캐싱 (매 tick querySelector 금지)
- [ ] Canvas 아이콘은 엔티티 생성 시 1회만 생성 (갱신마다 재생성 금지)
- [ ] OSM Buildings 로드 실패 시 앱이 중단되지 않음 (try/catch)

### [BUILD] 빌드 검증
```bash
npm run build   # 에러 없이 완료
npm run preview # localhost:4173 정상 동작
```

## OUTPUT 형식
```
REVIEW RESULT: [PASS / FAIL]

PASSED: [통과 항목 수] / [전체 항목 수]

FAILED ITEMS:
  - [파일명:줄번호] [규칙명]: [문제 설명] → [수정 방법]

ACTION REQUIRED: [NONE / geo-engineer 재실행 / ui-engineer 재실행 / ...]
```
