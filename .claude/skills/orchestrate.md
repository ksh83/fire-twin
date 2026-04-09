# Skill: Orchestrate
오케스트레이터 실행 흐름 정의

## 표준 작업 흐름 (신규 기능 추가)
```
1. planner.md     → 작업 분해 및 에이전트 배정
2. (병렬 가능)
   data-engineer  → data/vehicles.js 변경 (있을 경우)
3. (순차 필수: data 완료 후)
   geo-engineer   → main.js, camera.js 변경
   ui-engineer    → ui.js, style.css 변경
4. reviewer.md    → 전체 체크리스트 검증
5. FAIL 시 → 해당 에이전트 재실행 후 reviewer 재검증
```

## 긴급 수정 흐름 (버그)
```
1. reviewer.md    → 어느 체크리스트 항목 실패인지 확인
2. 해당 에이전트  → 최소 범위 수정
3. reviewer.md    → 재검증
```

## 컨텍스트 전달 규칙
- 에이전트 간 컨텍스트: CLAUDE.md의 데이터 구조 섹션을 공유 기준으로 사용
- 파일 수정 시: 전체 파일 출력 (diff 아님) → 덮어쓰기 방식
- 좌표 데이터: 반드시 vehicles.js에서 import, 에이전트 내 하드코딩 금지
