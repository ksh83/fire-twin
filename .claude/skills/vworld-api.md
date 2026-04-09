# Skill: V-World API
국토부 공간정보 오픈플랫폼 연계 가이드

## API 키 설정
.env 파일:
```
VITE_VWORLD_KEY=YOUR_VWORLD_API_KEY
```
V-World 오픈플랫폼 회원가입 후 발급: https://vworld.kr

## 주요 API 목록
| 기능 | 엔드포인트 | 용도 |
|------|-----------|------|
| 지오코딩 | /req/address | 주소 → 좌표 변환 |
| 역지오코딩 | /req/address?request=getaddress | 좌표 → 주소 |
| WMS | /req/wms | 지도 타일 이미지 |
| WFS | /req/wfs | 벡터 공간정보 |

## WFS 재난방재 레이어
| 레이어명 | 설명 |
|---------|------|
| lt_c_uq111 | 소방서관할구역 |
| lt_c_uq112 | 소방파출소 |
| lt_c_aq010 | 재해위험지구 |

## V-World 3D 지도 API (WebGL 3.0)
※ 공공기관 API 키 필요. OSM Buildings와 병렬 사용 불가.
  V-World를 사용할 경우 createOsmBuildingsAsync() 제거 필요.
```js
// index.html <head>에 추가 (Vite 환경에서는 vite.config.js에서 inject)
// <script src="https://map.vworld.kr/js/webglMapInit.js.do?version=3.0&apiKey=KEY"></script>
```

## 현재 상태
- OSM Buildings: 즉시 사용 가능 (토큰만 필요)
- V-World WFS 레이어: API 키 발급 후 data-engineer.md 패턴으로 추가
- V-World 3D 맵 전환: 별도 마이그레이션 작업 필요 (geo-engineer 담당)
