# SITE-007 — Access 검증과 공개 목록의 수정 바로가기

## 상태와 범위

2026-10-13 로컬 구현·검증 완료. 14:20 KST 운영본부의 실제 Access 설정 UI 확인 기록을 인수했다. **이후 DEC-032로 아래 24파일의 단독 커밋·main 푸시·운영 배포가 승인됐다. 실제 새 코드의 운영 세션은 아직 미검증이며, 배포 결과와 최소 운영 확인은 SITE_HANDOFF의 후속 기록을 따른다.**

승인 범위는 기존 SITE-007 23파일에 `wrangler.jsonc` vars 2개를 더한 **24파일 단독 배포**다. 확인된 값을 Wrangler의 기존 vars에 반영하며 기존 3개 vars와 D1/R2 바인딩을 보존한다. 아래 미승인·미적용 표기는 14:20 준비 시점의 이력이며 DEC-032가 해당 범위의 실행 승인을 대체한다. 기존 테스트·빌드·UI 확인은 반복하지 않는다.

- `/works`, 기존 작업 카테고리와 부위 목록에서만 검증된 운영자에게 카드 아래 `수정 ↗` 링크 표시.
- 기존 `/admin?view=edit&slug=...`를 새 탭으로 열며 목록의 필터/스크롤은 유지.
- 홈, 상세 추천 카드, SEO/slug, 사례 저장 구조, DB/R2/백업에는 변경 없음.
- 운영 사례의 등록·수정·삭제로 시험하지 않음.

## 서버 인증 (모든 관리자 API에 공통 적용)

`functions/_shared/admin.ts`의 `requireAccess(request, env)`는 비동기 검증이다. 기존 7개 API 파일의 14개 핸들러 및 새 session GET은 데이터 접근 전에 반드시 `await`한다.

`functions/_shared/access.ts`는 Cloudflare 공식 예제와 같이 Web Crypto 호환 `jose`를 사용한다. 검증 항목:

- 공식 사이트/로컬 개발 호스트 제한 유지. 로컬에서도 서명 검증을 생략하지 않음.
- `Cf-Access-Jwt-Assertion` 필수. 헤더 존재만으로 통과하는 fallback 없음.
- 서버 설정에서 고정한 HTTPS 팀 도메인의 `/cdn-cgi/access/certs` 공개키로 RS256 서명 검증.
- 정확한 issuer 및 해당 관리자 애플리케이션 AUD, exp/iat/sub 필수, 유효시간 및 `type: app` 검사. nbf가 있으면 아직 유효하지 않은 토큰 거부.
- 사용자의 email/sub는 **검증된 JWT의 클레임만** 사용. 별도의 이메일 헤더는 인증 신원으로 신뢰하지 않음.
- 공개키 캐시 최대 5분, 키 갱신 cooldown 30초, 키 요청 timeout 3초. 사용자 권한 결과는 캐시하지 않고 요청마다 재검증.
- Node fixture에서 동시 키 요청 공유를 확인했지만, jose는 Workers의 요청별 I/O 제약에 맞춰 동작하므로 운영 isolate 간 공유/항상 1회 조회를 보장하지 않는다.
- 설정 누락은 503, 토큰/서명/설정 형식/키 조회 검증 실패는 403. 토큰·쿠키·클레임·외부 오류 본문을 로그나 응답에 출력하지 않음.

## 운영 설정 — 본부 UI 확인 완료 / 값 적용·실제 세션 검증 대기

Pages Functions **런타임**에 다음 두 값을 설정해야 한다. API 토큰이나 로그인 JWT가 아니다.

| 이름 | UI에서 확인된 적용 제안값(아직 미적용) | 확인 위치 |
| --- | --- | --- |
| `CLOUDFLARE_ACCESS_TEAM_DOMAIN` | `https://acedent.cloudflareaccess.com` | 기존 Zero Trust 개요의 팀 도메인 |
| `CLOUDFLARE_ACCESS_AUD` | `20075e2b9d6a801f1764650314e64babad24bce3249fd3e30ef3dab144e2afe8` | 자체 호스팅 `www` 앱의 추가 설정 → AUD 태그 |

근거는 `D:/chatgpt-project/acedent-operations/site/SITE_HANDOFF.md`의 **2026-10-13 14:20 KST — SITE-007 운영본부 실제 Access 설정 읽기 완료** 절이다. 본부가 기존 Chrome의 UI를 확인했고 제작 창은 해당 기록을 인수했으며, 중복 브라우저 조회나 운영 JWT/쿠키 수집은 하지 않았다. 개요의 별도 자동생성 '팀 이름' 값과 혼동하지 않고 명시된 '팀 도메인'을 사용한다. 토큰의 실제 issuer 일치와 새 서버 검증 성공은 아직 확인한 것이 아니다.

`.env.local`만 채우거나 빌드 변수만 설정하는 것으로 Pages Functions 런타임 설정이 완료되는 것은 아니다. 현재 프로젝트의 Wrangler 설정 우선 방식에 맞춰, **별도 승인 후 `wrangler.jsonc`의 기존 vars 안에 위 2개를 추가하고 새 인증 코드와 같은 배포에 포함**하는 것이 최종 제안이다. 기존 3개 vars 및 D1/R2 바인딩은 그대로 둔다. `.env.example`은 빈 이름만 유지한다. 현재 Wrangler나 대시보드 설정은 바꾸지 않았다.

본부가 확인한 같은 `www` 앱의 보호 대상은 다음 4개다. 새 `/admin/api/session`도 포함되므로 Access 경로 변경은 제안하지 않는다.

- `www.acedentshop.co.kr/admin`
- `www.acedentshop.co.kr/admin/*`
- `acedentshop.co.kr/admin`
- `acedentshop.co.kr/admin/*`

정책은 `사장님만 허용` Allow 1개이며 포함 규칙은 운영자 이메일 1개다. Everyone/Bypass 없음, 앱/정책 세션 24시간을 UI로 확인했다. 개인 이메일 원문은 문서화하지 않는다. 공개 `/works`를 보호 범위에 넣거나 공개 세션 토큰 전달 경로를 만들지 않는다.

이전 확인 이력은 보존한다: 제작 창의 API 시도에서는 조직 HTTP 403(10000), 대상 앱/zone 조회 불가로 미확인이었으나, 이후 본부의 위 UI 근거로 설정 식별자와 보호 범위 확인이 해소됐다. API 조회 실패를 실제 앱 부재로 판단하지 않았고 권한도 확대하지 않았다.

**확인된 값을 새 코드와 함께 반영하지 않으면 기존 관리자 API도 차단된다. 설정 확인 완료와 운영 적용·세션 검증 완료를 구분하며, 별도 승인 전에는 배포하지 않는다.**

## 공개 화면의 동작

- `GET /admin/api/session`은 같은 Access 보호 하에서 인증을 검증하고 `{ authenticated, expiresAt }`만 반환. D1/R2 조회나 신원 정보 응답 없음.
- 응답은 `private, no-store`. JWT는 JS·URL·localStorage·sessionStorage에 저장하지 않음.
- `lib/admin-session.ts`는 페이지 생명주기당 한 번만 요청한다. `credentials: same-origin`, `mode: same-origin`, `cache: no-store`, `redirect: error`, 4초 timeout.
- React 공개 목록을 먼저 표시하고 effect에서 확인한다. 카드별 요청, 필터 변경 시 재요청, polling, 자동 재시도 없음. StrictMode 재마운트도 요청 공유.
- 일반 방문자/실패/HTML 로그인 응답/redirect/timeout/만료는 버튼만 숨김. 로그인 화면으로 자동 이동하거나 오류 안내를 노출하지 않음.
- 만료 시 한 번 예약된 타이머로 버튼을 숨기고, background/BFCache 복귀 때도 만료를 재확인. 로그인 상태가 나중에 달라졌다면 목록을 새로고침해야 함. 강제 로그아웃/정책 회수 사실을 공개 페이지에서 실시간 polling하지는 않으며, 실제 관리자 접근과 저장 때 다시 검증한다.
- `acedent_owner_excluded`는 통계 제외 쿠키일 뿐 인증에 사용하지 않음.
- 같은 브라우저 프로필·해당 도메인에서 어드민 Access 로그인이 필요. Cloudflare 대시보드 로그인과는 다름.

## 카드 UI/기존 동작 보존

- 기존 카드 전체 상세 링크는 그대로 두고 `canEdit`일 때만 외부 wrapper에 형제 수정 링크를 추가. 중첩 anchor/button 없음.
- 회색 계열의 작은 보조 버튼, 최소 높이 44px, 키보드 focus 표시. 사진·제목·기존 상세 보기와 별도 영역.
- `target="_blank" rel="noopener noreferrer"` 유지. 수정 링크에는 공개 사례 조회/상담 추적 핸들러 없음.
- `canEdit` 기본값은 false이므로 홈/추천/어드민 프리뷰의 공유 카드 사용처는 기존 결과 유지.
- 관리자 페이지와 JWT 검증 라이브러리는 공개 갤러리에 정적 import하지 않는다. 관리자 컴포넌트의 기존 lazy chunk 분리 유지.

## 로컬 검증

실행 명령:

```powershell
node --test scripts/test-admin-access.mjs scripts/test-admin-session.mjs scripts/test-site-improvements.mjs scripts/test-works-contact.mjs scripts/test-work-readability.mjs
npx tsc --noEmit
npm run build
npm run build:static
node node_modules/wrangler/bin/wrangler.js pages functions build functions --outdir outputs/site-007/functions
```

- 관련 테스트 30개 통과. 정상/위조/누락/만료/다른 issuer/AUD/유효시간/키 실패, 15개 핸들러의 await 및 실패 시 데이터 접근 차단 포함.
- 타입·일반·정적·Pages Functions 빌드 통과. 타입 검사는 Windows 샌드박스에서 pnpm junction의 기존 Vite/Next 타입 해석 오류가 있었으나, 같은 명령을 일반 실행 환경에서 통과했다. 이를 우회하려고 소스 타입을 약화하거나 tsconfig를 바꾸지 않음.
- 로컬 headless Chrome: 320/390/1440px, 인증 지연 상태에서도 목록/사진 표시, 페이지당 요청 1회, 별도 키보드 링크, 버튼 76×44px, 새 탭의 기존 수정 폼, 필터/스크롤 유지, 조회·상담 이벤트 오집계 없음. 게스트/오류/redirect/HTML/만료/표시 후 만료 포함 9개 시나리오 통과, pageerror 0.
- 로컬 브라우저 시험은 외부 통신 및 모든 POST 등 쓰기 요청을 차단. 사진은 로컬 파일/표시용 placeholder, 상태·사례 조회는 fixture 응답. 실제 Cloudflare 로그인/세션/키 연동 성공을 뜻하지 않음.
- 새 서버/세션/테스트 코드의 focused lint 통과. 확장 확인에서는 공유 카드/목록의 기존 Next 전용 이미지·링크 규칙 및 React compiler 진단 8개, works API의 기존 문자열 변환 진단 2개가 남는다(HEAD의 변경되지 않은 코드). 전체 lint 통과로 보고하지 않으며 이 범위에서 공개 구조나 기존 데이터 변환을 바꾸지 않음.
- 빌드가 읽은 D1 51건 동기화 결과는 `outputs/site-007/works.synced-d1.json`에 검증 참고용으로 별도 보관하고 `content/works.generated.json`은 작업 전 내용으로 복귀. 운영 D1/R2는 변경하지 않음.
- 시안/검증 자료: `outputs/site-007/browser-result.json`, `owner-1440.png`, `owner-390.png`, `card-320.png`, `card-390.png`, `guest-390.png`. outputs는 Git 제외.

## 최종 배포 제안 / 되돌리기 (별도 승인 필요)

대상은 `concettimonte-hue/acedent`의 **main → Cloudflare Pages `acedent-git` production**, 운영 도메인은 `www.acedentshop.co.kr`/`acedentshop.co.kr`다. main 푸시는 운영 배포로 취급한다.

1. **승인 대상:** 앞서 검토·검증한 SITE-007 23파일 + `wrangler.jsonc` 1파일의 vars 2개 추가, 총 24파일. 기존 vars/바인딩·사례 데이터·사진·slug·SEO·백업·Access 정책은 불변. 소스/설정이 함께 반영되는 단독 커밋으로 제안하며, 현재는 문서상의 변경안이다.
2. **승인 후 한정 확인:** 값 적용 뒤 설정 파싱과 Pages Functions 런타임 포함 여부, 정확한 24파일 diff/커밋 범위를 대조한다. 새로운 코드 변경이나 오류 근거가 없으면 이미 통과한 30테스트/9UI시나리오/타입·빌드 검사를 반복하지 않는다. 비밀 토큰/쿠키를 출력하거나 placeholder를 적용하지 않는다.
3. **운영 최소 확인:** 해당 커밋의 production 자동 배포 성공 → 익명 목록의 정상 표시·수정 링크 숨김 → 인증된 운영자의 session GET·기존 사례 조회 → 수정 링크의 기존 편집 폼 새 탭 이동만 확인한다. 실제 사례 저장·수정·삭제·사진 교체나 고객 연락은 하지 않는다. 실제 세션 검증 결과는 수행 전까지 미검증으로 남긴다.
4. **장애 시:** 관리자 인증 차단/공개 목록의 주요 문제가 있으면 별도 승인된 복귀 범위 안에서 **SITE-007 단독 커밋만 revert**하고 production 복구를 최소 확인한다. 기존 Access 보호를 유지하며 정책 해제나 JWT 존재 검사 fallback을 추가하지 않는다. 이전 구현의 헤더-only 한계는 별도 보고한다. DB/R2/마이그레이션/백업 롤백은 필요 없다.
5. **배포 기준 보존:** 본부가 2026-10-13 14:20 KST 대시보드에서 확인한 production은 `bf67f95` 소스의 `1e7c60a0-2b3c-44c0-86dc-25fb0c567614`다. 과거 `ef6c612f`를 현행으로 가정하거나 과거 정적 파일로 최신 사례를 덮지 않는다. 실제 승인 실행 시 그때의 변경/배포 기준과 최신 D1 사례를 보존하고 무관한 작업을 되돌리지 않는다.

서버 변경은 인증 공통 파일과 관리자 호출부, UI 변경은 WorkCard/WorksGalleryPage/globals.css/admin-session, 의존성은 jose와 lockfile, 문서는 본 파일/.env.example, 검증은 관련 scripts다. 여기에 승인 후 Wrangler vars 2개만 추가한다. 기존 미추적 운영 보고서·분리 보관한 생성 데이터·SITE-006 자료는 커밋 범위에 포함하지 않는다.

### 2026-10-13 문서 갱신 기록

- 운영 인계 스킬의 승인/근거 분리 원칙에 따라, 본부 UI에서 확인한 식별자·보호 범위와 아직 미검증인 실제 세션을 구분했다.
- 본부 최종 배포 제안과 중대한 차이 없음. 이번 턴은 본 문서만 수정했으며 SITE_HANDOFF/공통 운영 문서를 중복 편집하지 않았다.
- 소스·Wrangler 값·운영 설정 변경, 브라우저 재조회, 기존 검사 반복, 커밋·푸시·배포 없음. 별도 승인 전 대기.

### 2026-10-13 DEC-032 배포 실행 승인

- 본부의 정확한 배포안에 대한 사용자 승인으로 기존 23파일과 위 Wrangler 설정 1파일만 단독 커밋·main 푸시한다. 기존 보고서/자동생성 사례 JSON/사진/속도 실험은 제외한다.
- 설정 파싱·기존 바인딩 보존·Functions 포함과 해당 커밋의 production 배포 성공만 추가 확인한다. 앞서 통과한 테스트·타입·일반/정적 빌드를 반복하지 않는다.
- Chrome의 익명 목록/수정 숨김, 인증된 session GET·기존 사례 조회·편집 폼 새 탭 확인은 운영본부가 단독 수행한다. 제작창에서 중복 접근하거나 실제 저장/삭제/고객 연락을 하지 않는다.
- 실제 관리자 차단이나 공개 목록 회귀가 확인되면 이번 단독 커밋만 revert해 같은 대상에 복귀하는 것까지 승인됐다. 단순 미로그인은 코드 장애와 구분한다. Access 해제/인증 우회/강제 push/DB·R2·백업 복원은 금지한다.
- 커밋 SHA, 배포 ID, 런타임 설정 반영 증거와 실제 운영 확인 상태는 `D:/chatgpt-project/acedent-operations/site/SITE_HANDOFF.md`의 배포 후 기록으로 남긴다.

참고: [Cloudflare JWT 검증](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/), [jose 런타임 지원](https://github.com/panva/jose).
