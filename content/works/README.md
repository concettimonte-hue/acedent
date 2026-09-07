# 수리사례 등록 안내

이 폴더의 JSON 파일 1개가 수리사례 1건입니다. 이미지 파일을 `public/works`에 준비한 뒤 JSON 파일 하나를 추가하면 전체 갤러리, 카테고리 페이지, 상세 페이지와 사이트맵에 자동으로 반영됩니다.

## 등록 순서

1. 전·후 사진을 같은 각도로 촬영합니다.
2. 사진은 가로 1600px 이하, 파일당 200KB 이하로 미리 압축합니다.
3. 원본 사진을 `public/works`에 넣습니다. 파일명은 영문 소문자와 하이픈만 사용하면 관리하기 쉽습니다.
4. 목록용 작은 사진이 있으면 `public/works/thumbnails`에 넣고 `thumbnail`에 경로를 적습니다. 생략하면 `after` 사진을 목록에도 사용합니다.
5. 아래 템플릿을 복사해 이 폴더에 `YYYY-MM-DD-slug.json` 형식으로 저장합니다.
6. `category`는 아래 5개 중 하나만, `part`는 허용된 부위 중 필요한 만큼 선택합니다.
7. `featured`를 `true`로 하면 메인 대표 사례 후보가 됩니다. 메인에는 `featuredOrder` 순서로 최대 8건만 표시됩니다.
8. `npm run build`와 `npx tsc --noEmit`이 통과하면 `main`에 반영합니다.

기존 8건은 원래 작업일을 확인할 수 없어 시스템 등록일인 `2026-09-07`로 이전했습니다. 실제 작업일을 확인한 경우 파일명과 `date`를 함께 고치면 됩니다.

## 허용 값

- 작업방식: `dent`, `panel-paint`, `partial-paint`, `replace-paint`, `polish`
- 작업부위: `범퍼`, `도어`, `휀더`, `후드`, `트렁크`, `사이드미러`, `필러`, `루프`, `휠`
- 슬라이더: 대부분 `drag`, 촬영 각도가 다르면 `split`

## 복사용 템플릿

```json
{
  "slug": "bmw-5series-door-2026-09",
  "date": "2026-09-07",
  "title": "BMW 5시리즈 도어 판금도색",
  "category": "panel-paint",
  "part": ["도어"],
  "carMaker": "BMW",
  "carModel": "5시리즈",
  "before": "/works/bmw-door-before.jpg",
  "after": "/works/bmw-door-after.jpg",
  "thumbnail": "/works/thumbnails/bmw-door-after.jpg",
  "summary": "문콕 눌림, 도어 1패널 판금 후 도색",
  "body": "입고 상태와 손상 범위를 확인했습니다. 필요한 범위만 판금하고 차량 색상에 맞춰 도장했습니다. 작업 후 면과 색상을 확인해 마무리했습니다.",
  "blogUrl": "https://blog.naver.com/ace_dent_shop/게시물번호",
  "featured": false,
  "featuredOrder": 9,
  "days": "2일",
  "sliderType": "drag"
}
```

`slug`는 상세 주소가 되므로 한번 공개한 뒤에는 바꾸지 않는 것이 좋습니다. `blogUrl`이 없으면 빈 문자열로 두거나 항목을 생략해도 됩니다.
