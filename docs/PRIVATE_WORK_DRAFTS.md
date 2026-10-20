# SITE-012: 신규 수리사례 비공개 초안

2026-10-17 로컬 구현. 아래 초기 계획을 보존하며, 최신 운영 준비 기록은 문서 마지막의 DEC-052 절을 따른다.

## 사용 흐름과 범위

1. `/admin?view=new`에서 작성 → **임시저장**. 필수 글/사진이 빠져도 저장한다.
2. `/admin?view=drafts`에서 다시 열어 이어 쓴다. 사진은 서버의 별도 비공개 버킷에 보관한다.
3. **검토 대기로 저장** → **저장된 버전 미리보기·발행**. 현재 폼의 미저장 변경은 미리보기에 들어가지 않는다.
4. 저장된 글·사진을 확인하고 확인란과 **이 버전 수동 발행**을 직접 누른다.
5. 공개 데이터 저장 → 배포 요청 → 빌드 → 운영 상세/사이트맵 확인을 구분해 표시한다.

임시저장/검토대기 변경은 배포 후크를 부르지 않는다. PART의 빈 작업 방식을 대표 작업으로 채우지 않는다. 기존 공개 사례의 수정·삭제·slug·필터는 유지한다. 기존글 수정본의 별도 초안, 자동/예약 발행, 역할별 권한 분리, Notion 연동은 이 버전의 범위가 아니다. 기존 공개 저장 API는 호환성을 위해 유지하므로, 새 초안 UI를 통한 수동 검토 원칙과 모든 외부 API 호출의 강제 차단은 다르다.

## 저장과 비공개 경계

```text
브라우저 /admin (Cloudflare Access)
   ├─ PUT draft ──> D1 work_drafts (본문·버전·상태)
   ├─ POST assets ─> private R2 ACEDENT_DRAFT_IMAGES
   │                 + D1 work_draft_assets (업로드 상태·소유 초안)
   └─ GET preview/assets ──> Access JWT 검증 + private/no-store

명시적 수동 발행
   ├─ 검토 버전 잠금·공개 slug 예약
   ├─ private R2 → 기존 public R2 (결정적 키로 복사)
   ├─ D1 works + work_assets 트랜잭션
   └─ Deploy Hook → 기존 published 전용 정적 빌드
```

- 기존 `works.status='draft'`는 삭제 대기이므로 작성 초안과 혼용하지 않는다.
- 새 테이블은 `0008_private_work_drafts.sql`의 `work_drafts`, `work_draft_assets` 두 개다. 기존 works 행을 옮기거나 수정하지 않는다.
- 본문/사진 API는 기존 `requireAccess()`의 서명·issuer·audience 검증을 사용한다. 변경 요청은 동일 Origin도 확인한다.
- 사진은 `/admin/api/drafts/{id}/assets?key=...`로만 읽는다. 다른 초안 키·외부 이미지 URL을 저장할 수 없다. `private, no-store`, `nosniff`, `noindex`, `Cross-Origin-Resource-Policy: same-origin`을 설정한다.
- 바인딩 누락 시 공개 버킷으로 대체하지 않고 차단한다. 코드의 동일 객체 검사만으로 두 다른 바인딩이 실제 같은 버킷을 가리키는 것까지 판별할 수는 없다. **운영 설정에서 서로 다른 버킷인지 확인해야 한다.**
- 공개 빌드 입력은 기존 `works WHERE status='published'`뿐이다. 초안 테이블/비공개 버킷을 빌드 시 조회하지 않는다. 관리자 JS 코드의 공개 전달은 초안 데이터 공개와 다르다.

## API

### 목록 구분 — SITE-013 / 2026-10-20

- 기본 `진행 중`에는 작성·검토·발행 준비·배포 중/실패/상태 불명 기록이 남는다. `deploy_state === 'ready'`만 `발행 완료`로 분류한다. 목록 조회/필터 전환은 상태 갱신·배포를 실행하지 않는다.
- 완료 기록과 비공개 사진은 삭제하지 않는다. 목록의 제목·사진과 `발행 당시 원본·기록`은 발행 시점 스냅샷이다. 현재 공개 내용은 `공개 글 보기`로, 수정은 기존 `/admin?view=edit&slug=...` 공개 편집기로 연결한다.
- 목록 GET의 `published_work_slug`는 `published_slug`와 현재 `works.status='published'`를 JOIN한 읽기 전용 필드다. 대상이 없거나 삭제 대기이면 null이다. 이때 공개/수정 링크를 만들지 않고 안내와 공개 사례 관리 링크를 표시한다. 페이지를 연 뒤 다른 창에서 삭제된 경우는 목록 새로고침으로 재조회한다. 발행 이력의 ready가 현재 공개 존재를 보장하지 않는다.
- 기존 초안 저장/삭제/발행 API와 보호 규칙은 그대로다. 새 스키마/환경변수/마이그레이션은 없다.
- 검증: `node scripts/test-draft-list.mjs`, 기존 `node scripts/test-private-drafts.mjs`. 읽기 전용 합성 시안은 `node scripts/preview-draft-list.mjs` → `http://127.0.0.1:4184/preview/draft-list`. 상태/빈 목록을 확인할 수 있고 공개/편집 이동은 목적지 표시만 하며 실제 이동을 차단한다.

모두 `/admin/api` 아래이며 Access 인증이 필요하다. fetch는 same-origin credentials를 사용한다.

| 경로 | 방식 | 역할 |
| --- | --- | --- |
| `/drafts` | GET | 최신순 초안 목록 (첫 버전은 전체 조회) |
| `/drafts/{id}` | GET | 저장 버전·본문·사진 메타·누락 항목 |
| `/drafts/{id}` | PUT | `{version,state:'writing' 또는 'review',payload}`; 최초 version=0 |
| `/drafts/{id}` | DELETE | 확인한 version의 미발행 초안과 소유한 비공개 사진 삭제 |
| `/drafts/{id}/assets` | POST | JPEG multipart, file/kind/partIndex/assetId; 키 재시도 재사용 |
| `/drafts/{id}/assets?key=...` | GET | 해당 초안의 준비 완료된 사진 바이트 |
| `/drafts/{id}/publish` | POST | version/confirmed=true, action=publish 또는 retry-deploy/attach |
| `/drafts/{id}/publish` | GET | 기록된 배포의 상태와 운영 반영 확인 |

UUID는 파일 소유권 구분용이며 인증 수단이 아니다. 원·화살표, 추가 전후 비교, 갤러리의 미완성 쌍/설명도 payload에 보존한다. 발행 시 기존 공개 저장 검증을 다시 적용한다. 이미지 크기/용량 정책은 기존과 같고 OG 합성도 기존 생성기를 재사용한다.

## 충돌·실패·중복 방지

- 저장은 정수 version 비교(CAS)로 다른 창의 변경을 덮어쓰지 않는다. 충돌 시 입력을 복사해 두고 재열기 안내.
- 최초 저장은 PART 설명/추가사진 설명을 포함한 텍스트를 먼저 보존한 뒤 사진 참조를 연결한다. 업로드 실패 시 현재 화면 입력을 유지한다. 서버가 응답한 마지막 저장 버전만 복구 기준이다.
- 업로드 `assetId`와 키는 재시도 동안 동일하다. 성공한 업로드를 다시 쓰지 않는다. 실패 상태(`ready=2`)는 재시도 가능하다.
- 발행은 검토한 버전만 10분 lease로 잠그고 공개 스냅샷/slug를 고정한다. 발행 중 편집·삭제를 차단하며 만료된 작업의 D1 쓰기도 조건부 트랜잭션으로 막는다.
- 복사 중 실패하면 원본/스냅샷을 보존하고 같은 키·slug로 재시도한다. 공개 키는 복사 전에 예약하여 기존 공개 고아 파일 삭제가 발행 중 사진을 지우지 않도록 한다.
- 공개 복사는 사용자가 발행을 누른 **이후** 시작한다. 중간 실패 때 일부 공개 복사본이 먼저 생길 수 있다. 이를 비공개 상태라고 주장하지 않으며 자동 삭제하지 않는다.
- 후크 호출 전에 DB에 요청 중을 기록한다. 결과 불명/응답 유실 시 자동 재전송하지 않는다. Cloudflare에서 확인한 main/production 배포 ID만 연결한다. 실제 요청이 전혀 없었던 경우는 운영 점검 후 처리한다.
- 빌드 실패/취소가 확인된 경우만 버튼으로 배포 재시도. 사례 행·사진을 다시 만들지 않는다.
- 빌드 성공만으로 완료로 표시하지 않는다. 해당 또는 이후 성공한 canonical production 빌드, 운영 상세의 URL/사진, 사이트맵의 해당 URL까지 확인해야 `ready`다. 상태 조회는 버튼 또는 화면이 열린 동안 10초 간격이며 새 발행을 자동 실행하지 않는다.

### 의도적으로 자동 처리하지 않는 경계

- 프로세스가 업로드 도중 강제 종료돼 `ready=0`이 남으면 삭제를 차단하고 점검 안내한다. 진행 중 파일을 시간만 보고 자동 삭제하지 않는다. 실제 업로드 종료/객체 상태를 확인한 운영자 복구가 필요하며 자동 복구/만료 청소는 이번 범위가 아니다.
- 미발행 초안 삭제는 해당 초안의 비공개 자산만 대상으로 한다. 발행 중/발행된 기록은 이 삭제 버튼으로 지울 수 없다.
- 사진 교체/삭제로 payload에서 빠진 비공개 파일, 재생성된 OG, 발행 후 비공개 원본은 즉시 지우지 않는다. 초안 전체 삭제 시 미발행 초안의 파일을 함께 지운다. 발행 후 보존기한/정리 정책은 후속 승인 대상이며 저장 용량이 계속 늘 수 있다.
- 권한은 현재 Access 관리자 권한을 공용으로 쓴다. 작성자와 사장님의 API 권한 자체를 분리한 RBAC는 구현하지 않았다. 수동 발행은 운영 규칙과 명시 버튼으로 구분한다.

## 운영 반영 전 필요한 별도 승인/설정

**아래는 계획이며 실행하지 않았다. 저장소 설정만 먼저 배포하면 신규 사례 저장이 차단될 수 있으므로 순서를 지킨다.**

1. 기존 D1 백업과 복구 지점 확인. 새 private 버킷도 기존 정기 백업에 포함할 계획을 승인받는다. 기존 백업이 이 새 버킷까지 자동 보호한다고 가정하지 않는다.
2. 별도 R2 버킷(제안 이름 `acedent-draft-images`) 생성. r2.dev 공개 URL, 커스텀 공개 도메인, 공개 Worker 프록시를 **모두 연결하지 않는다**. 기존 `acedent-images`는 그대로 둔다.
3. Pages Functions에 `ACEDENT_DRAFT_IMAGES`를 그 새 버킷으로 바인딩한다. 현재 wrangler 설정은 이번 작업에서 수정하지 않았다. 향후 승인 후 기존 r2_buckets 배열에 하나 추가한다.

   ```jsonc
   { "binding": "ACEDENT_DRAFT_IMAGES", "bucket_name": "acedent-draft-images" }
   ```

   preview 환경을 쓰면 production과 분리된 DB/버킷/후크를 명시하거나 바인딩을 빼서 초안 저장을 차단한다. 공개 preview에서 운영 초안을 시험하지 않는다.

4. 프로젝트 루트에서 0008만 미적용인지 확인 후 원격 D1 마이그레이션 승인/실행. 과거 seed(0002)가 대기 중이면 먼저 중단하고 이력 상태를 확인한다.

   ```powershell
   Set-Location -LiteralPath 'D:\chatgpt-project\acedent'
   .\node_modules\.bin\wrangler.cmd d1 migrations list acedent-content --remote
   .\node_modules\.bin\wrangler.cmd d1 migrations apply acedent-content --remote
   ```

   인증은 기존 승인된 방식만 사용한다. `.env.local`과 OAuth 충돌 시 과거 OAuth 전용 env-file 절차를 사용하며 새 권한/토큰을 임의로 만들지 않는다.

5. 새 비밀값은 필요하지 않다. 기존 `CLOUDFLARE_ACCESS_TEAM_DOMAIN`, `CLOUDFLARE_ACCESS_AUD`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_PAGES_PROJECT`, `DEPLOY_HOOK_URL`, `R2_PUBLIC_BASE_URL`, `ACEDENT_DB`, `ACEDENT_IMAGES`를 재사용한다. Access가 `/admin`과 `/admin/*`를 보호하는지 확인한다.
6. 정확한 변경 범위를 승인받아 Pages production에 배포. 별도 허가받은 테스트 자료로 저장→인증되지 않은 접근 차단→발행→실제 정적 결과 및 운영 후크 응답 형태를 최소 검증한다. **현재는 실제 Cloudflare D1/R2/후크 종단 동작을 검증하지 않았다.**

### 되돌리기

문제가 생기면 이번 릴리스 코드만 되돌린다. 새 테이블/버킷/초안은 삭제하지 않고 보존한다. 발행된 사례는 기존 works/work_assets에 있으므로 기존 공개 기능으로 계속 읽을 수 있다. 발행 중인 건/부분 공개 복사가 있으면 스냅샷·자산 예약을 확인하기 전 공개 고아 파일 정리를 실행하지 않는다(이전 코드에는 초안 예약 보호가 없다). 필요한 데이터 복구는 백업 기준과 운영 승인 후 별도 진행한다.

## 로컬 검증과 시안

- `scripts/test-private-drafts.mjs`: 실제 API handler + 서명된 합성 JWT + in-memory SQLite/R2 + 후크 모의 처리. 예상치 못한 네트워크 차단. 실제 사례를 등록하지 않는다.
- `scripts/test-work-comparisons.mjs`: 기존 공개 생성/수정/삭제·추가비교 회귀 근거.
- `ACEDENT_OFFLINE_BUILD=1`: sync-works가 로컬 공개 JSON을 읽기만 하도록 하는 로컬 검사 옵션. CF_PAGES=1에서는 사용을 차단한다. 일반 Vite/Cloudflare 플러그인의 기존 env 로딩까지 바꾸는 옵션은 아니다.
- `scripts/preview-private-drafts.mjs`: 127.0.0.1:4183 전용, 합성 도형 사진/임시 메모리 DB. 운영 env/사진/인증을 사용하지 않는다. 프로세스 종료 시 시험 자료는 없어진다. 실제 사진은 넣지 않는다.

```powershell
node scripts/test-private-drafts.mjs
.\node_modules\.bin\tsc.cmd --noEmit
$env:ACEDENT_OFFLINE_BUILD='1'
npm.cmd run build
npm.cmd run build:static -- --outDir outputs/private-drafts-static
```

일반/정적 빌드는 같은 dist를 덮어쓰지 않도록 순서대로 또는 다른 outDir에서 실행한다. 생성물에서 초안 제목/비공개 사진 URL/테스트 식별자 누출을 검사한다. `content/works.generated.json`은 시작 시의 53건 그대로 보존한다.

시안 실행 시 현재 설치된 sharp 모듈의 절대 경로를 `ACEDENT_PREVIEW_SHARP_MODULE`에 지정한다(새 패키지 설치 불필요). `node scripts/preview-private-drafts.mjs` 후 `http://127.0.0.1:4183/admin?view=drafts`를 연다. 표시되는 발행/배포 결과도 전부 모의 상태다.

## DEC-052 운영 준비 — 2026-10-17

- 사용자 운영배포 승인 후 `acedent-draft-images`를 별도 Standard R2로 생성했다. r2.dev 비활성·커스텀 도메인0이며 기존 `acedent-images`와 다르다. 기존 백업 읽기 전용 토큰으로 새 버킷 조회를 확인했고 권한/토큰은 변경하지 않았다.
- 기존 정상 복구점은 `2026-10-16T21-10-30.531Z-d4c39346`(공개53건·객체641개, Drive 완료 marker/index 검증)이다. 이력0001~0007과 실제테이블을 대조한 뒤 미적용 `0008_private_work_drafts.sql`만 적용했다. 적용 직후 기존 works53·drafts0·draft_assets0·0008이력1을 확인했다.
- `wrangler.jsonc`에 production/local `ACEDENT_DRAFT_IMAGES` 바인딩을 추가한다. 기존 production vars/시크릿/Access/D1/public R2는 유지한다. `env.preview`의 vars/D1/R2는 빈 값으로 명시하여 공개 preview가 production 초안 자원에 연결되지 않게 한다. 이 의도적인 미상속으로 Wrangler preview 누락 경고가 나오지만 production 설정 검증은 정상이다. 별도 preview DB/버킷/후크 생성은 이번 범위가 아니다.
- 별도 `acedent-backup` 커밋 `720ddf3`은 기존 공개+비공개 버킷을 bucket+key로 분리해 백업한다. 준비완료 자산·초안 payload 참조 누락/다른 소유자/버킷권한 실패를 차단한다. 실제 age를 사용한 전체43개 검사(새 두 버킷6개 포함, skip0)가 통과했다. 구 스냅샷·키·Drive·예약·보존정책은 유지한다.
- 사이트 push 전 기존 백업 워크플로 수동1회의 원격 암호화 업로드/readback 성공을 확인한다. 실제 배포 ID와 운영 확인 결과, 인증이 필요한 미검증 사항은 운영 원본 `acedent-operations/site/SITE_HANDOFF.md`에 기록한다. 합성 비공개 저장 확인만 허용되며 가짜 사례 공개 발행은 하지 않는다.
