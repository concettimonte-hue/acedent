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
