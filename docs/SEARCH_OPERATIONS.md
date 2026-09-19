# 검색 포털 운영 점검

이 문서는 코드가 검색 가능한 상태인지와 실제 색인·노출 여부를 구분해 확인하기 위한 운영 절차입니다.

## 자동 생성 주소

- 일반 사이트맵: `https://www.acedentshop.co.kr/sitemap.xml`
- 이미지 사이트맵: `https://www.acedentshop.co.kr/image-sitemap.xml`
- RSS: `https://www.acedentshop.co.kr/rss.xml`
- robots: `https://www.acedentshop.co.kr/robots.txt`

사례 등록·수정·삭제 후 Cloudflare Pages 배포가 끝나면 위 파일도 D1의 최신 공개 사례를 기준으로 다시 생성됩니다.

## Google Search Console

1. `sitemap.xml`과 `image-sitemap.xml`을 각각 제출합니다.
2. 새 사례는 URL 검사를 실행해 canonical, 크롤링 가능 여부, 발견된 이미지를 확인합니다.
3. 색인 생성 요청은 중요한 신규 사례에만 사용합니다. 반복 요청은 노출을 보장하지 않습니다.
4. 페이지 색인 보고서에서 `중복 페이지`, `발견됨 - 현재 색인 생성 안 됨`, `크롤링됨 - 현재 색인 생성 안 됨`을 월 1회 확인합니다.
5. 검색 실적은 지역명·차종·부위·작업방식 쿼리와 상세 페이지별로 확인합니다.

## 네이버 서치어드바이저

1. 사이트맵에 `sitemap.xml`, RSS에 `rss.xml`을 제출합니다.
2. 새 사례 URL을 URL 검사로 확인하고 중요한 사례만 수집 요청합니다.
3. 수집 현황과 색인 현황에서 상세 URL이 실제로 반영됐는지 확인합니다.
4. 제목·설명에 키워드를 반복 추가하지 않습니다. 어드민에 입력한 실제 차종, 손상 부위, 작업 내용이 본문과 메타 정보에 자연스럽게 반영되도록 유지합니다.

## 배포 후 최소 확인

1. Cloudflare Pages 배포 성공
2. 신규 상세 URL HTTP 200
3. HTML의 title, description, canonical, 이미지 ALT 확인
4. `sitemap.xml`의 URL·lastmod 확인
5. `image-sitemap.xml`의 BEFORE/AFTER 및 추가 사진 확인
6. `rss.xml`의 최신 사례 확인

검색 가능한 기술 상태가 정상이어도 실제 색인과 검색 순위는 포털의 판단과 시간이 필요합니다. 광고 유입과 자연 검색 유입은 GA4에서 구분해 확인합니다.
