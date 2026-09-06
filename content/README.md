# 콘텐츠 수정 안내서 (비개발자용)

이 폴더의 파일만 고치면 사이트 내용이 바뀝니다. 코드는 건드리지 않아도 됩니다.

## 파일별 역할

| 파일           | 사이트에서 바뀌는 곳                                 |
| -------------- | ---------------------------------------------------- |
| cases.json     | 작업사례 8개 (Before/After, 차종, 기간, 블로그 링크) |
| polish.json    | 페인트케어 5개 항목과 문자 상담 문구                  |
| trust.json     | 히어로 아래 숫자 3칸 (9년 / 1,000대+ / 500건+)       |
| reviews.json   | 고객 후기 섹션                                       |
| faq.json       | 자주 묻는 질문                                       |
| insurance.json | 보험 vs 현금 안내 섹션                               |
| process.json   | 진행 과정 4단계                                      |
| naver.json     | 블로그·플레이스·후기·예약·톡톡 링크와 하단 카드 문구 |

## 작업사례 추가하는 방법

1. 사진 2장 준비 (같은 각도, 4:3 비율, 가로 1600px 권장, 장당 500KB 이하)
2. 파일명을 영문으로: 예) grille-before.jpg / grille-after.jpg
3. public/cases/ 폴더에 넣기
4. cases.json의 `items` 안에서 맨 아래 항목 하나를 복사해 붙이고 값만 수정

   ```json
   {
     "id": "grille",
     "order": 9,
     "title": "그릴 판금도장",
     "car": "아우디 A6",
     "part": "그릴 · 판금도장",
     "days": "2일",
     "summary": "한 줄 설명",
     "beforeImg": "/cases/grille-before.jpg",
     "afterImg": "/cases/grille-after.jpg",
     "blogUrl": "https://blog.naver.com/ace_dent_shop/글번호",
     "sliderType": "drag"
   }
   ```

- id : 영문 소문자, 다른 항목과 겹치지 않게
- order : 표시 순서 (숫자가 작을수록 먼저)
- days : "당일", "1일", "2일" 처럼 자유롭게
- sliderType : "drag"(드래그 슬라이더) 또는 "split"(좌우 나란히)
  Before/After 배경이나 각도가 많이 다르면 "split" 사용

## 후기 추가하는 방법

reviews.json 의 reviews 배열에 항목 추가.
highlight 를 true 로 하면 노출, false 면 숨겨집니다.
사이트에는 highlight: true 인 항목만 표시됩니다.

## 숫자 바꾸는 방법

trust.json 에서 value 값만 수정.
countUp: true 인 항목은 화면에 보일 때 0부터 올라가는 애니메이션이 적용됩니다.
누적 대수가 늘면 "1000" 을 "1200" 으로 바꾸면 됩니다.

## 주의사항

- 파일 저장 시 인코딩은 반드시 UTF-8
- 쉼표(,)와 중괄호({}) 위치를 지켜야 합니다. 마지막 항목 뒤에는 쉼표를 붙이지 않습니다
- 수정 후 GitHub에 올리면 1~2분 뒤 사이트에 자동 반영됩니다
- 잘못 고쳐도 이전 버전으로 되돌릴 수 있습니다
