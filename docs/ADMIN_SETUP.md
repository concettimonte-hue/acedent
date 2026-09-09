# 에이스덴트 관리자 페이지 설정

관리자 화면은 `/admin`에서 사진과 작업 내용을 입력하고, D1에 사례 데이터와 R2에 사진을 저장합니다. 손님 페이지는 D1을 실시간 조회하지 않으며, 저장 직후 Cloudflare Pages Deploy Hook이 `main` 기준 정적 빌드를 다시 실행합니다.

## 1. D1과 R2 준비

1. Cloudflare 대시보드에서 D1 데이터베이스를 생성합니다. 권장 이름은 `acedent-content`입니다.
2. R2 버킷을 생성합니다. 권장 이름은 `acedent-images`입니다.
3. R2 버킷에 공개 Custom Domain 또는 공개 개발 URL을 연결하고 HTTPS 기본 주소를 기록합니다.
4. 저장소 루트의 `.env.local`에 아래 값을 추가합니다. 실제 값은 절대 커밋하지 않습니다.

```dotenv
CLOUDFLARE_ACCOUNT_ID=계정_ID
CLOUDFLARE_API_TOKEN=API_토큰
CLOUDFLARE_D1_DATABASE_ID=D1_데이터베이스_ID
CLOUDFLARE_R2_BUCKET_NAME=acedent-images
R2_PUBLIC_BASE_URL=https://이미지_공개_도메인
CLOUDFLARE_PAGES_PROJECT=acedent-git
DEPLOY_HOOK_URL=https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/...
```

5. 다음 명령으로 D1 테이블을 만듭니다.

```bash
npx wrangler d1 execute acedent-content --remote --file migrations/0001_admin_content.sql
```

## 2. 기존 9건 이전

아래 명령은 기존 slug를 바꾸지 않고 9건의 JSON을 D1에 넣고, 전·후 사진과 썸네일을 R2에 복사합니다. 로컬의 기존 JSON과 사진은 삭제하지 않습니다.

```bash
npm run content:migrate:d1
```

R2 업로드는 Windows의 `npx.cmd`나 Wrangler CLI를 실행하지 않고 Cloudflare R2 REST API를 직접 사용합니다. 한글·공백이 포함된 로컬 경로도 별도 셸 인용 없이 처리되며, 각 파일마다 `[확인]`, `[업로드]`, `[업로드 완료]`, `[건너뜀]` 진행 상태를 출력합니다. 작업이 중간에 멈춰도 같은 크기와 해시의 R2 파일은 다시 올리지 않고 D1 레코드는 slug·object key 기준으로 갱신하므로 같은 명령을 안전하게 다시 실행할 수 있습니다.

이전이 끝난 뒤 D1 콘솔에서 아래 쿼리 결과가 `9`인지 확인합니다.

```sql
SELECT COUNT(*) AS total FROM works WHERE status = 'published';
```

## 3. Cloudflare Pages 바인딩

Cloudflare Pages의 `acedent-git` 프로젝트에서 Settings → Bindings/Variables에 다음을 설정합니다. Preview와 Production을 구분해 운영한다면 Production에 반드시 같은 값을 넣습니다.

- D1 binding: 변수명 `ACEDENT_DB`, 위에서 만든 D1 선택
- R2 binding: 변수명 `ACEDENT_IMAGES`, 위에서 만든 R2 선택
- 일반 변수: `R2_PUBLIC_BASE_URL`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_PAGES_PROJECT`
- 암호화 변수: `DEPLOY_HOOK_URL`, `CLOUDFLARE_API_TOKEN`
- 빌드 환경 변수: `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`

빌드용 API 토큰에는 최소한 D1 읽기와 Pages 배포 조회 권한이 필요합니다. 로컬 이전 작업에 쓰는 토큰에는 D1 쓰기와 R2 객체 읽기·쓰기 권한도 필요합니다. 토큰은 코드, JSON, Wrangler 설정 파일에 넣지 않습니다.

중요: D1에 기존 9건이 들어간 것을 확인한 뒤 `CLOUDFLARE_D1_DATABASE_ID`를 Pages 빌드 환경에 추가하세요. D1이 비어 있으면 안전을 위해 빌드가 실패합니다.

## 4. Deploy Hook과 Access

1. Pages Settings → Builds & deployments → Deploy Hooks에서 Production 브랜치 `main`용 Hook을 생성합니다.
2. Hook URL을 `DEPLOY_HOOK_URL` 암호화 변수로 저장합니다.
3. Cloudflare Access 애플리케이션이 `/admin`뿐 아니라 `/admin/*`도 포함하는지 확인합니다. API 경로 `/admin/api/*`도 같은 One-time PIN 정책 아래 있어야 합니다.
4. 앱은 `Cf-Access-Jwt-Assertion`과 `Cf-Access-Authenticated-User-Email` 헤더만 신뢰하며 별도 로그인 정보를 저장하지 않습니다.

## 5. 동작 확인

1. 휴대폰에서 `https://www.acedentshop.co.kr/admin`을 열고 One-time PIN으로 들어갑니다.
2. 전·후 사진, 차량과 작업 정보를 입력합니다. 작업 방식이나 탈거 여부 등은 입력한 내용만 저장되며 자동 추론하지 않습니다.
3. 미리보기에서 카드와 상세 구성을 확인하고 `사례 저장 및 배포`를 누릅니다.
4. 업로드 진행률 → D1 저장 → Cloudflare 빌드 상태 → 배포 완료 순서로 표시되는지 확인합니다.
5. 배포 후 생성된 상세 URL, `/works`, 해당 카테고리 페이지와 `sitemap.xml`에 새 사례가 포함됐는지 확인합니다.

## 로컬 확인 명령

```bash
npm run build
npx tsc --noEmit
npm run build:static
```

사진은 브라우저에서 EXIF 방향을 반영해 중앙 4:3으로 자른 뒤, 원본용 1600×1200 및 썸네일용 800×600 JPEG로 만듭니다. 두 파일 모두 200KB를 넘으면 업로드하지 않습니다.
