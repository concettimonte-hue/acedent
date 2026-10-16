# 차량 브랜드 로고 출처 기록

검토/취득일: 2026-10-16 KST. SITE-011 / DEC-040 및 DEC-041 로컬 구현용.

현재 연결은 아래 후속 심볼 교체 기록을, 표시색은 DEC-042 기록을 우선합니다. 최초 19개 기록과 현대/렉서스 이전 파일은 복귀용으로 보존합니다. 공개 크레딧: [/brands/credits.html](/brands/credits.html).

## 사용 범위와 주의

- 차량 제조사 식별을 보조하는 장식 이미지입니다. 기존 제조사/차종 원문은 항상 표시합니다.
- 관리자 선택 결과/프리뷰, 수리사례 목록 카드와 상세 상단에만 사용합니다. 홈/추천 카드에는 사용하지 않습니다.
- Wikimedia Commons 파일 페이지의 저작권 분류(PD-textlogo/PD-shape)를 기록했습니다. 이는 상표권 허락이나 공식 제휴·인증, 모든 지역에서의 사용 적법성 보장이 아닙니다. 각 제조사의 상표권은 소유자에게 있습니다.
- 외부 URL을 런타임에서 호출하지 않습니다. 기본20×20px, 현대/렉서스/제네시스/쉐보레/포드/랜드로버는32×20px 영역에 object-fit:contain으로 표시합니다. 심볼의 형상·비율을 보존하며 워드마크 분리와 CSS 표시색 변경은 아래 후속 기록에 명시합니다.
- DEC-042에서 CSS의 밝은 받침과 패딩을 제거했습니다. 아래 파일별 '원본 색상 + 밝은 CSS 받침'은 DEC-040/041 당시 이력이며 현재 표시색은 아래 규칙을 따릅니다. 원본 파일은 변경하지 않았습니다.
- XML 선언/주석/메타데이터/편집기 namedview 등 비렌더링 정보만 제거했습니다. 혼다의 외부 DTD 선언도 제거했습니다. 외부 DTD 로딩은 금지한 상태로 최종 XML 파싱을 확인했습니다.
- script, foreignObject, 외부 이미지/참조, 이벤트 핸들러, 외부 CSS URL/임포트 없는 정적 SVG만 사용합니다. 내부 gradient url(#...)는 허용합니다.
- 아래 SHA256은 **다운로드한 원본 바이트** 기준입니다. 가공 후 로컬 파일과 다를 수 있습니다. 출처 페이지에는 해당 파일의 저자·원출처·변경 이력이 있으므로 교체 시 다시 확인합니다.

## 취득 파일 19개

### bmw.svg

- 로컬: `/brands/bmw.svg`
- 파일 페이지: [BMW_logo_(gray).svg](https://commons.wikimedia.org/wiki/File:BMW_logo_(gray).svg)
- [다운로드한 SVG 원본](https://upload.wikimedia.org/wikipedia/commons/f/f4/BMW_logo_%28gray%29.svg)
- 파일 페이지 저작권 분류: PD-textlogo
- 원본 크기: 6044 bytes
- 원본 SHA256: `d797f1774d210ba5d2854dfca6927ca95e8fa3c464efb1800bd2f4b90b91413a`
- 처리: Removed XML declaration/comments and non-rendering editor metadata when present; geometry, colors, viewBox, and aspect ratio unchanged.
- 표시: 원본 색상, 추가 받침 없음

### mercedes-benz.svg

- 로컬: `/brands/mercedes-benz.svg`
- 파일 페이지: [Mercedes-Benz_Star_2022.svg](https://commons.wikimedia.org/wiki/File:Mercedes-Benz_Star_2022.svg)
- [다운로드한 SVG 원본](https://upload.wikimedia.org/wikipedia/commons/3/32/Mercedes-Benz_Star_2022.svg)
- 파일 페이지 저작권 분류: PD-textlogo
- 원본 크기: 11092 bytes
- 원본 SHA256: `1c35cb516ffff6dc694730726a19241b0af8ad5c5d4a5e8e449954601b9d46c9`
- 처리: Removed XML declaration/comments and non-rendering editor metadata when present; geometry, colors, viewBox, and aspect ratio unchanged.
- 표시: 원본 색상, 추가 받침 없음

### audi.svg

- 로컬: `/brands/audi.svg`
- 파일 페이지: [Audi-Logo_2016.svg](https://commons.wikimedia.org/wiki/File:Audi-Logo_2016.svg)
- [다운로드한 SVG 원본](https://upload.wikimedia.org/wikipedia/commons/9/92/Audi-Logo_2016.svg)
- 파일 페이지 저작권 분류: PD-textlogo
- 원본 크기: 4788 bytes
- 원본 SHA256: `0277502116b0ef3486e9b5002bbf45dfcabf7246614a84744ac3ff25c3e77d38`
- 처리: Removed XML declaration/comments and non-rendering editor metadata when present; geometry, colors, viewBox, and aspect ratio unchanged.
- 표시: 원본 색상 + 밝은 CSS 받침

### volkswagen.svg

- 로컬: `/brands/volkswagen.svg`
- 파일 페이지: [Volkswagen_logo_2019.svg](https://commons.wikimedia.org/wiki/File:Volkswagen_logo_2019.svg)
- [다운로드한 SVG 원본](https://upload.wikimedia.org/wikipedia/commons/6/6d/Volkswagen_logo_2019.svg)
- 파일 페이지 저작권 분류: PD-textlogo
- 원본 크기: 1073 bytes
- 원본 SHA256: `5e9fb889f1ccc7776dd9305b235be41a256265d3fef19f26945ea414eb65edf5`
- 처리: Removed XML declaration/comments and non-rendering editor metadata when present; geometry, colors, viewBox, and aspect ratio unchanged.
- 표시: 원본 색상 + 밝은 CSS 받침

### mini.svg

- 로컬: `/brands/mini.svg`
- 파일 페이지: [MINI_logo.svg](https://commons.wikimedia.org/wiki/File:MINI_logo.svg)
- [다운로드한 SVG 원본](https://upload.wikimedia.org/wikipedia/commons/e/e9/MINI_logo.svg)
- 파일 페이지 저작권 분류: PD-textlogo
- 원본 크기: 3038 bytes
- 원본 SHA256: `84e781326fba9c98bdaada156869cfb193da1e1a4fdba7f4fd05c27bb87709a0`
- 처리: Removed non-rendering XML declaration/comments/metadata/editor-view only; geometry, colours and viewBox unchanged.
- 표시: 원본 색상 + 밝은 CSS 받침

### land-rover.svg

- 로컬: `/brands/land-rover.svg`
- 파일 페이지: [Land_Rover_2023.svg](https://commons.wikimedia.org/wiki/File:Land_Rover_2023.svg)
- [다운로드한 SVG 원본](https://upload.wikimedia.org/wikipedia/commons/c/c2/Land_Rover_2023.svg)
- 파일 페이지 저작권 분류: PD-shape
- 원본 크기: 4025 bytes
- 원본 SHA256: `6b7b49cfadac56a16a7ba139aff897fba045b9f8e2cb7078b7b353e38296e20f`
- 처리: Removed non-rendering XML declaration/comments/metadata/editor-view only; geometry, colours and viewBox unchanged.
- 표시: 원본 색상 + 밝은 CSS 받침

### volvo.svg

- 로컬: `/brands/volvo.svg`
- 파일 페이지: [Volvo-Iron-Mark-Black.svg](https://commons.wikimedia.org/wiki/File:Volvo-Iron-Mark-Black.svg)
- [다운로드한 SVG 원본](https://upload.wikimedia.org/wikipedia/commons/2/29/Volvo-Iron-Mark-Black.svg)
- 파일 페이지 저작권 분류: PD-textlogo
- 원본 크기: 1497 bytes
- 원본 SHA256: `400e53eb932394e2d70951ccb3d795642bc5887533258ada1304419e9aa5e6b2`
- 처리: Removed non-rendering XML declaration/comments/metadata/editor-view only; geometry, colours and viewBox unchanged.
- 표시: 원본 색상 + 밝은 CSS 받침

### kia.svg

- 로컬: `/brands/kia.svg`
- 파일 페이지: [KIA_logo3.svg](https://commons.wikimedia.org/wiki/File:KIA_logo3.svg)
- [다운로드한 SVG 원본](https://upload.wikimedia.org/wikipedia/commons/b/b6/KIA_logo3.svg)
- 파일 페이지 저작권 분류: PD-textlogo
- 원본 크기: 896 bytes
- 원본 SHA256: `af600886a46a9aa3a930fa7261163e090663b80f4a9c4237f9f64e4707b49515`
- 처리: Removed non-rendering XML declaration/comments/metadata/editor-view only; geometry, colours and viewBox unchanged.
- 표시: 원본 색상 + 밝은 CSS 받침

### kgm.svg

- 로컬: `/brands/kgm.svg`
- 파일 페이지: [KG_Mobility_brand_logo.svg](https://commons.wikimedia.org/wiki/File:KG_Mobility_brand_logo.svg)
- [다운로드한 SVG 원본](https://upload.wikimedia.org/wikipedia/commons/0/04/KG_Mobility_brand_logo.svg)
- 파일 페이지 저작권 분류: PD-textlogo
- 원본 크기: 3233 bytes
- 원본 SHA256: `1440c169d4856fbbfd0082405a7fb2a699130ca520be6fcdefd2e46176aa6351`
- 처리: Removed non-rendering XML declaration/comments/metadata/editor-view only; geometry, colours and viewBox unchanged.
- 표시: 원본 색상 + 밝은 CSS 받침

### toyota.svg

- 로컬: `/brands/toyota.svg`
- 파일 페이지: [Toyota_Symbol.svg](https://commons.wikimedia.org/wiki/File:Toyota_Symbol.svg)
- [다운로드한 SVG 원본](https://upload.wikimedia.org/wikipedia/commons/e/ed/Toyota_Symbol.svg)
- 파일 페이지 저작권 분류: PD-textlogo
- 원본 크기: 891 bytes
- 원본 SHA256: `0caeab22755b4ffe27adf39b595f8c8c8a16b687e600bae63666392b55afb0c4`
- 처리: Removed non-rendering XML declaration/comments/metadata/editor-view only; geometry, colours and viewBox unchanged.
- 표시: 원본 색상, 추가 받침 없음

### byd.svg

- 로컬: `/brands/byd.svg`
- 파일 페이지: [BYD_Auto_2022_logo.svg](https://commons.wikimedia.org/wiki/File:BYD_Auto_2022_logo.svg)
- [다운로드한 SVG 원본](https://upload.wikimedia.org/wikipedia/commons/e/e2/BYD_Auto_2022_logo.svg)
- 파일 페이지 저작권 분류: PD-textlogo
- 원본 크기: 1714 bytes
- 원본 SHA256: `4b8609a2c81991b6a3c4ef1540a50b19aa10d167b23941b916af316dd652ad89`
- 처리: Removed non-rendering XML declaration/comments/metadata/editor-view only; geometry, colours and viewBox unchanged.
- 표시: 원본 색상, 추가 받침 없음

### hyundai.svg

- 로컬: `/brands/hyundai.svg`
- 파일 페이지: [Hyundai_Motor_Company_logo.svg](https://commons.wikimedia.org/wiki/File:Hyundai_Motor_Company_logo.svg)
- [다운로드한 SVG 원본](https://upload.wikimedia.org/wikipedia/commons/4/44/Hyundai_Motor_Company_logo.svg)
- 파일 페이지 저작권 분류: PD-textlogo
- 원본 크기: 4693 bytes
- 원본 SHA256: `03cda6235efc7bdac40c8c3eb34824d007fc69143e0b130dd45ec07d846cdfa0`
- 처리: Removed non-rendering XML declaration/comments/metadata/editor-view only; geometry, colours and viewBox unchanged.
- 표시: 원본 색상 + 밝은 CSS 받침
- 주의: 현대자동차 심볼+워드마크 원본 전체를 사용합니다. Hyundai Group 삼각형 심볼과 혼동하지 않습니다.

### lexus.svg

- 로컬: `/brands/lexus.svg`
- 파일 페이지: [Lexus.svg](https://commons.wikimedia.org/wiki/File:Lexus.svg)
- [다운로드한 SVG 원본](https://upload.wikimedia.org/wikipedia/commons/7/75/Lexus.svg)
- 파일 페이지 저작권 분류: PD-textlogo
- 원본 크기: 3472 bytes
- 원본 SHA256: `1f622365774aed0e7047ff3a97b9e57481e486fcc72c29f2c400fd3af1d4124a`
- 처리: Removed non-rendering XML declaration/comments/metadata/editor-view only; geometry, colours and viewBox unchanged.
- 표시: 원본 색상 + 밝은 CSS 받침
- 주의: 심볼+워드마크 전체 비율을 유지합니다. 20px에서는 텍스트가 주 식별 정보입니다.

### honda.svg

- 로컬: `/brands/honda.svg`
- 파일 페이지: [Honda.svg](https://commons.wikimedia.org/wiki/File:Honda.svg)
- [다운로드한 SVG 원본](https://upload.wikimedia.org/wikipedia/commons/3/38/Honda.svg)
- 파일 페이지 저작권 분류: PD-textlogo
- 원본 크기: 6779 bytes
- 원본 SHA256: `688e24e95ac68717fabcceb2ab4a4b0d979d45eee79e035fa840eb3a202c12d0`
- 처리: Removed non-rendering XML declaration/comments/metadata/editor-view/external DTD declaration only; geometry, colours and viewBox unchanged.
- 표시: 원본 색상, 추가 받침 없음
- 주의: 자동차 H 마크입니다. 오토바이 날개 마크와 구별합니다.

### ford.svg

- 로컬: `/brands/ford.svg`
- 파일 페이지: [Ford_logo_flat.svg](https://commons.wikimedia.org/wiki/File:Ford_logo_flat.svg)
- [다운로드한 SVG 원본](https://upload.wikimedia.org/wikipedia/commons/3/3e/Ford_logo_flat.svg)
- 파일 페이지 저작권 분류: PD-textlogo
- 원본 크기: 10048 bytes
- 원본 SHA256: `b7447830af9bf4ea2de945cb172f92f0e77aaf508304b4f1339c9572f352ae79`
- 처리: Removed non-rendering XML declaration/comments/metadata/editor-view only; geometry, colours and viewBox unchanged.
- 표시: 원본 색상, 추가 받침 없음

### chevrolet.svg

- 로컬: `/brands/chevrolet.svg`
- 파일 페이지: [Chevrolet_simple_logo.svg](https://commons.wikimedia.org/wiki/File:Chevrolet_simple_logo.svg)
- [다운로드한 SVG 원본](https://upload.wikimedia.org/wikipedia/commons/5/55/Chevrolet_simple_logo.svg)
- 파일 페이지 저작권 분류: PD-textlogo
- 원본 크기: 5728 bytes
- 원본 SHA256: `0f5441714b687f3627a81289a252bee9de1c185aeb7675247b1a01a62e533d60`
- 처리: Removed non-rendering XML declaration/comments/metadata/editor-view only; geometry, colours and viewBox unchanged.
- 표시: 원본 색상 + 밝은 CSS 받침
- 주의: 파일 페이지의 원출처는 Logopedia이며 원저자 표기는 Unknown입니다. 제조사 공식 다운로드로 표현하지 않습니다.

### lincoln.svg

- 로컬: `/brands/lincoln.svg`
- 파일 페이지: [Lincoln_logo.svg](https://commons.wikimedia.org/wiki/File:Lincoln_logo.svg)
- [다운로드한 SVG 원본](https://upload.wikimedia.org/wikipedia/commons/e/e0/Lincoln_logo.svg)
- 파일 페이지 저작권 분류: PD-textlogo
- 원본 크기: 7269 bytes
- 원본 SHA256: `6fdfa882edbb379231d428dac589c5ccfc838fd6b4373ffbb27804555b08d7b4`
- 처리: Removed non-rendering XML declaration/comments/metadata/editor-view only; geometry, colours and viewBox unchanged.
- 표시: 원본 색상 + 밝은 CSS 받침
- 주의: 심볼+워드마크 전체 비율을 유지합니다. 20px에서는 텍스트가 주 식별 정보입니다.

### jeep.svg

- 로컬: `/brands/jeep.svg`
- 파일 페이지: [Jeep.svg](https://commons.wikimedia.org/wiki/File:Jeep.svg)
- [다운로드한 SVG 원본](https://upload.wikimedia.org/wikipedia/commons/7/7e/Jeep.svg)
- 파일 페이지 저작권 분류: PD-textlogo
- 원본 크기: 2367 bytes
- 원본 SHA256: `e7d6f84050b7890c44c1ef7719b5b32f5ddc86e260af06768f711989d7561aeb`
- 처리: Removed non-rendering XML declaration/comments/metadata/editor-view/external DTD declaration only; geometry, colours and viewBox unchanged.
- 표시: 원본 색상 + 밝은 CSS 받침

### renault.svg

- 로컬: `/brands/renault.svg`
- 파일 페이지: [Renault_2021.svg](https://commons.wikimedia.org/wiki/File:Renault_2021.svg)
- [다운로드한 SVG 원본](https://upload.wikimedia.org/wikipedia/commons/a/a5/Renault_2021.svg)
- 파일 페이지 저작권 분류: PD-textlogo
- 원본 크기: 975 bytes
- 원본 SHA256: `b0720bcc3d896ca6a55fb2d6c24ecea6c557c100ed4fd3a9acbff374c6dcb990`
- 처리: Removed non-rendering XML declaration/comments/metadata/editor-view only; geometry, colours and viewBox unchanged.
- 표시: 원본 색상 + 밝은 CSS 받침
- 주의: 2021 마크 파일의 이번 다운로드 SHA256을 고정합니다. 파일 페이지는 후속 수정될 수 있습니다.

## 최초 DEC-040에서 연결하지 않았던 브랜드 (이력)

- 제네시스: 이번 범위에서 충분한 출처/조건을 갖춘 적절한 파일 미확보.
- 테슬라: 검토 후보의 저작권 조건 불확실.
- 포르쉐: 확보 가능한 워드마크는 약 15:1로 20px 표시 부적합; 대체 엠블럼 근거 부족.
- 위 3개와 미등록 브랜드는 텍스트만 표시합니다. 이미지 자리나 깨진 아이콘을 만들지 않습니다. 추후 교체·추가에는 별도 검토가 필요합니다.

## DEC-041 심볼 교체 / 추가

### DEC-042 현재 표시색 (2026-10-16)

- 원본 SVG/PNG 22개 불변. 흰 CSS 받침/패딩 제거. 기존20×20 또는32×20/contain/텍스트/입력정렬 유지.
- 후속 사용자 요청으로 가로형 타원 로고인 포드·랜드로버만 기존 width32 경로를 재사용해 폭20→32px 조정. 높이20px/contain 원비율은 유지하며 포드는원색/랜드로버는밝은회색으로 표시합니다.
- 회색 단색13개: 현대, 폭스바겐, 기아, 제네시스, KGM, 르노코리아, 랜드로버, 링컨, 미니, 볼보, 아우디, 지프, 테슬라. 투명한 빈 공간을 가진 도형만 명시적으로 분류해 `brightness(0) invert(0.82)`로 밝은 회색 표시. 현대/폭스바겐의 파랑은 후속 사용자 요청에 따른 명시적 예외이며 자동 색상 추측은 하지 않습니다.
- 은색 음영2개: 벤츠, 렉서스. 평탄화하지 않고 `grayscale(1) brightness(1.1)`로 명암을 보존한 밝은 회색 표시.
- 노랑 표시1개: 쉐보레. 후속 사용자 요청에 따라 보타이만 분리하고 CSS `brightness(0) saturate(100%) invert(80%) sepia(80%) saturate(800%)`로 노랑 표시. 도형 자체 색상은 변경하지 않음.
- 원색 유지6개: BMW(파랑/흰색/회색), BYD(빨강), 토요타(빨강), 포르쉐(다색), 포드(파랑/흰색), 혼다(빨강). 단일색이어도 브랜드색이면 필터를 적용하지 않음. 전체 반전 없음.
- 이는 CSS 표시 효과이며 위 자산의 원권리/라이선스 주의를 해소하는 근거가 아닙니다. 파일별 원본/이전 처리/출처는 보존합니다. 원본 파일색과 화면 표시색을 구분합니다.
- 신규 파생 자산2개: `chevrolet-emblem.svg`는 기존 `chevrolet.svg`에서 `Chevrolet_wordmark_(Gray)` 그룹만 제외하고 viewBox `19 25 701 226`으로 조정(보타이 원도형/색 유지), `lincoln-emblem.svg`는 기존 `lincoln.svg`에서 하단 워드마크 `g902`만 제외하고 viewBox `171 -1 41 91`로 조정(별형 path26 원형 유지). 기존 원본22개는 변경하지 않으며 두 자산의 출처·원본해시는 위 기존 chevrolet.svg/lincoln.svg 기록을 따릅니다. 공개 크레딧에도 실제 분리를 명시했습니다.

현재22브랜드 모두 연결합니다(SVG21개+PNG1개). 이전 현대/렉서스/쉐보레/링컨SVG4개는 비활성 복귀 자산으로 보존합니다.

- 사용자 로컬 구현 요청에 따라 현대 H·렉서스 L 교체 및 제네시스 날개·테슬라 T를 추가했습니다. 사용자 판단을 원권리자의 허락으로 간주하지 않습니다.
- 이전 `hyundai.svg`, `lexus.svg`는 변경하지 않고 보존합니다. 복귀 시 사전의 src/source/usageNote/backdrop만 이전 기록으로 되돌립니다.
- 현대 파일은 CC BY-SA 4.0을 선택하며 해당 SVG만 동일 조건으로 제공합니다. 작성자·원본·변경내용·라이선스 링크는 SVG 주석과 공개 크레딧에 함께 표시합니다. 사이트 전체에 CC 라이선스를 적용하지 않습니다.
- 렉서스/제네시스의 PD-USonly 및 원산국 권리주의, 제네시스의 better-source-request, 테슬라 관련 T형상의 저작권 주장 주의를 공개 크레딧에도 남겼습니다. 흰색 변형은 권리 문제의 해소 근거가 아닙니다.

### porsche-crest.png (후속 사용자 추가)

- 로컬: `/brands/porsche-crest.png` (64×80 RGBA, 6882 bytes; 화면20×20px 내 원비율)
- 파일 페이지: https://commons.wikimedia.org/wiki/File:Porsche-seeklogo.svg
- 다운로드 원본: https://upload.wikimedia.org/wikipedia/commons/9/98/Porsche-seeklogo.svg
- 업로더/작성자: Kai xzzrs; 원출처 표기 Own work
- 라이선스 표기: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). 업로더 권한/원브랜드 사용 허가 미확정; 원권리 및 상표 주의 유지. PD 자산으로 분류하지 않습니다.
- 원본: 1608×2000, 401772 bytes, SHA256 `426f9bf4c7b8b72b24cd98e33d66bba4102f97f5d4668d262169e8038a013ab4`
- 처리: 비표시 XML/주석/메타데이터/DTD만 제거(있는 경우), 안전성 검사 후 기존 번들 sharp0.35.5로 `resize({width:80,height:80,fit:'inside',withoutEnlargement:true}).png({compressionLevel:9})`. 형상 재설계/크롭/색 변경 없음. 큰 SVG를 고객에게 전송하지 않습니다. 새 패키지 추가 없음.
- 원본 바이트 복원용 gzip/base64는 로컬 무시 경로 `outputs/vehicle-brands/porsche-original.svg.gz.base64`에 보존합니다. 원본 다운로드 URL과 해시도 함께 남깁니다.

### hyundai-symbol.svg

- 로컬: `/brands/hyundai-symbol.svg`
- 파일 페이지: https://commons.wikimedia.org/wiki/File:Hyundai_symbol.svg
- 다운로드 원본: https://upload.wikimedia.org/wikipedia/commons/b/b7/Hyundai_symbol.svg
- 작성자: TucsonMager79
- 출처 표시: CC BY-SA 4.0
- 원본 크기: 2406 bytes
- 원본 SHA256: `510ffbf00f235e45d820e38558b63a1326ca546e4951d0564419b9f1253cb49a`
- 처리: XML 선언/기존 주석/비표시 메타데이터/편집기 namedview 제거(있는 경우). 현대는 외부 DTD 제거 및 CC BY-SA 출처 주석 추가. 도형·색상·그라데이션·viewBox 보존. 실행 코드/외부 참조 없음.

### lexus-emblem.svg

- 심볼 분리: 지정 원본은 타원형L 아래 LEXUS 워드마크도 포함했습니다. 원본 layer1의 앞7개 워드마크 요소(path3036/path4156/g3286/path3007/path3124/path3136/path3075)만 제거했습니다. 나머지 엠블럼 도형은 원형·색상·그라데이션 그대로 유지하고 viewBox를 `99 0 291 212`로 조정했습니다. 원본은 `outputs/vehicle-brands/lexus-division-original.svg`에도 보존합니다. 아래 공통 메타데이터 정리 외에 이 분리 작업이 추가 적용됐습니다.

- 로컬: `/brands/lexus-emblem.svg`
- 파일 페이지: https://en.wikipedia.org/wiki/File:Lexus_division_emblem.svg
- 다운로드 원본: https://upload.wikimedia.org/wikipedia/en/d/d1/Lexus_division_emblem.svg
- 작성자: Lexus
- 출처 표시: PD-logo / PD-USonly; source-country caution
- 원본 크기: 80211 bytes
- 원본 SHA256: `6414ac5446b6d5e6609f98a91adf7deefdeebc5e8b826a1dae32bad41449364a`
- 처리: XML 선언/기존 주석/비표시 메타데이터/편집기 namedview 제거(있는 경우). 현대는 외부 DTD 제거 및 CC BY-SA 출처 주석 추가. 도형·색상·그라데이션·viewBox 보존. 실행 코드/외부 참조 없음.

### genesis-emblem.svg

- 후속 사용자 요청으로 별도 하단 GENESIS 워드마크(원본 path 순서10~16,0기준)만 제외하고 앞10개 날개/중앙엠블럼 도형을 그대로 남겼습니다. 중앙 GENESIS 글자는 보존했습니다. viewBox는 `14 56 932 200`으로 조정했으며 도형 좌표·색상·비율은 불변입니다. 원본은 `outputs/vehicle-brands/genesis-division-original.svg`에 보존합니다. 아래 공통 메타데이터 정리 외에 이 분리 작업이 추가 적용됐습니다.

- 로컬: `/brands/genesis-emblem.svg`
- 파일 페이지: https://en.wikipedia.org/wiki/File:Genesis_division_emblem.svg
- 다운로드 원본: https://upload.wikimedia.org/wikipedia/en/8/83/Genesis_division_emblem.svg
- 작성자: Blackspace
- 출처 표시: PD-logo / PD-USonly; source-country and better-source caution
- 원본 크기: 5779 bytes
- 원본 SHA256: `b19f9fa03105f96786572476933dd0ddef8538608c2455a895da6dc52b6d9ca8`
- 처리: XML 선언/기존 주석/비표시 메타데이터/편집기 namedview 제거(있는 경우). 현대는 외부 DTD 제거 및 CC BY-SA 출처 주석 추가. 도형·색상·그라데이션·viewBox 보존. 실행 코드/외부 참조 없음.

### tesla-symbol.svg

- 로컬: `/brands/tesla-symbol.svg`
- 파일 페이지: https://commons.wikimedia.org/wiki/File:Tesla_T_symbol_-_white.svg
- 다운로드 원본: https://upload.wikimedia.org/wikipedia/commons/d/d9/Tesla_T_symbol_-_white.svg
- 작성자: Tesla Inc.
- 출처 표시: PD-textlogo; trademark and related copyright warning retained
- 원본 크기: 1715 bytes
- 원본 SHA256: `e34f52a9c0bc3f69acb7becab428d94811748167ba25215f6af431b9dcc70faf`
- 처리: XML 선언/기존 주석/비표시 메타데이터/편집기 namedview 제거(있는 경우). 현대는 외부 DTD 제거 및 CC BY-SA 출처 주석 추가. 도형·색상·그라데이션·viewBox 보존. 실행 코드/외부 참조 없음.

