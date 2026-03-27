# 작업 스크래치패드

## 현재 작업
- **요청**: 메뉴 통폐합 + UI 전반 개선 + 독립 페이지 분리
- **상태**: 완료 (커밋+푸시됨)
- **현재 담당**: pm
- **마지막 세션**: 2026-03-28

---

## 작업 로그 (최근 10건)

| 날짜 | 작업 내용 | 파일 | 상태 |
|------|----------|------|------|
| 2026-03-26 | 이용약관 관리 독립 페이지 분리 (/admin/terms) | admin/terms/*, ProgramsAdminClient, programs/page, layout | 완료 |
| 2026-03-28 | 히어로-본문 제목 중복 제거 (FAQ+이용약관) | FaqClient, ProgramAccordionTerms, terms/page | 완료 |
| 2026-03-28 | 이용약관+FAQ 독립 페이지 분리 (/terms, /faq) | terms/page, faq/page, FaqClient, Header, Footer | 완료 |
| 2026-03-28 | 메뉴 4카테고리 재구성 + 오시는 길 섹션 | PublicHeader, about/page | 완료 |
| 2026-03-28 | FAQ DB 통합 관리 (10개, 이용약관 기반 추가) | ApplyPageClient + DB INSERT | 완료 |
| 2026-03-28 | 이용약관 항상 펼침 + 중요 키워드 자동 강조 | ProgramAccordionTerms | 완료 |
| 2026-03-28 | 이용약관 접근성 개선 (푸터 링크+신청 안내) | PublicFooter, ApplyPageClient, programs/page | 완료 |
| 2026-03-27 | 투어 정보 스텝 오버레이 제거 (콘텐츠 가리지 않음) | GuideTourTrigger | 완료 |
| 2026-03-27 | 입학가이드 버튼 원형+색상 수정 | GuideTourTrigger | 완료 |
| 2026-03-27 | 히어로 리디자인 + 높이 75% 축소 (전체 페이지) | LandingPageClient + 9개 페이지 | 완료 |
| 2026-03-27 | 시간표 필터 수평스크롤 + lucide→Material Symbols | ScheduleClient, GalleryPublicClient, notices/page | 완료 |

---

## 프로젝트 현황 요약
- **완료된 Phase**: 초기 ~ Phase 10 + 보안패치 + 입학가이드 + UI개선
- **개발서버**: localhost:4000
- **프로덕션 배포**: stiz-dasan.kr (Vercel)

### 최근 주요 변경사항
- 입학가이드 투어 v2 (driver.js, 5단계 게임 튜토리얼)
- 메뉴 4카테고리 (학원 소개 / 수업 안내 / 소식·안내 / 수업찾기)
- 이용약관(/terms) + FAQ(/faq) 독립 페이지
- 오시는 길 (카카오맵) /about 하단
- 체험수업 비용 무료→1만원 전체 수정
- 관리자 페이지 쿼리 병렬화 4건

### 대기 중인 작업
1. **학부모 후기 동적화**: 현재 하드코딩 → DB 관리 전환 (구글 리뷰 불가, 자체 관리)
2. **수업 등록 시뮬레이터 리디자인**: 기획설계 완료, 디자인 시안 대기
3. **엑셀 업로드 일괄 등록**: planner 계획 수립 완료, 사용자 결정 대기
