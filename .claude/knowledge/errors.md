# 에러 및 함정 모음
<!-- 담당: debugger, tester | 최대 30항목 -->
<!-- 이 프로젝트에서 반복되는 에러 패턴, 함정, 주의사항을 기록 -->

### [2026-03-26] CSS box-shadow 스포트라이트 + 오버레이 배경 겹침 버그
- **분류**: error
- **발견자**: debugger
- **내용**: box-shadow로 스포트라이트 구멍을 뚫는 패턴에서, 오버레이 배경(rgba)과 box-shadow(rgba)가 동시에 적용되면 구멍이 보이지 않는다. 오버레이 배경이 구멍 위를 덮어버리기 때문. 해결: 스포트라이트(rect)가 활성화된 상태에서는 오버레이 배경을 transparent로 설정하고, box-shadow만으로 어둡게 처리한다. rect가 없는 초기 상태에서만 오버레이 배경색을 사용한다.
- **참조횟수**: 1

### [2026-03-26] CSS 기반 하이라이트의 근본적 한계 (5회 실패 종합)
- **분류**: error
- **발견자**: planner-architect
- **내용**: CSS만으로 특정 DOM 요소를 하이라이트하는 모든 방식이 실패한 종합 기록. (1) box-shadow 9999px 방식: 오버레이 배경과 겹침. (2) 대상 z-index 올리기: 부모 stacking context(sticky header, overflow:hidden 등)에 갇혀서 z-index가 무시됨. (3) 4-div 오버레이(상/하/좌/우 div로 구멍 생성): 대상이 뷰포트보다 크면 구멍이 전체를 차지. (4) 하이라이트 링(테두리만 표시): 시각적으로 "하이라이트" 느낌이 약함. 결론: 웹에서 안정적인 요소 하이라이트는 SVG mask/clipPath 방식(driver.js 등)이 유일하게 신뢰할 수 있음.
- **참조횟수**: 0

### [2026-03-29] Next.js 16 middleware.ts와 proxy.ts 충돌
- **분류**: error
- **발견자**: debugger
- **내용**: Next.js 16에서는 `middleware` 파일 컨벤션이 deprecated되고 `proxy`로 대체되었다. `src/middleware.ts`와 `src/proxy.ts`가 동시에 존재하면 개발서버 시작 시 `Unhandled Rejection: Both middleware file and proxy file are detected` 에러가 발생한다. 해결: `middleware.ts`를 삭제하고 `proxy.ts`만 사용한다. 새 matcher가 필요하면 `proxy.ts`의 config.matcher에 추가한다.
- **참조횟수**: 0
