# 수리사례 등록 안내

이 폴더의 JSON 파일 1개가 수리사례 1건입니다. 이미지 파일을 `public/works`에 준비한 뒤 JSON 파일 하나를 추가하면 전체 갤러리, 카테고리 페이지, 상세 페이지와 사이트맵에 자동으로 반영됩니다.

## 등록 순서

1. 전·후 사진을 같은 각도로 촬영하고 같은 4:3 비율로 맞춥니다.
2. 상세용 사진은 1600×1200px, 파일당 200KB 이하로 미리 압축합니다.
3. 상세용 사진을 `public/works`에 넣습니다. 파일명은 영문 소문자와 하이픈만 사용하고 `-before.jpg`, `-after.jpg`로 끝내세요.
4. 첫 번째 `parts` 항목의 `after` 사진이 목록 대표 이미지가 됩니다. 800×600px 썸네일은 같은 이름에서 `-after`를 뺀 뒤 `public/works/thumbnails`에 저장합니다. 예: `bmw-door-after.jpg` → `thumbnails/bmw-door.jpg`.
5. 아래 템플릿을 복사해 이 폴더에 `YYYY-MM-DD-slug.json` 형식으로 저장합니다.
6. 최상위 `part[0]`은 slug와 카드 배지에 쓰이는 주 부위입니다. 각 사진 묶음의 `parts[].part`에는 실제 작업 부위를 최대 3개까지 넣으며 `/works` 부위 필터는 이 값을 합산합니다. 범퍼·도어·휀더의 앞·뒤가 명확하면 `parts[].position`에 `front` 또는 `rear`를 선택적으로 넣습니다. 공개 필터는 계속 넓은 부위명만 사용하고, 구조화 위치는 신규 slug·PART 제목·이미지 ALT에만 반영됩니다. `parts[].category`에는 해당 사진 묶음에 실제로 적용한 작업 방식만 선택합니다. 기존 사례처럼 값이 없으면 대표 작업으로 추정하지 않습니다. `subParts`는 상세 표시와 검색에만 쓰이고 부위 필터에는 포함되지 않습니다. 보조 작업 `subCategories`와 보조 부위 `subParts`는 각각 최대 2개입니다.
   관리자에서 BEFORE 사진의 `손상 위치 표시`를 사용하면 원·화살표 좌표가 `parts[].beforeAnnotations`에 저장됩니다. 사진 원본은 바뀌지 않으며 BEFORE 사진을 교체하면 기존 표시는 자동으로 초기화됩니다.
7. `featured`를 `true`로 하면 메인 대표 사례 후보가 됩니다. 메인에는 `featuredOrder` 순서로 최대 8건만 표시됩니다.
8. `npm run build`와 `npx tsc --noEmit`이 통과하면 `main`에 반영합니다.

기존 사례는 보조 값이 없어도 빈 배열로 자동 처리됩니다. 실제 작업일을 확인한 경우 파일명과 `date`를 함께 고치면 됩니다.

## 허용 값

- 작업방식: `dent`, `panel-paint`, `partial-paint`, `replace-paint`, `polish`, `full-polish`, `coating`
  - `polish`: 국소 흠집·오염제거
  - `full-polish`: 차량 전체 광택
  - `coating`: 유리막 코팅
- 작업부위: `범퍼`, `도어`, `휀더`, `후드`, `트렁크`, `사이드미러`, `필러`, `루프`, `휠`, `사이드스텝`, `차량 전체`
- 목록에 없는 부위는 관리자 화면에서 `기타(직접 입력)`를 선택한 뒤 실제 부위명을 입력합니다.

기존 사례처럼 `subCategories`, `subParts`가 없는 JSON도 각각 빈 배열로 자동 처리됩니다. 직접 JSON을 추가할 때는 아래 형식을 사용하세요.

```json
{
  "category": "panel-paint",
  "subCategories": ["polish"],
  "part": ["범퍼"],
  "subParts": ["휀더"]
}
```
- 슬라이더: 대부분 `drag`, 촬영 각도가 다르면 `split`

## 복사용 템플릿

```json
{
  "slug": "bmw-5series-door-2026-09",
  "date": "2026-09-07",
  "title": "BMW 5시리즈 도어 판금도색",
  "category": "panel-paint",
  "subCategories": ["polish"],
  "part": ["도어"],
  "subParts": ["휀더"],
  "carMaker": "BMW",
  "carModel": "5시리즈",
  "color": "화이트 계열",
  "parts": [
    {
      "part": ["도어", "휀더"],
      "position": "front",
      "category": "panel-paint",
      "label": "앞도어 · 앞휀더 조수석 측면",
      "before": "/works/bmw-door-before.jpg",
      "beforeAnnotations": [
        { "type": "circle", "x": 0.55, "y": 0.38, "width": 0.2, "height": 0.18 }
      ],
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

한 차량에서 여러 부위를 작업했다면 `parts` 배열에 같은 형식의 객체를 추가하세요. 상세 페이지에는 적힌 순서대로 부위 제목, 실제 작업 방식, 설명, 독립된 전후 비교 슬라이더가 나타납니다. 카테고리 필터는 대표 작업, 명시된 PART 작업, 보조 작업의 합집합으로 계산합니다. 카테고리와 같은 작업이 지정된 PART가 있으면 그 PART의 AFTER 사진이 해당 카테고리 목록 대표 이미지가 되며, 없으면 첫 PART 사진을 사용합니다.

`position`은 앞·뒤가 명확한 범퍼·도어·휀더에만 사용합니다. 예를 들어 `part: ["범퍼", "휀더"]`, `position: "front"`는 `앞범퍼 · 앞휀더`로 표시됩니다. 한 PART 안에 앞·뒤가 섞이면 위치를 억지로 하나 고르지 말고 PART를 둘로 나누세요. 기존 사례의 문구에서 위치를 자동 추론하거나 기존 URL을 바꾸지 않습니다.

차량 전체 광택은 개별 패널을 모두 부위로 나열하지 말고 `차량 전체`를 선택한 PART에 `full-polish`를 지정하세요. 판금도색과 전체 광택을 함께 작업한 사례는 판금도색 PART와 `차량 전체` 광택 PART를 분리하면 각 카테고리에서 해당 PART 사진이 대표로 표시됩니다. 유리막 코팅은 실제 시공한 경우에만 `coating`을 사용하세요.

## 추가 사진 갤러리

관리자 화면에서는 각 PART 아래에 `PART 추가 사진`, 모든 PART 아래에 `사례 전체 추가 사진`을 넣을 수 있습니다. 전·후 비교 사진은 기존처럼 4:3으로 유지되며, 추가 사진은 세로·가로 원본 비율을 보존한 채 긴 변 1600px 이하·200KB 이하로 처리됩니다. 목록용 썸네일은 800×600으로 별도 생성됩니다.

- PART 추가 사진: 해당 손상 부위의 다른 각도, 작업 과정, 마감 상태
- 사례 전체 추가 사진: 차량 전경, 입고·출고 상태 등 특정 PART에 속하지 않는 사진
- 각 영역 최대 6장, 사례 전체 최대 12장
- 대표 이미지, slug, 필터, OG 이미지는 추가 사진 때문에 바뀌지 않음
- 공개 화면은 PC 콜라주, 모바일 수동 스와이프로 표시되며 자동 재생하지 않음

JSON으로 직접 등록할 때는 PART 객체 또는 사례 최상위에 아래 형식의 `gallery`를 선택적으로 추가합니다.

```json
"gallery": [
  {
    "src": "/works/example-detail.jpg",
    "thumbnail": "/works/thumbnails/example-detail.jpg",
    "caption": "도장면 정리 후 마감 상태",
    "width": 1600,
    "height": 1067
  }
]
```
