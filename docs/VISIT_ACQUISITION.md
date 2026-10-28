# 방문통계 유입 경로·첫 페이지

## 집계 기준

- 기존 `site_visit_daily`의 방문자/페이지 조회 집계는 유지한다. 유입 출처를 과거 데이터에 추정해 채우지 않는다.
- 새 `site_visit_sessions`는 방문이 시작될 때 출처·첫 공개 경로·시작시각·시작일(KST)·기존 방문자 해시를 기록한다.
- 페이지 조회가 30분 이상 없으면 새 방문이다. 30분 안의 새로고침·내부 이동은 첫 경로와 출처를 바꾸지 않는다. 자정이 지나도 활동 중인 방문은 시작한 날짜에 속한다. 이 횟수는 기간 내 고유 방문자 수와 다르다.
- `acedent_visit_session`은 서버가 설정하는 Secure/HttpOnly/SameSite=Lax 30분 쿠키다. 페이지 조회마다 만료가 갱신된다. 기존 방문자·관리자 제외 쿠키와 인증 방식은 유지한다.
- 관리자 쿠키·관리자 경로·DNT·알려진 봇은 집계 제외한다. 쿠키 차단/삭제, 기기 변경, 여러 탭의 동시 최초 진입 등으로 실제 사람 수와 차이가 생길 수 있다.
- 과거/구버전 클라이언트에는 유입 정보가 없다. 표에 미기록 상태를 표시하며 기존 방문자 수로 보정하지 않는다.

## 출처와 개인정보 최소화

- 클라이언트 `lib/visit-acquisition.ts`가 referrer의 호스트와 알려진 UTM/광고 표식으로 고정 코드만 만든다. API는 허용 코드만 수락한다.
- 네이버 검색/블로그/플레이스·지도/기타, 구글, 다음, 빙, SNS·메신저, 기타 외부를 구분한다. 네이버 단축 URL을 블로그나 플레이스로 추정하지 않는다. 구글 도메인만 보고 유료/자연검색/지도를 추정하지 않는다.
- Google 클릭 표식 또는 알려진 `utm_source` + 유료 `utm_medium`은 '광고 표식'으로만 표시한다. 광고 플랫폼 실제 클릭/성과 수치가 아니다. 새 태그를 광고에 자동 추가하지 않는다.
- 브라우저가 출처를 주지 않으면 '직접·출처 확인 불가'다. 앱·메신저 등에서 출처가 누락될 수 있으므로 직접 입력 방문으로 단정하지 않는다.
- 전체 referrer URL·외부 호스트 원문·검색어·UTM 원문·광고 ID·IP·사용자 에이전트 원문을 새 테이블에 저장하지 않는다. API 요청 본문은 공개 경로와 고정 출처 코드뿐이며 fetch의 Referer도 보내지 않는다.
- 유입/첫 페이지 집계 API는 기존 Cloudflare Access 뒤에 있고 캐시하지 않는다. 세션 ID·방문자 해시는 관리자 응답에 포함하지 않는다. 기존 GA4/Clarity에 별도 이벤트를 추가하지 않는다.
- 참고: [MDN referrer](https://developer.mozilla.org/en-US/docs/Web/API/Document/referrer), [Referrer-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy). 브라우저가 제공하는 범위 이상으로 출처를 복구할 수 없다.

## 적용 순서 (현재 로컬 구현·미리보기만)

1. 사용자 미리보기 확인 및 운영 마이그레이션/배포 승인.
2. 최신 D1 백업/Time Travel 복구 지점 확인. 기존 마이그레이션 이력을 조회하여 **미적용 파일이 `0009_visit_acquisition.sql`뿐인지** 확인한다. 다른 파일(특히 seed 0002)이 보이면 적용하지 말고 이력을 먼저 점검한다.
3. 승인 후 프로젝트 폴더에서 아래 명령을 사용한다. 이 문서 작성 과정에서는 원격 명령을 실행하지 않았다.

```powershell
Set-Location -LiteralPath 'D:\chatgpt-project\acedent'
.\node_modules\.bin\wrangler.cmd d1 migrations list acedent-content --remote
# 미적용 목록이 0009 하나인지 확인한 후에만:
.\node_modules\.bin\wrangler.cmd d1 migrations apply acedent-content --remote
```

기존 API Token/OAuth 충돌이 재발하면 로그인 재시도 대신 승인된 OAuth 전용 env-file 절차를 사용한다. 토큰·키를 출력하거나 커밋하지 않는다.

4. 테이블 확인 후 승인된 코드만 배포한다. 기존 데이터 수정이나 소급 등록은 하지 않는다.
5. 인증된 운영 관리자에서 오늘/어제·출처 선택·첫 페이지 목록·관리자 제외를 최소 확인한다. 실제 운영 방문을 테스트로 만들어 숫자를 부풀리지 않는다.

마이그레이션은 CREATE TABLE/INDEX IF NOT EXISTS만 사용한다. 기존 통계·사례 테이블은 수정하지 않는다. 미적용/일시 장애 시 기존 방문 조회는 먼저 저장하고 신규 유입 기록만 건너뛰며, 관리자 새 영역은 준비 필요/불러오기 실패를 표시한다. 로그에는 요청 원문을 남기지 않는다.

## 복귀와 로컬 검증

- 운영 회귀 시 이번 코드 커밋만 복귀한다. 새 테이블과 모은 기록은 보존하며 DROP/기존 통계 복원은 하지 않는다. 이전 코드에서는 새 테이블을 읽거나 쓰지 않는다.
- `scripts/test-visit-acquisition.mjs`: 출처 분류·민감 원문 제외·세션 경계·기존 통계 보존·관리자 제외·실제 SQLite/인증 API·SPA 이동 회귀.
- `scripts/preview-analytics-dates.mjs`: 합성 숫자/사례/출처, 메모리 SQLite만 사용한다. `.env`와 운영 API에 연결하지 않는다. 유입 시작 전 날짜도 비교할 수 있다.
- D1 마이그레이션은 로컬 테스트에서만 적용했다. 운영 데이터 변경·커밋·푸시·배포는 별도 승인 단계다.
