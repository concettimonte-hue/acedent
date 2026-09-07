# ACEDENT

에이스덴트 랜딩페이지 저장소입니다.

## 배포 규칙

- 배포 대상은 Cloudflare Pages이며 Vercel이 아닙니다.
- 코드 변경은 GitHub `main` 브랜치에 push하면 자동 배포됩니다.
- Vercel 관련 설정 파일은 롤백 대비용으로 유지하되 갱신하지 않습니다.
- Vercel에 새로 배포하거나 설정을 추가하지 않습니다.

## 기술 규칙

- 새 라이브러리를 추가하기 전에 Cloudflare Pages 호환 여부를 확인합니다.
- Node 전용 API나 서버 전용 런타임 기능 등 Cloudflare Pages와 호환되지 않는 기능은 사용하지 않습니다.
- 이미지는 런타임 최적화 대신 사전 압축 방식을 사용합니다.

## 확인 명령어

```bash
npm run build
npx tsc --noEmit
```

작업 완료 전 두 명령이 모두 통과해야 합니다.

## 정적 배포 설정

- 정적 빌드: `npm run build:static`
- Cloudflare Pages 빌드 명령: `npm run build:static`
- 출력 디렉터리: `dist`

## 수리사례 갤러리 관리

- 사례 데이터는 `content/works`에서 JSON 파일 1건당 1개로 관리합니다.
- 이미지 파일을 `public/works`에 준비한 뒤 JSON 파일을 추가하면 전체 목록, 카테고리, 상세 페이지와 사이트맵에 자동 반영됩니다.
- 페이지 컴포넌트는 JSON을 직접 읽지 않고 `lib/works.ts`의 `getWorks()`, `getWorkBySlug()`, `getWorksByCategory()`만 사용합니다.
- 이미지 경로는 `lib/work-images.ts`에서 처리하므로 나중에 저장 위치를 R2로 바꿀 때 페이지 코드를 고칠 필요가 없습니다.
- 이미지는 런타임 최적화를 사용하지 않습니다. 가로 1600px 이하, 파일당 200KB 이하로 사전 압축하고 전·후 사진은 같은 각도로 촬영합니다.
- 상세 등록 방법과 복사용 JSON은 `content/works/README.md`를 확인합니다.
- Cloudflare 정적 빌드에서는 `vite.static.config.ts`가 사례 JSON을 읽어 갤러리·카테고리·상세 HTML의 canonical, 설명, OG 이미지와 Breadcrumb JSON-LD를 생성합니다.
