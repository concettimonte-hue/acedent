# 수리사례 등록 안내

이 폴더의 JSON 파일 1개가 수리사례 1건입니다. 이미지 파일을 `public/works`에 준비한 뒤 JSON 파일 하나를 추가하면 전체 갤러리, 카테고리 페이지, 상세 페이지와 사이트맵에 자동으로 반영됩니다.

## 등록 순서

1. 전·후 사진을 같은 각도로 촬영하고 같은 4:3 비율로 맞춥니다.
2. 상세용 사진은 1600×1200px, 파일당 200KB 이하로 미리 압축합니다.
3. 상세용 사진을 `public/works`에 넣습니다. 파일명은 영문 소문자와 하이픈만 사용하고 `-before.jpg`, `-after.jpg`로 끝내세요.
4. 첫 번째 `parts` 항목의 `after` 사진이 목록 대표 이미지가 됩니다. 800×600px 썸네일은 같은 이름에서 `-after`를 뺀 뒤 `public/works/thumbnails`에 저장합니다. 예: `bmw-door-after.jpg` → `thumbnails/bmw-door.jpg`.
5. 아래 템플릿을 복사해 이 폴더에 `YYYY-MM-DD-slug.json` 형식으로 저장합니다.
6. `category`는 아래 5개 중 하나만 선택합니다. 필터용 `part`는 필요한 만큼 복수 선택할 수 있으며, 목록 필터에서는 선택한 부위 중 하나라도 일치하면 표시됩니다. 실제 사진 묶음은 `parts`에 작업 부위별로 추가합니다.
7. `featured`를 `true`로 하면 메인 대표 사례 후보가 됩니다. 메인에는 `featuredOrder` 순서로 최대 8건만 표시됩니다.
8. `npm run build`와 `npx tsc --noEmit`이 통과하면 `main`에 반영합니다.

기존 8건은 원래 작업일을 확인할 수 없어 시스템 등록일인 `2026-09-07`로 이전했습니다. 실제 작업일을 확인한 경우 파일명과 `date`를 함께 고치면 됩니다.

## 허용 값

- 작업방식: `dent`, `panel-paint`, `partial-paint`, `replace-paint`, `polish`
- 작업부위: `범퍼`, `도어`, `휀더`, `후드`, `트렁크`, `사이드미러`, `필러`, `루프`, `휠`, `사이드스텝`
- 목록에 없는 부위는 관리자 화면에서 `기타(직접 입력)`를 선택한 뒤 실제 부위명을 입력합니다.
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
  "color": "화이트 계열",
  "parts": [
    {
      "label": "앞도어",
      "before": "/works/bmw-door-before.jpg",
      "after": "/works/bmw-door-after.jpg",
      "note": "문콕 눌림과 도장 손상"
    }
  ],
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

한 차량에서 여러 부위를 작업했다면 `parts` 배열에 같은 형식의 객체를 추가하세요. 상세 페이지에는 적힌 순서대로 부위 제목, 설명, 독립된 전후 비교 슬라이더가 나타납니다. 목록 대표 이미지는 항상 `parts[0].after`를 기준으로 선택되므로 가장 알아보기 쉬운 부위를 첫 번째에 두세요.
