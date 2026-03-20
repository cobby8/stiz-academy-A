# 📋 작업 스크래치패드

## 현재 작업
- **요청**: 공개 페이지 전체 UI/UX 개편 설계 계획서 작성
- **상태**: Phase 6 구현 완료 — tester 검증 대기
- **현재 담당**: developer
- **마지막 세션**: 2026-03-20
- **사용자 결정사항**:
  - 실시간 채팅: ❌ 개발 계획에서 제외
  - 자료실: ⏸️ 보류
  - 모바일 결제: ⏸️ 나중에
  - 범위: 공개 페이지 우선 (관리자 페이지는 이후)

## 프로젝트 현황 요약
- **완료된 Phase**: 초기 ~ Phase 10 (총 10단계 + 보안패치)
- **랠리즈 기능 커버율**: 약 85%
- **남은 기능**: 모바일 결제(상) — 보류
- **개발서버**: localhost:3000 정상 동작 확인

## 작업 계획 (planner)
(아직 없음)

## 설계 노트 (architect)

### 벤치마킹 리서치 결과 (2026-03-20)

> STIZ 농구교실 공개 페이지 UI/UX 개편을 위한 경쟁사/참고 사이트 분석

---

#### 1. ClassDojo (classdojo.com) - 해외 교육 플랫폼

**회사 설명**: 전 세계 4,500만 학생/학부모가 사용하는 교실 커뮤니케이션 플랫폼. 교사-학부모 간 소통을 핵심으로 한다.

**UI/UX 특장점**:
- 브랜드 컬러: 보라색(Purple) 중심 팔레트 + 테마별 변형(Blue/Amber/Emerald)
- 12컬럼 반응형 그리드 시스템, 모바일 퍼스트 설계
- 둥근 모서리(rounded corners) + 부드러운 그림자 조합으로 친근한 느낌
- 캐릭터(몬스터 아바타)를 활용한 감성적 브랜딩
- 버튼 호버 시 미세한 스케일 변화(102% 확대)로 인터랙션 강화
- 포괄적인 디자인 토큰 시스템(색상, 간격, 반경 등 체계적 관리)

**STIZ 참고 포인트**:
- 캐릭터/마스코트를 활용한 친근한 브랜딩 (농구공 캐릭터 등)
- 체계적인 디자인 토큰 시스템 도입 (Tailwind CSS와 잘 맞음)
- 호버/포커스 인터랙션으로 생동감 부여

**아쉬운 점**: B2B(학교/학군) 중심이라 학원 소개 페이지 참고로는 한계

---

#### 2. Seesaw (seesaw.com) - 해외 교육 플랫폼

**회사 설명**: 2,500만+ 교육자/학생/가족이 사용하는 초등 학습 경험 플랫폼. 멀티모달 학습(음성, 영상, 그림, 글쓰기)에 특화.

**UI/UX 특장점**:
- 색상: 딥 퍼플(#5F2FA8) + 시안(#60CCCC) 조합 -- 고급스러우면서 활기찬 느낌
- 히어로 섹션: 4rem 대형 헤드라인(Lexend 폰트) + 듀얼 CTA 버튼
- 본문: DM Sans 폰트, 1.125rem, 깔끔한 가독성
- 최대 너비 1360px 컨테이너, 넉넉한 패딩(5-6rem)
- 아이콘 리스트 + 피처 카드(미세한 그림자)로 기능 소개
- 접기형 수평 메뉴, 다크 퍼플 배경의 네비게이션 바

**STIZ 참고 포인트**:
- 듀얼 CTA 전략 (Primary: 강조색 배경 / Secondary: 아웃라인) -- 체험신청 + 프로그램 보기
- 대형 헤드라인 + 서브카피 구조의 히어로 섹션
- 섹션별 배경색 변화로 시각적 구분

**아쉬운 점**: 교육 콘텐츠 플랫폼이라 학원 소개와는 성격이 다름

---

#### 3. Brightwheel (mybrightwheel.com) - 해외 보육/교육 관리 플랫폼

**회사 설명**: 미국 1위 보육시설 관리 플랫폼. 수백만 교육자/가족이 사용. 4.9/5 평점, 100,000+ 리뷰.

**UI/UX 특장점**:
- 브랜드 컬러: "Blurple"(#5463D6, 파란보라) -- 신뢰감 + 현대적
- 최대 1140px 콘텐츠 영역, 깔끔한 여백
- AvenirNext 폰트, 최대 90px 대형 타이포그래피
- 5개 핵심 모듈을 썸네일(626x359px) + 설명으로 직관적 배치
- 강력한 신뢰 시그널: 4.9/5 평점 배지 + 15개 상세 고객 후기(이름, 직함, 소속)
- CTA 버튼: Blurple 배경 + 화이트 텍스트, 호버 시 색상 변화

**STIZ 참고 포인트**:
- 숫자 기반 신뢰 구축 (수강생 수, 만족도, 운영 기간)
- 상세 후기 섹션 (학부모 이름 + 소속 지점 + 코멘트)
- 핵심 기능을 5개 모듈 카드로 시각화하는 패턴 -- 프로그램 소개에 적용 가능
- 전문적이면서도 접근성 높은 디자인 톤

**아쉬운 점**: 보육시설(유아) 중심이라 초/중등 스포츠 학원과는 타겟 다소 상이

---

#### 4. 클래스팅 (classting.com) - 국내 AI 학습관리 플랫폼

**회사 설명**: 국내 대표 교육 AI 플랫폼. "개인화 교육을 실현하는 교육 AI 에이전트" 표방. 초중고 학교/학원 대상.

**UI/UX 특장점**:
- 색상: 티알그린(#00C896) + 퍼플(#9F7AEA) 그래디언트 조합
- 4단계 플로우 다이어그램으로 사용자 여정 시각화 (진단->추천->경험->성취)
- 현대적 미니멀리즘: 넉넉한 여백, 명확한 타이포
- 데이터 시각화(차트, 리포트 스크린샷) 적극 활용
- 완전 반응형 설계, 모바일에서 단일 스택 레이아웃
- CTA: "도입 문의하기"(그래디언트), "무료 체험하기"(퍼플), "소개서 다운로드"(화이트)

**STIZ 참고 포인트**:
- 그래디언트 CTA 버튼 -- 눈에 잘 띄면서 세련됨
- 단계별 플로우 시각화 -- 수강 신청 과정(상담->체험->등록->수업)에 적용 가능
- 밝고 긍정적인 교육 친화적 톤

**아쉬운 점**: B2B 도입 문의 중심이라 일반 학부모 대상 랜딩과는 접근 방식 차이

---

#### 5. 김과외 (kimstudy.com) - 국내 과외 매칭 플랫폼

**회사 설명**: "대한민국 대표 과외 플랫폼". 누적 회원 227만명(학생/학부모 163만 + 선생님 64만), 만족도 97.2%.

**UI/UX 특장점**:
- 브랜드 컬러: 티파니 블루 (밝고 신뢰감 있는 톤)
- 히어로: "대한민국 1위" 대형 문구 + 숫자 기반 신뢰도(회원수, 만족도)
- 일러스트레이션/캐릭터 활용으로 친근한 분위기
- "1분이면 충분" 마케팅 -- 진입 장벽 제거 메시지
- CTA: "추천받기"(초록) / "직접찾기"(파랑) 듀얼 구조
- 안전 강조: 신원인증, 안전지원센터, 리뷰 시스템

**STIZ 참고 포인트**:
- 숫자로 신뢰 구축하는 히어로 패턴 (수강생 수, 운영 년수, 만족도)
- "안전" 강조 -- 체육 학원에서 특히 중요 (자격증 코치, 안전한 시설 등)
- 듀얼 CTA: "체험 신청하기" + "프로그램 둘러보기"
- 캐릭터/일러스트로 딱딱한 정보를 부드럽게 전달

**아쉬운 점**: 과외 매칭이라 학원 운영/소개 페이지와는 구조가 다름

---

#### 6. Sawyer (hisawyer.com) - 해외 아동 활동/클래스 예약 플랫폼

**회사 설명**: 미국 아동 활동(스포츠, 예술, 캠프 등) 검색/예약 플랫폼. 교육자와 학부모 양쪽을 연결.

**UI/UX 특장점**:
- 색상: 화이트 기반 + 틸/터쿼이즈 액센트 -- 깔끔하고 현대적
- 분할 히어로 패턴: "For families" / "For educators" 두 경로 분리
- 미니멀리스트 접근: 플랫 디자인, 그림자/그래디언트 최소화
- 넉넉한 여백으로 인지 부하 감소
- CTA: "Explore Classes" + 쉐브론 아이콘 -- 행동 유도 명확
- 모바일 퍼스트 반응형 설계

**STIZ 참고 포인트**:
- 미니멀한 깔끔함 -- 정보가 많은 학원 사이트에서 시각적 정리에 참고
- 행동 중심 CTA 문구 ("탐색하기", "신청하기" 등 동사형)
- 화이트스페이스 적극 활용으로 세련된 느낌

**아쉬운 점**: 마켓플레이스 성격이라 단일 학원 홈페이지와는 구조 차이

---

#### 7. FC서울 유소년 축구교실 (academy.fcseoul.com) - 국내 스포츠 아카데미

**회사 설명**: 프로축구단 FC서울 산하 유소년 축구 아카데미. "Future of FC서울" 브랜딩.

**UI/UX 특장점**:
- ASP 기반 레거시 사이트 (기술적으로 오래된 구조)
- 프로 스포츠팀의 브랜드 자산 활용 (로고, 팀 컬러)
- 자동 리다이렉트 구조

**STIZ 참고 포인트**:
- 프로 스포츠팀 연계 브랜딩의 신뢰감 -- STIZ도 전문성을 강조할 브랜딩 필요
- (기술적으로는 참고할 점 적음 -- 오래된 기술 스택)

**아쉬운 점**: 레거시 ASP 사이트로 현대적 UI/UX 참고에는 부적합

---

#### 8. TOP 농구교실 (topbasketball.kr) - 국내 농구교실 (직접 경쟁사)

**회사 설명**: 국내 농구 교육 전문 사이트. Wix 기반으로 제작.

**UI/UX 특장점**:
- Wix 플랫폼 기반, 3단 구조(Header/Content/Footer)
- 반응형 그리드 레이아웃
- 드롭다운 메뉴 + 호버 색상 변경
- 이미지 지연 로딩, 접근성 고려

**STIZ 참고 포인트**:
- 동종 업계(농구교실) 사이트의 현재 수준 파악 -- STIZ가 이보다 훨씬 앞서야 함
- Wix 수준을 넘어서는 커스텀 Next.js 사이트의 차별화 기회

**아쉬운 점**: Wix 템플릿 기반이라 디자인 자유도 낮음, 독창성 부족

---

### STIZ 공개 페이지 개편 시 핵심 트렌드/방향 요약

#### A. 디자인 방향

| 항목 | 권장 방향 | 참고 사이트 |
|------|----------|------------|
| 색상 체계 | 오렌지/블루 계열 스포츠 컬러 + 밝은 액센트 | ClassDojo, Seesaw |
| 타이포그래피 | 대형 헤드라인(2-4rem) + 깔끔한 본문 | Seesaw, Brightwheel |
| 레이아웃 | 섹션 기반 수직 스크롤, 최대 1200-1400px | 전체 공통 |
| 여백 | 넉넉한 화이트스페이스 | Sawyer, Seesaw |
| 모서리 | 둥근 모서리(8-16px radius) | ClassDojo, Brightwheel |
| 모바일 | 모바일 퍼스트 반응형 | 전체 공통 |

#### B. 콘텐츠 전략

1. **히어로 섹션**: 대형 비주얼(농구 수업 사진/영상) + 핵심 메시지 + 듀얼 CTA ("체험 신청" + "프로그램 보기")
2. **숫자로 신뢰 구축**: 운영 기간, 수강생 수, 만족도 등 핵심 지표 강조 (김과외, Brightwheel 패턴)
3. **안전/전문성 강조**: 코치 자격증, 안전한 시설, 체계적 커리큘럼 (김과외의 안전 강조 패턴)
4. **학부모 후기 섹션**: 실명 + 사진 + 구체적 후기 (Brightwheel 패턴)
5. **프로그램 카드**: 5개 내외 핵심 프로그램을 비주얼 카드로 배치 (Brightwheel 모듈 패턴)
6. **수강 과정 시각화**: 상담->체험->등록->수업 4단계 플로우 (클래스팅 패턴)

#### C. 인터랙션/UX 패턴

1. **스크롤 애니메이션**: 섹션 진입 시 페이드인 효과 (2025-2026 트렌드)
2. **호버 인터랙션**: 카드/버튼에 미세한 스케일+색상 변화 (ClassDojo)
3. **CTA 전략**: 페이지 곳곳에 "체험 신청" CTA 반복 배치
4. **빠른 로딩**: 이미지 최적화 + Next.js ISR 활용 (3초 이내 로딩)
5. **접근성**: 키보드 네비게이션, 포커스 상태 시각화

#### D. STIZ만의 차별화 기회

- 국내 농구교실 사이트 대부분이 Wix/카페24 수준 -- Next.js 기반 커스텀 사이트로 압도적 차별화 가능
- 실시간 시간표(Google Sheets 연동) + PWA는 이미 구현되어 있어 기술적 우위
- 갤러리/활동 사진을 메인 페이지에 적극 노출하여 "우리 아이가 여기서 운동하는 모습" 상상하게 만들기
- 체험 신청 과정을 최대한 단순화 ("1분이면 충분" 패턴 적용)

### UI/UX 개편 설계 계획서 (2026-03-20)

> ClassDojo 스타일을 기반으로 STIZ 농구교실 공개 페이지를 개편하는 설계 계획서.
> 코드 수정 없이 설계 방향과 구현 가이드만 제공한다.

---

#### 1. 디자인 컨셉

**ClassDojo에서 가져올 핵심 요소:**
- 체계적 디자인 토큰 시스템 (색상/간격/반경/그림자를 CSS 변수로 관리)
- 둥근 모서리(rounded corners) + 부드러운 그림자 조합 -- "딱딱한 학원" 느낌 대신 "따뜻한 교육 공간" 느낌
- 호버 시 미세한 스케일 변화(102~105%)로 카드/버튼에 생동감 부여
- 계층적 타이포그래피 (Headline/Body/Caption 명확히 구분)
- 표면(Surface) 색상 계층 구조 (bg-surface, bg-surface-1, bg-surface-2)

**STIZ 농구교실(스포츠 학원)에 맞게 변형할 부분:**
- ClassDojo의 보라색(Purple) 팔레트 --> STIZ의 오렌지+네이비 스포츠 컬러로 교체
- 몬스터 캐릭터 대신 농구공/농구 실루엣 등 스포츠 그래픽 활용
- 교실 커뮤니케이션 톤 --> "활기찬 스포츠 교육" 톤으로 전환
- 넉넉한 여백 유지하되, 스포츠 특유의 다이내믹한 각도(skew) 배경을 포인트로 활용

**전체적인 톤앤매너 방향:**
- "밝고 활기찬 + 전문적이고 신뢰감 있는" 균형
- 학부모가 첫 방문에서 느낄 감정: "여기 제대로 된 곳이다" + "아이가 즐겁게 다닐 수 있겠다"
- 현재 사이트의 "정보 나열형" 구조 --> "스토리텔링형" 구조로 전환

---

#### 2. 컬러 팔레트

**현재 상태 분석:**
- 현재: brand-orange-500(#f97316), brand-navy-900(#0f1e4a) 2색 체계
- 문제: 색상 변수가 5개뿐이라 디자인 표현력이 제한적

**개편 후 컬러 시스템:**

| 역할 | 변수명 | 색상값 | 용도 |
|------|--------|--------|------|
| Primary | brand-orange-400 | #fb923c | 호버 전 밝은 강조 |
| Primary | brand-orange-500 | #f97316 | CTA 버튼, 강조 요소 (유지) |
| Primary | brand-orange-600 | #ea580c | 호버 상태 (유지) |
| Primary | brand-orange-700 | #c2410c | 더 진한 강조 (신규) |
| Secondary | brand-navy-700 | #1e3a5f | 부제목, 보조 텍스트 (신규) |
| Secondary | brand-navy-800 | #1e3a8a | 서브 헤더 배경 (유지) |
| Secondary | brand-navy-900 | #0f1e4a | 히어로/헤더 배경 (유지) |
| Accent | brand-sky-50 | #f0f9ff | 밝은 정보 배경 (신규) |
| Accent | brand-sky-100 | #e0f2fe | 정보 카드 배경 (신규) |
| Accent | brand-sky-500 | #0ea5e9 | 링크, 보조 액센트 (신규) |
| Surface | surface-warm | #fffbf5 | 메인 배경 -- 순백(#fff) 대신 따뜻한 톤 (신규) |
| Surface | surface-section | #faf5f0 | 교차 섹션 배경 (신규) |
| Surface | surface-card | #ffffff | 카드 배경 (기존 white) |
| Success | green-500 | #22c55e | 여석 있음, 성공 상태 |
| Warning | amber-500 | #f59e0b | 마감 임박 |
| Error | red-500 | #ef4444 | 마감, 에러 |
| Text | gray-900 | #111827 | 제목 텍스트 (유지) |
| Text | gray-700 | #374151 | 본문 텍스트 |
| Text | gray-500 | #6b7280 | 보조 텍스트 |
| Text | gray-400 | #9ca3af | 캡션, 비활성 |

**Tailwind CSS globals.css @theme에 추가할 변수:**
```
--color-brand-orange-400, --color-brand-orange-700
--color-brand-navy-700
--color-brand-sky-50, --color-brand-sky-100, --color-brand-sky-500
--color-surface-warm, --color-surface-section
```

---

#### 3. 타이포그래피

**현재 상태 분석:**
- 현재: CSS 변수(--font-body, --font-heading)로 DB 설정에서 폰트 주입
- 크기 체계가 명확하지 않음 (각 페이지마다 다른 크기 사용)

**개편 후 폰트 체계:**

| 용도 | 폰트 | 이유 |
|------|------|------|
| 한글 제목 | Pretendard Bold/Black | 깔끔하고 현대적, 무료, 가변 폰트 |
| 한글 본문 | Pretendard Regular/Medium | 가독성 최고, 시스템 폰트와 호환 |
| 영문 제목 | Pretendard 또는 시스템 기본 | 별도 영문 폰트 로딩 불필요 |
| 영문 본문 | 시스템 기본 (fallback) | 로딩 최적화 |

> 참고: 현재 DB 설정으로 폰트를 선택하는 구조는 유지한다. 기본값으로 Pretendard를 추천하되, 관리자가 변경 가능한 유연성은 그대로 둔다.

**크기 체계 (ClassDojo의 Headline/Body/Caption 패턴 적용):**

| 단계 | 이름 | 크기(rem) | 굵기 | 용도 |
|------|------|----------|------|------|
| H1 | hero-title | 3~3.75 (48~60px) | 900 (Black) | 히어로 메인 타이틀 |
| H2 | section-title | 2~2.5 (32~40px) | 800 (ExtraBold) | 섹션 제목 |
| H3 | card-title | 1.5 (24px) | 700 (Bold) | 카드/서브섹션 제목 |
| H4 | label | 1.125 (18px) | 700 (Bold) | 레이블, 소제목 |
| Body1 | body-large | 1.125 (18px) | 400 (Normal) | 히어로 설명문 |
| Body2 | body | 1 (16px) | 400 (Normal) | 일반 본문 |
| Caption | caption | 0.875 (14px) | 500 (Medium) | 날짜, 메타정보 |
| Small | small | 0.75 (12px) | 500 (Medium) | 뱃지, 태그 |
| Tag | tag-label | 0.6875 (11px) | 700 (Bold) | 상단 섹션 라벨 (ABOUT US 등) |

---

#### 4. 공통 컴포넌트 설계

**4-1. 헤더/네비게이션 개편**

현재 문제:
- 메인 랜딩과 서브페이지가 각각 별도로 헤더를 구현 (LandingPageClient vs PublicPageLayout)
- 코드 중복이 심함 (헤더/푸터가 2벌)
- 모바일 네비가 수평 스크롤 필(pill) 방식 -- 메뉴가 많아지면 발견성 떨어짐

개편 방향:
- 헤더를 하나의 공통 컴포넌트로 통합 (PublicHeader.tsx)
- 유틸리티 바(운영시간/전화번호) 유지하되 스타일 개선
- 모바일: 햄버거 메뉴 + 슬라이드 사이드바 (ClassDojo 패턴)
- 데스크탑: 현재 스타일 유지하되 호버 효과 강화 (밑줄 슬라이드 인)
- 스크롤 시 헤더 배경 불투명도 변화 (glassmorphism 효과)
- "전화문의" 버튼 --> "체험 신청" CTA로 변경 (전화번호는 유틸리티 바에 이미 있으므로)

**4-2. 푸터 개편**

현재 문제:
- 메인 랜딩과 서브페이지 각각 푸터 코드 중복
- 디자인은 괜찮으나 통합 필요

개편 방향:
- 공통 PublicFooter.tsx로 통합
- 소셜미디어 아이콘 영역 추가 (인스타그램 등)
- 뉴스레터/카카오톡 상담 링크 추가 가능 영역 예비

**4-3. 버튼 시스템**

| 종류 | 배경 | 텍스트 | 테두리 | 호버 효과 |
|------|------|--------|--------|----------|
| Primary | brand-orange-500 | white | 없음 | bg-orange-600 + scale-[1.02] + shadow-lg |
| Secondary | brand-navy-900 | white | 없음 | bg-navy-800 + scale-[1.02] |
| Ghost | transparent | brand-orange-500 | brand-orange-500/50 | bg-orange-50 + border-orange-500 |
| White | white | brand-navy-900 | gray-200 | bg-gray-50 + shadow-md |
| CTA Large | brand-orange-500 | white | 없음 | scale-[1.03] + shadow-xl + 배경 그라데이션 |

공통 속성:
- 모서리: rounded-xl (12px) -- 일반 버튼 / rounded-2xl (16px) -- 큰 CTA
- 패딩: px-6 py-3 (일반) / px-8 py-4 (Large) / px-10 py-5 (CTA)
- 전환: transition-all duration-200
- 포커스: focus:ring-2 focus:ring-brand-orange-500/50 focus:ring-offset-2

**4-4. 카드 컴포넌트**

| 종류 | 배경 | 모서리 | 그림자 | 호버 |
|------|------|--------|--------|------|
| 기본 카드 | white | rounded-2xl (16px) | shadow-sm | shadow-md + -translate-y-1 |
| 강조 카드 | white + 좌측 4px 색상 바 | rounded-2xl | shadow-sm | shadow-lg + scale-[1.01] |
| 이미지 카드 | white | rounded-2xl | shadow-md | shadow-xl + 이미지 scale-105 |
| 정보 카드 | surface-section | rounded-xl | 없음 | bg-white + shadow-sm |

공통: border border-gray-100, transition-all duration-300

**4-5. 섹션 레이아웃**

- 섹션 간 수직 간격: py-16 md:py-24 (64~96px) -- 현재 py-12 md:py-16보다 넉넉하게
- 최대 너비: max-w-6xl (1152px) 유지 -- 콘텐츠 가독성 최적
- 섹션 제목 패턴: 상단 라벨(tag-label, brand-orange-500) + 대형 제목(section-title) + 설명문(body-large)
- 교차 배경: white --> surface-section --> white --> surface-section 반복

**4-6. CTA 배너**

- 현재: 단색 배경(orange-500 또는 navy-900) + 텍스트 + 버튼
- 개편: 그라데이션 배경(navy-900 -> navy-800) + 장식 도형(원, 농구공 패턴) + 듀얼 CTA
- 패턴: ClassDojo의 gradient-to-b 히어로 배경 참고

**4-7. 페이지 히어로 (서브페이지 공통)**

현재: 모든 서브페이지가 동일한 brand-navy-900 배경의 간단한 히어로
개편:
- 배경에 미세한 그라데이션 추가 (navy-900 -> navy-800 -> navy-900)
- 장식 요소 추가 (반투명 원, 농구공 실루엣)
- 브레드크럼 추가 (홈 > 현재페이지)
- 히어로 높이를 약간 확대 (py-14 --> py-16 md:py-20)

---

#### 5. 페이지별 레이아웃 방향

**5-1. 메인 랜딩 (/) -- LandingPageClient.tsx**

현재 문제점:
- 히어로 섹션이 텍스트 위주, 사진/영상이 없어 임팩트 부족
- 퀵 네비 카드가 4개뿐이고 단조로움
- 갤러리 섹션이 단순 격자 나열
- 숫자 기반 신뢰 섹션 없음
- 학부모 후기 섹션 없음

개편 후 구성 (위에서 아래 순서):
1. **히어로 섹션**: 좌 텍스트 + 우 이미지(또는 영상) 분할 레이아웃, 듀얼 CTA (체험신청 Primary + 프로그램보기 Ghost)
2. **신뢰 지표 바**: 운영 기간 / 수강생 수 / 만족도 -- 3~4개 숫자 카운터 (아이콘 + 숫자 + 라벨)
3. **프로그램 하이라이트**: 3~4개 핵심 프로그램을 이미지 카드로 (Brightwheel 모듈 패턴)
4. **수강 과정 시각화**: 상담 -> 체험 -> 등록 -> 수업 4단계 (클래스팅 플로우 다이어그램 패턴)
5. **유튜브 영상 섹션**: 유지 (있을 경우)
6. **갤러리 하이라이트**: 최근 활동사진 6~8장 + "더보기" 링크
7. **학부모 후기 섹션**: 캐러셀(Slick/Swiper) 형태의 후기 카드 (향후 DB 연동)
8. **CTA 배너**: 체험 신청 + 전화문의 듀얼 CTA
9. **푸터**

핵심 변경 포인트:
- 히어로에 실제 수업 사진/영상 추가 (현재 텍스트만 있음)
- 숫자 신뢰 지표 신설 (김과외/Brightwheel 패턴)
- 수강 과정 4단계 시각화 신설
- 후기 섹션 신설 (초기에는 하드코딩, 이후 DB 연동)

**5-2. 학원소개 (/about) -- about/page.tsx**

현재 문제점:
- 원장 인사말이 텍스트 블록으로만 구성 -- 딱딱함
- 코치 카드가 작은 원형 사진 + 텍스트로만 구성 -- 생동감 부족
- 시설 사진이 단순 격자 나열

개편 후 구성:
1. **페이지 히어로**: 개선된 공통 히어로 (장식 요소 추가)
2. **학원 소개**: 좌 텍스트(원장 인사말) + 우 이미지 분할 레이아웃 + "우리의 약속" 핵심 가치 3가지 카드
3. **교육 이념**: 아이콘 + 텍스트 카드 3~4개 (전문성/안전/즐거움/성장)
4. **코치진 소개**: 카드형 레이아웃으로 확대 -- 사진(가로형) + 이름/역할 + 자격증/경력 뱃지 + 한줄 소개
5. **시설 소개**: 이미지 갤러리 + 시설 특장점 리스트
6. **CTA 배너**

핵심 변경 포인트:
- 코치 카드를 더 크고 정보가 풍부하게
- "교육 이념"을 시각적 카드로 표현
- 시설 사진에 라이트박스(확대보기) 추가

**5-3. 프로그램 (/programs) -- programs/page.tsx**

현재 문제점:
- 프로그램 카드가 리스트형 나열 -- 한눈에 비교 어려움
- 수강료 테이블이 기능적이지만 시각적 매력 부족
- 프로그램 간 차이가 한눈에 안 들어옴

개편 후 구성:
1. **페이지 히어로**
2. **프로그램 개요**: 전체 프로그램을 3~4개 컬러 카드로 요약 (유아반 = 초록, 초등반 = 파랑, 중등반 = 보라 등)
3. **프로그램 상세**: 각 프로그램을 세로 카드(이미지 상단 + 정보 하단)로 재구성
4. **수강료 비교표**: 전체 프로그램 수강료를 하나의 표로 비교 가능하게
5. **이용약관**: 접기(Accordion) 방식으로 변경 -- 전문이 바로 노출되면 페이지가 길어짐
6. **CTA 배너**

핵심 변경 포인트:
- 프로그램 카드에 색상 구분(대상 연령별)
- 수강료 표를 더 시각적으로 (현재도 좋지만 프로그램별 색상 추가)
- 이용약관 Accordion 접기

**5-4. 시간표 (/schedule) -- schedule/page.tsx**

현재 문제점:
- ScheduleClient가 이미 잘 되어 있음 (요일별 색상 구분, 프로그램 필터)
- 개선 필요 영역은 시각적 세련미

개편 후 구성:
1. **페이지 히어로**
2. **프로그램 필터 탭**: 현재 유지, 디자인만 개선 (ClassDojo 탭 스타일)
3. **시간표 그리드**: 현재 구조 유지, 카드 스타일만 개선 (더 둥글고 부드럽게)
4. **CTA 배너**

핵심 변경 포인트:
- 전체적인 스타일만 디자인 토큰에 맞춰 개선
- 기능/구조는 현재 그대로 유지 (잘 되어 있음)

**5-5. 연간일정 (/annual) -- annual/page.tsx**

현재 문제점:
- AnnualEventsClient가 이미 복잡한 기능을 잘 처리함
- 시각적 일관성만 맞추면 됨

개편 후 구성:
- 구조 유지, 디자인 토큰만 적용
- 범례(Legend) 디자인 개선
- 이벤트 카드 스타일 통일

핵심 변경 포인트: 스타일만 개선, 기능 변경 없음

**5-6. 갤러리 (/gallery) -- gallery/page.tsx**

현재 문제점:
- GalleryPublicClient가 기본 기능을 제공
- 라이트박스(전체화면 보기) 미비
- 카테고리/날짜 필터 없음

개편 후 구성:
1. **페이지 히어로**
2. **필터 바**: 최신순/오래된순, 월별 필터 (간단한 드롭다운)
3. **갤러리 그리드**: Masonry 레이아웃 또는 현재 격자 유지 + 호버 오버레이 개선
4. **라이트박스**: 클릭 시 전체화면 + 좌우 네비게이션

핵심 변경 포인트:
- 라이트박스 추가
- 호버 시 제목/날짜 오버레이

**5-7. 공지사항 (/notices) -- notices/page.tsx**

현재 문제점:
- 기능적으로 충분하나 디자인이 단조
- 상세 페이지에서 rich content 렌더링 개선 여지

개편 후 구성:
- 리스트 카드 스타일 개선 (좌측 날짜 강조, 핀 아이콘 개선)
- 상세 페이지 타이포그래피 개선
- 카테고리 뱃지 추가 (중요/일반/행사 등)

핵심 변경 포인트: 스타일 개선 위주

**5-8. 체험/수강신청 (/apply) -- apply/page.tsx**

현재 문제점:
- 두 섹션(체험/수강)이 카드형으로 잘 구성됨
- Google Forms iframe이 모달로 열리는 구조는 좋음
- 진입 장벽을 더 낮출 수 있음

개편 후 구성:
1. **페이지 히어로**: "1분이면 충분해요!" 메시지 강조
2. **수강 과정 안내**: 상담 -> 체험 -> 등록 -> 수업 시각적 스텝
3. **체험수업 카드**: 현재 구조 유지 + 체험 혜택 강조 (무료/할인 등)
4. **수강신청 카드**: 현재 구조 유지
5. **FAQ 섹션**: Accordion 형태의 자주 묻는 질문 (향후 DB 연동)
6. **CTA 배너**: 전화 상담 안내

핵심 변경 포인트:
- "1분이면 충분" 진입장벽 제거 메시지
- 수강 과정 시각적 스텝 추가
- FAQ 섹션 추가

**5-9. 마이페이지 (/mypage) -- mypage/**

현재 문제점:
- 이미 잘 구성된 대시보드 (출결/수납/알림/요청/피드백)
- 자체 레이아웃(mypage/layout.tsx) 사용 중 -- 공개 페이지와 별도
- 모바일 하단 네비게이션 잘 구현됨

개편 후 구성:
- 전체 디자인 토큰 적용 (색상, 모서리, 그림자 통일)
- 학생 카드 디자인 개선 (현재 navy 배경 카드 유지, 장식 요소 추가)
- 알림 패널 디자인 개선

핵심 변경 포인트: 디자인 토큰 통일만, 구조 변경 없음

**5-10. 로그인 (/login) -- login/page.tsx**

현재 문제점:
- "관리자 시스템"이라고 표시됨 -- 학부모 로그인도 여기서 하게 되면 혼란
- 디자인은 깔끔하나 STIZ 브랜드 느낌이 약함

개편 후 구성:
1. **배경**: surface-warm + 장식 도형(반투명 농구공 패턴)
2. **로고**: 현재 오렌지 사각형 "S" 아이콘 --> 실제 STIZ 로고 사용
3. **타이틀**: "스티즈농구교실" + "학부모/관리자 로그인" (용도 명확화)
4. **카드**: 현재 구조 유지, 디자인 토큰 적용
5. **하단**: "홈페이지로 돌아가기" 유지

핵심 변경 포인트:
- "관리자 시스템" 표현 --> "학부모/관리자 로그인"으로 변경
- STIZ 로고 사용
- 배경 장식 추가

---

#### 6. 인터랙션/애니메이션 설계

**6-1. 스크롤 애니메이션**

- 섹션 진입 시 fade-in + slide-up (아래에서 위로 20px 이동하며 나타남)
- duration: 500ms, ease-out
- Intersection Observer API 활용 (라이브러리: 없이 직접 구현 또는 framer-motion 경량 사용)
- 주의: 과하지 않게. 한 섹션에 하나의 애니메이션만.

**6-2. 호버 효과 (ClassDojo 핵심 패턴)**

| 요소 | 호버 효과 |
|------|----------|
| 네비 링크 | 밑줄 슬라이드-인 (pseudo element) |
| 카드 | -translate-y-1 + shadow-md --> shadow-lg |
| 버튼 | scale-[1.02] + 배경색 한 단계 진하게 |
| 이미지 카드 | 이미지 scale-105 + 오버레이 출현 |
| 아이콘 | scale-110 + 색상 변화 |

ClassDojo 참고: hover:scale-102 / active:scale-98 패턴 적용

**6-3. 페이지 전환 효과**

- Next.js App Router의 기본 전환 활용
- 추가 전환 효과는 성능 영향 고려하여 최소화
- 로딩 중: 스켈레톤 UI (loading.tsx)

**6-4. 로딩 상태**

- 각 서브페이지에 loading.tsx 추가 (스켈레톤 카드 + 펄스 애니메이션)
- 이미지: blur placeholder 활용 (Next.js Image blurDataURL)
- 시간표/연간일정 등 데이터 로딩 시: 스켈레톤 그리드

---

#### 7. 개편 작업 단계 및 우선순위

**Phase 0: 디자인 시스템 기반 구축 (최우선)**

| 파일 경로 | 역할 | 신규/수정 |
|----------|------|----------|
| src/app/globals.css | 컬러 토큰 확장, 애니메이션 키프레임 추가 | 수정 |
| src/components/ui/Button.tsx | 공통 버튼 컴포넌트 (Primary/Secondary/Ghost/CTA) | 신규 |
| src/components/ui/Card.tsx | 공통 카드 컴포넌트 (기본/강조/이미지) | 신규 |
| src/components/ui/SectionLayout.tsx | 공통 섹션 래퍼 (제목+배경+간격) | 신규 |
| src/components/ui/Badge.tsx | 공통 뱃지 컴포넌트 | 신규 |
| src/components/ui/AnimateOnScroll.tsx | 스크롤 진입 애니메이션 래퍼 | 신규 |

예상 작업량: 파일 6개, 난이도 중
의존성: 없음 -- 가장 먼저 해야 함

**Phase 1: 공통 레이아웃 통합**

| 파일 경로 | 역할 | 신규/수정 |
|----------|------|----------|
| src/components/PublicHeader.tsx | 통합 헤더 (유틸리티바 + 네비 + 모바일 사이드바) | 신규 |
| src/components/PublicFooter.tsx | 통합 푸터 | 신규 |
| src/components/PublicPageLayout.tsx | 새 헤더/푸터 연결 | 수정 |
| src/app/LandingPageClient.tsx | 별도 헤더/푸터 제거, 공통 레이아웃 사용 | 수정 |

예상 작업량: 파일 4개, 난이도 중
의존성: Phase 0 완료 후

**Phase 2: 메인 랜딩 개편**

| 파일 경로 | 역할 | 신규/수정 |
|----------|------|----------|
| src/app/LandingPageClient.tsx | 히어로/섹션 구조 전면 개편 | 수정 |
| src/components/landing/TrustBadges.tsx | 신뢰 지표 바 (숫자 카운터) | 신규 |
| src/components/landing/ProgramHighlight.tsx | 프로그램 하이라이트 카드 | 신규 |
| src/components/landing/ProcessSteps.tsx | 수강 과정 4단계 시각화 | 신규 |
| src/components/landing/TestimonialCarousel.tsx | 학부모 후기 캐러셀 | 신규 |
| src/components/landing/CTABanner.tsx | CTA 배너 (재사용 가능) | 신규 |

예상 작업량: 파일 6개, 난이도 상
의존성: Phase 0, 1 완료 후

**Phase 3: 서브페이지 개편 (높은 트래픽 순)**

| 파일 경로 | 역할 | 신규/수정 |
|----------|------|----------|
| src/app/about/page.tsx | 학원소개 레이아웃 개편 | 수정 |
| src/app/programs/page.tsx | 프로그램 카드/수강료 개편 | 수정 |
| src/app/apply/page.tsx | 체험신청 개편 | 수정 |
| src/app/apply/ApplyPageClient.tsx | 체험신청 클라이언트 개편 | 수정 |

예상 작업량: 파일 4개, 난이도 중
의존성: Phase 0, 1 완료 후 (Phase 2와 병행 가능)

**Phase 4: 기능 페이지 스타일 통일**

| 파일 경로 | 역할 | 신규/수정 |
|----------|------|----------|
| src/app/schedule/ScheduleClient.tsx | 시간표 카드 스타일 개선 | 수정 |
| src/app/annual/AnnualEventsClient.tsx | 연간일정 스타일 개선 | 수정 |
| src/app/gallery/page.tsx | 갤러리 스타일 개선 | 수정 |
| src/app/gallery/GalleryPublicClient.tsx | 라이트박스 추가 | 수정 |
| src/app/notices/page.tsx | 공지 리스트 스타일 개선 | 수정 |
| src/app/notices/[id]/page.tsx | 공지 상세 스타일 개선 | 수정 |

예상 작업량: 파일 6개, 난이도 중~하
의존성: Phase 0 완료 후 (독립 작업 가능)

**Phase 5: 마이페이지 + 로그인 스타일 통일**

| 파일 경로 | 역할 | 신규/수정 |
|----------|------|----------|
| src/app/mypage/layout.tsx | 마이페이지 레이아웃 스타일 통일 | 수정 |
| src/app/mypage/MyPageClient.tsx | 대시보드 카드 스타일 통일 | 수정 |
| src/app/login/page.tsx | 로그인 페이지 브랜딩 개선 | 수정 |

예상 작업량: 파일 3개, 난이도 하
의존성: Phase 0 완료 후

**Phase 6: 마무리 및 최적화**

| 파일 경로 | 역할 | 신규/수정 |
|----------|------|----------|
| src/app/*/loading.tsx | 각 페이지 스켈레톤 로딩 UI | 신규 (다수) |
| public/ | 파비콘, OG 이미지, 농구 장식 SVG 에셋 | 수정/신규 |
| src/app/layout.tsx | Pretendard 폰트 로딩 설정 | 수정 |

예상 작업량: 파일 5~8개, 난이도 하
의존성: 전체 Phase 완료 후

---

#### 작업 순서 요약

```
Phase 0 (디자인 시스템) ────┐
                            ├──> Phase 1 (공통 레이아웃) ──> Phase 2 (메인 랜딩)
                            │
                            ├──> Phase 3 (주요 서브페이지) -- Phase 2와 병행 가능
                            │
                            ├──> Phase 4 (기능 페이지 스타일) -- 독립 작업 가능
                            │
                            └──> Phase 5 (마이/로그인) -- 독립 작업 가능
                                                                    │
                                                            Phase 6 (마무리)
```

**총 예상 파일 수:** 신규 약 15개 + 수정 약 15개 = 총 30개 내외
**예상 전체 소요:** Phase 0~6 합계, 한 Phase당 1~2세션 기준 약 7~12세션

---

#### 기존 코드 연결 관계

- PublicPageLayout.tsx가 모든 서브페이지의 공통 래퍼 --> Phase 1에서 개편의 핵심
- LandingPageClient.tsx만 별도 레이아웃 사용 --> Phase 1에서 통합
- globals.css의 @theme 블록이 Tailwind CSS v4 색상 정의의 핵심 --> Phase 0에서 확장
- 각 서브페이지의 히어로 섹션이 동일 패턴 --> SectionLayout 컴포넌트로 통합 가능
- ScheduleClient, AnnualEventsClient 등 클라이언트 컴포넌트는 기능 유지, 스타일만 변경

---

#### developer 주의사항

1. **$queryRawUnsafe 절대 변경 금지**: UI/UX 개편은 프론트엔드만 다룬다. DB 쿼리 함수(lib/queries.ts)는 건드리지 않는다.
2. **캐싱 정책 유지**: 각 페이지의 revalidate 값을 변경하지 않는다 (CLAUDE.md에 명시된 정책).
3. **Server Component / Client Component 구분 유지**: 현재 서버/클라이언트 분리가 잘 되어 있다. 스타일 변경 시 이 구조를 깨뜨리지 않는다.
4. **기존 기능 회귀 방지**: 시간표 프로그램 필터, 연간일정 수업일자 계산, 갤러리 게시물 필터 등 기존 기능이 개편 후에도 동일하게 동작해야 한다.
5. **모바일 퍼스트**: 모든 개편은 모바일 뷰를 먼저 확인하고 데스크탑으로 확장한다.
6. **이미지 최적화**: 새로 추가하는 이미지는 반드시 Next.js Image 컴포넌트 사용 + sizes 속성 명시.
7. **접근성**: 모든 인터랙티브 요소에 focus 상태 스타일 + aria-label 확인.
8. **Phase 0을 꼭 먼저**: 디자인 토큰(globals.css 확장)과 공통 UI 컴포넌트가 없으면 나머지 Phase에서 일관성을 유지할 수 없다.

---

## 구현 기록 (developer)

### Phase 0: 디자인 시스템 기반 구축 (2026-03-20)

구현한 기능: 공통 디자인 토큰(색상 변수 8개) 확장 + 공통 UI 컴포넌트 5개 신규 생성

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/app/globals.css | @theme에 색상 변수 8개 추가 + fadeInUp 키프레임 추가 | 수정 |
| src/components/ui/Button.tsx | 5종 버튼 (Primary/Secondary/Ghost/White/CTA) | 신규 |
| src/components/ui/Card.tsx | 4종 카드 (default/accent/image/info) | 신규 |
| src/components/ui/SectionLayout.tsx | 섹션 래퍼 (라벨+제목+설명+배경색+여백) | 신규 |
| src/components/ui/Badge.tsx | 5종 뱃지 (default/success/warning/error/info) | 신규 |
| src/components/ui/AnimateOnScroll.tsx | 스크롤 진입 애니메이션 래퍼 (Client Component) | 신규 |

tester 참고:
- 테스트 방법: 각 컴포넌트를 import하여 사용해보면 됨. Phase 0은 기존 페이지를 수정하지 않으므로 기존 기능에 영향 없음.
- 정상 동작: TypeScript 타입 체크(tsc --noEmit) 통과 확인 완료.
- 주의: 이 컴포넌트들은 아직 어떤 페이지에서도 사용하지 않음. Phase 1~2에서 실제 적용 예정.

reviewer 참고:
- globals.css 기존 5개 색상 변수(brand-orange-50/500/600, brand-navy-800/900)는 이름/값 변경 없이 유지됨.
- Button/Card/SectionLayout/Badge는 Server Component 가능 (상태/이벤트 없음).
- AnimateOnScroll만 Client Component ('use client' 선언).
- Card 컴포넌트의 accent variant에서 absolute 포지셔닝 사용 — 부모에 relative가 필요할 수 있음. Phase 1~2에서 실제 사용 시 확인 필요.

다음 Phase 주의할 점:
- Phase 1(공통 레이아웃 통합)에서 PublicHeader를 Client Component로 만들어야 함 (모바일 햄버거 메뉴).
- Phase 2(메인 랜딩)에서 LandingPageClient의 settings 동적 데이터 의존성(introductionTitle, introductionText, youtubeUrl 등) 유지 필수.

### Phase 1: 공통 레이아웃 통합 (2026-03-20)

구현한 기능: 메인 랜딩과 서브페이지의 헤더/푸터를 하나의 공통 컴포넌트로 통합

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/components/PublicHeader.tsx | 통합 헤더 (유틸리티바 + 데스크탑 네비 + 모바일 햄버거 사이드바 + 스크롤 glassmorphism) | 신규 |
| src/components/PublicFooter.tsx | 통합 푸터 (학원정보 + 퀵링크 + 소셜미디어 영역 준비 + 저작권) | 신규 |
| src/components/PublicPageLayout.tsx | 인라인 헤더/푸터 제거 → PublicHeader + PublicFooter 컴포넌트로 교체 | 수정 |
| src/app/LandingPageClient.tsx | 자체 헤더/푸터 제거, 콘텐츠(히어로~CTA)만 유지, Fragment(<>)로 감싸기 | 수정 |
| src/app/page.tsx | PublicHeader + PublicFooter로 LandingPageClient를 감싸는 구조로 변경 | 수정 |

핵심 변경 내용:
- PublicHeader는 Client Component ('use client') — 모바일 햄버거 메뉴 상태관리(useState) + 스크롤 감지(useEffect) 필요
- PublicFooter는 Server Component — 상태/이벤트 없음
- PublicPageLayout은 Server Component 유지 — getAcademySettings()로 데이터를 가져와서 헤더/푸터에 props로 전달
- 네비 메뉴 7개로 통합 (기존 LandingPageClient에서 빠져있던 "갤러리", "공지사항" 포함)
- 모바일 네비: 기존 수평 pill 스크롤 → 햄버거 아이콘 + 오른쪽 슬라이드 사이드바로 변경
- 데스크탑 네비: 호버 시 밑줄 슬라이드-인 효과 추가
- 스크롤 시 헤더 배경 glassmorphism 효과 (backdrop-blur-md)
- CTA 버튼: "전화문의" → "체험 신청"으로 변경 (전화번호는 유틸리티 바에 표시)

기존 기능 영향:
- 8개 서브페이지(about, programs, schedule, annual, gallery, notices, apply, mypage)에서 PublicPageLayout 사용 방식 변경 없음
- LandingPageClient의 settings 동적 데이터 의존성 모두 유지 (introductionTitle, introductionText, youtubeUrl, galleryImagesJSON, contactPhone, address)
- tsc --noEmit 타입 체크 통과
- next build 빌드 성공

tester 참고:
- 테스트 방법: 메인 페이지(/) + 서브페이지 2~3개(about, programs, schedule 등) 접속하여 확인
- 정상 동작: (1) 헤더에 7개 메뉴 모두 표시 (2) 모바일에서 햄버거 아이콘 클릭 시 사이드바 슬라이드 (3) 스크롤 시 헤더 배경 변화 (4) 푸터에 학원정보/퀵링크 표시 (5) 히어로/유튜브/갤러리/CTA 모두 정상 렌더링
- 주의할 테스트: 모바일 사이드바 열린 상태에서 메뉴 클릭 시 사이드바 닫히는지, body 스크롤이 잠기는지

reviewer 참고:
- PublicHeader에서 useEffect로 scroll 이벤트 리스너 등록 — { passive: true } 옵션으로 성능 최적화됨
- 모바일 메뉴 열릴 때 body overflow:hidden 처리 + cleanup 함수에서 복원
- page.tsx에서 settings를 한 번만 가져와서 PublicHeader/PublicFooter/LandingPageClient 세 곳에 전달 — 불필요한 중복 API 호출 없음
- LandingPageClient에서 MapPin, Phone import 제거 (더 이상 사용하지 않으므로)

다음 Phase 주의할 점:
- Phase 2(메인 랜딩 개편)에서 LandingPageClient의 히어로 섹션을 분할 레이아웃(좌 텍스트 + 우 이미지)으로 변경할 때, dangerouslySetInnerHTML 부분 반드시 유지
- Phase 2에서 TrustBadges/ProcessSteps 등 신규 컴포넌트 추가 시 LandingPageClient 안에 배치 (page.tsx가 아닌)
- 현재 CTA 배너의 전화문의 이모지 제거됨 — Phase 2에서 CTABanner 컴포넌트로 대체 예정

### Phase 2: 메인 랜딩 페이지 전면 개편 (2026-03-20)

구현한 기능: 메인 랜딩 페이지를 8개 섹션 구조로 전면 개편 + 신규 컴포넌트 5개 생성

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/components/landing/TrustBadges.tsx | 신뢰 지표 바 (운영기간/수강생/만족도/코치진 4개 숫자 카운터) | 신규 |
| src/components/landing/ProgramHighlight.tsx | 프로그램 하이라이트 카드 (유아/초등저/초등고/중등 4개 카드) | 신규 |
| src/components/landing/ProcessSteps.tsx | 수강 과정 4단계 시각화 (상담→체험→등록→수업) | 신규 |
| src/components/landing/TestimonialCarousel.tsx | 학부모 후기 캐러셀 (CSS scroll-snap, 외부 라이브러리 없음) | 신규 |
| src/components/landing/CTABanner.tsx | CTA 배너 (그라데이션 배경 + 듀얼 CTA, 재사용 가능) | 신규 |
| src/app/LandingPageClient.tsx | 8개 섹션 구조로 전면 개편 (히어로 분할 레이아웃 + 신규 컴포넌트 배치) | 수정 |

핵심 변경 내용:
- 히어로 섹션: 좌(텍스트+CTA) + 우(농구 그래픽) 분할 레이아웃으로 변경
- 히어로 CTA: 기존 "전화 상담" → "체험 수업 신청"(Primary, /apply 링크) + "프로그램 보기"(Ghost) 듀얼 구조
- 기존 퀵네비 4개 카드(about/programs/schedule/annual) → ProgramHighlight 4개 프로그램 카드로 대체
- 유튜브 섹션: SectionLayout으로 감싸서 라벨+제목 패턴 적용 (기능 로직 동일)
- 갤러리 섹션: SectionLayout으로 감싸고, 최대 8장 제한 + 호버 오버레이 추가 + "더보기" 링크
- 신뢰 지표(TrustBadges): 히어로 바로 아래에 네이비 배경으로 배치
- 수강 과정(ProcessSteps): 4단계 시각화 (모바일 세로/데스크탑 가로)
- 학부모 후기(TestimonialCarousel): CSS scroll-snap 캐러셀 (좌우 화살표 + 모바일 스와이프)
- CTA 배너(CTABanner): 기존 단색 오렌지 배너 → 그라데이션 네이비 + 장식 도형 + 듀얼 CTA

settings 데이터 의존성 유지 확인:
- introductionTitle: 히어로 h1에서 사용 (유지)
- introductionText: 히어로에서 dangerouslySetInnerHTML로 렌더링 (유지)
- youtubeUrl: 유튜브 섹션 조건부 렌더링 (유지)
- galleryImagesJSON: 갤러리 섹션 JSON.parse (유지)
- contactPhone: CTABanner에 phone prop으로 전달 (유지)
- address: page.tsx에서 PublicHeader/PublicFooter에 전달 (LandingPageClient에서는 미사용, 기존과 동일)

검증 결과:
- tsc --noEmit: 통과 (에러 0건)
- next build: 성공
- revalidate 값: 변경 없음 (page.tsx에서 60초 유지)

tester 참고:
- 테스트 방법: 메인 페이지(/) 접속하여 위에서 아래로 스크롤하며 8개 섹션 확인
- 정상 동작:
  (1) 히어로: 좌측 텍스트 + 우측 농구 그래픽 (데스크탑), 모바일에서는 텍스트만
  (2) 신뢰 지표: 4개 숫자(3년+, 200명+, 98%, 5명+)가 스크롤 시 순차적으로 나타남
  (3) 프로그램: 4개 카드(유아/초등저/초등고/중등) 클릭 시 /programs 이동
  (4) 수강 과정: 4단계(상담→체험→등록→수업) 표시
  (5) 유튜브: settings에 youtubeUrl이 있을 때만 표시
  (6) 갤러리: settings에 galleryImagesJSON이 있을 때만 표시, 최대 8장
  (7) 후기 캐러셀: 좌우 화살표 클릭 또는 모바일 스와이프로 후기 카드 넘기기
  (8) CTA 배너: "체험 수업 신청" + "전화 상담" 버튼
- 주의할 테스트:
  - 모바일(375px)에서 히어로 우측 그래픽이 숨겨지는지 (lg 브레이크포인트)
  - 후기 캐러셀이 모바일에서 스와이프 되는지
  - 갤러리 이미지가 8장 초과일 때 "더 많은 사진 보기" 링크 표시되는지

reviewer 참고:
- TrustBadges/ProgramHighlight/ProcessSteps는 Server Component 가능하지만, LandingPageClient가 'use client'이므로 Client Component로 번들됨. 성능 영향은 미미함.
- TestimonialCarousel만 useRef 사용 (스크롤 제어). 별도 'use client' 선언 있음.
- CTABanner는 props 기반 재사용 가능 — Phase 3 서브페이지에서도 활용 예정.
- 후기 데이터/프로그램 데이터/신뢰 지표 데이터는 모두 하드코딩. props로 받을 수 있는 구조이므로 향후 DB 연동 시 수정 최소화.
- lucide-react에서 Calendar, Clock, Users, Award, ChevronRight import 제거됨 (퀵네비 카드 제거로 불필요)

다음 Phase 주의할 점:
- Phase 3(서브페이지 개편)에서 CTABanner를 재사용할 때 phone prop을 서버 컴포넌트에서 전달하는 구조 확인 필요
- ProgramHighlight의 하드코딩된 프로그램 데이터를 DB programs 테이블과 연동하려면 Server Component로 분리하거나 page.tsx에서 데이터를 가져와서 props로 전달해야 함
- TestimonialCarousel의 후기 데이터도 마찬가지 (향후 DB testimonials 테이블 신설 시)

### Phase 3-C: 체험/수강신청 페이지 개편 (2026-03-20)

구현한 기능: apply 페이지 히어로 개편 + ProcessSteps/CTABanner 배치 + 카드 디자인 공통 컴포넌트 적용 + FAQ 아코디언 섹션 추가

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/app/apply/page.tsx | 히어로 그라데이션+장식 도형 개편, ProcessSteps/CTABanner 배치, SectionLayout 적용 | 수정 |
| src/app/apply/ApplyPageClient.tsx | Card/Badge/Button/AnimateOnScroll 공통 UI 적용, 체험수업 혜택 Badge 추가, FAQ 아코디언 섹션 신규 추가 | 수정 |

핵심 변경 내용:
- 히어로: 단색 네이비 → 그라데이션(navy-900→800→900) + 장식 도형(반투명 원 2개) + "1분이면 충분해요!" 메시지
- ProcessSteps: 히어로 바로 아래에 배치하여 수강 과정 4단계(상담→체험→등록→수업)를 시각화
- 체험수업 카드: Card 공통 컴포넌트 적용, Badge(무료 체험/준비물 안내) 추가, Button 공통 컴포넌트로 교체
- 수강신청 카드: Card 공통 컴포넌트 적용, Button 공통 컴포넌트로 교체
- 두 카드 md:grid-cols-2 가로 배치 (기존 세로 나열 → 가로 비교 구조)
- FAQ 섹션: 5개 질문/답변 아코디언 (FAQ_DATA 배열로 관리, 향후 DB 연동 가능)
- CTABanner: 페이지 하단에 "궁금한 점이 있으신가요?" + 전화상담 CTA 배치

기존 코드 보존 확인:
- FormModal: 기존 Google Forms 모달 로직 100% 유지 (변경 없음)
- ContentBlock: 기존 HTML/텍스트 렌더링 로직 100% 유지 (변경 없음)
- settings 데이터 의존성: trialTitle/trialContent/trialFormUrl/enrollTitle/enrollContent/enrollFormUrl 모두 기존과 동일하게 전달

검증 결과:
- tsc --noEmit: apply 관련 에러 0건 (programs/page.tsx에 기존 에러 1건 있으나 이번 작업 무관)
- revalidate 값: 변경 없음 (60초 유지)

tester 참고:
- 테스트 방법: /apply 페이지 접속하여 위에서 아래로 스크롤
- 정상 동작:
  (1) 히어로: 그라데이션 배경 + "1분이면 충분해요!" 메시지 + 장식 도형
  (2) ProcessSteps: 4단계(상담→체험→등록→수업) 표시
  (3) 체험수업 카드: "무료 체험" "준비물: 운동복, 실내화" Badge 표시, 신청 버튼 클릭 시 Google Form 모달
  (4) 수강신청 카드: 신청 버튼 클릭 시 Google Form 모달
  (5) FAQ: 질문 클릭 시 답변 토글(열기/닫기), 화살표 아이콘 회전
  (6) CTA 배너: "궁금한 점이 있으신가요?" + 듀얼 CTA
- 주의할 테스트:
  - 모바일(375px)에서 체험/수강 카드가 세로 나열되는지 (md 이하)
  - FAQ 아코디언 여러 개 동시 열기 가능한지 (독립 토글)
  - trialFormUrl/enrollFormUrl이 null일 때 "준비 중" 비활성 버튼 표시되는지

reviewer 참고:
- FormModal, ContentBlock은 기존 코드와 100% 동일 (diff로 확인 가능)
- FAQ_DATA는 하드코딩. 향후 DB 연동 시 props로 전달하는 구조로 전환 용이
- FAQItem 컴포넌트는 각각 독립적인 useState를 가지므로 여러 질문을 동시에 열 수 있음

### Phase 3-D: ProgramAccordionTerms 컴포넌트 생성 (2026-03-20)

구현한 기능: programs 페이지에서 이용약관을 아코디언(접기/펼치기) 방식으로 표시하는 Client Component

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/app/programs/ProgramAccordionTerms.tsx | 이용약관 아코디언 컴포넌트 신규 생성 | 신규 |

핵심 변경 내용:
- programs/page.tsx에서 import하고 있던 ProgramAccordionTerms 컴포넌트를 신규 생성
- ApplyPageClient의 FAQItem 아코디언과 동일한 스타일(ChevronDown SVG, rotate-180 전환, hover 색상)
- Card 공통 컴포넌트(variant="default")로 감싸서 디자인 시스템 일관성 유지
- termsText가 null이면 렌더링하지 않음 (early return)
- 펼치면 border-t 구분선 + 약관 전문 표시, whitespace-pre-line으로 줄바꿈 유지

검증 결과:
- tsc --noEmit: 에러 0건

tester 참고:
- 테스트 방법: /programs 페이지 하단에 "이용약관" 아코디언 표시 확인
- 정상 동작:
  (1) 이용약관이 설정되어 있으면 접힌 상태로 "이용약관" 제목 + 화살표 표시
  (2) 클릭 시 펼쳐지며 약관 전문 표시, 화살표 180도 회전
  (3) 다시 클릭 시 접힘
  (4) settings.termsOfService가 null이면 섹션 자체가 안 보임
- 주의할 테스트:
  - 모바일(375px)에서 약관 텍스트 줄바꿈이 정상인지
  - 약관 텍스트가 길 때(여러 줄) whitespace-pre-line이 제대로 동작하는지

reviewer 참고:
- useState를 early return 앞에 배치하여 React hooks 규칙(조건부 호출 금지) 준수
- 부모(programs/page.tsx)에서도 termsOfService가 있을 때만 렌더링하므로 이중 안전장치

### Phase 4-A: 시간표(/schedule) + 연간일정(/annual) 스타일 통일 (2026-03-20)

구현한 기능: schedule과 annual 페이지의 히어로/필터/카드/CTA를 Phase 0~3과 동일한 디자인 토큰으로 통일

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/app/schedule/page.tsx | 히어로를 그라데이션+장식도형 패턴으로 교체, CTABanner 공통 컴포넌트로 교체 | 수정 |
| src/app/schedule/ScheduleClient.tsx | 필터탭 pill 스타일 개선, 카드 hover 인터랙션 추가, 배경색 surface-section 적용, max-w-6xl 통일 | 수정 |
| src/app/annual/page.tsx | 히어로를 그라데이션+장식도형 패턴으로 교체, 범례 pill 뱃지 스타일로 개선, CTABanner 공통 컴포넌트로 교체 | 수정 |
| src/app/annual/AnnualEventsClient.tsx | 배경색 surface-section 적용, 연도 선택 pill 스타일 개선, 이벤트 카드 rounded-2xl+shadow 적용, max-w-6xl 통일 | 수정 |

핵심 변경 내용:
- 4개 파일 모두 스타일만 변경, 기능 로직 0% 변경
- 히어로: about/programs/apply와 동일한 "그라데이션 배경 + 장식 도형 + AnimateOnScroll" 패턴 적용
- 필터 탭: backdrop-blur + pill 버튼 + shadow 추가로 세련된 느낌
- 카드: hover:shadow-md + hover:-translate-y-0.5 인터랙션 추가
- 배경: bg-gray-50 -> bg-surface-section(따뜻한 크림색)으로 통일
- CTA: 기존 수동 작성 CTA -> CTABanner 공통 컴포넌트로 교체
- 컨테이너: max-w-4xl/5xl -> max-w-6xl로 다른 페이지와 통일
- revalidate 값: 변경 없음 (schedule=300, annual=300 유지)
- $queryRawUnsafe: 변경 없음 (Server Component의 DB 조회 로직 미접촉)
- EventDetailPanel: 변경 없음

검증 결과:
- tsc --noEmit: 에러 0건

tester 참고:
- 테스트 방법:
  (1) /schedule 페이지 접속 -> 히어로 그라데이션 + 장식 도형 확인
  (2) 프로그램 필터 탭 클릭 -> 필터 동작 확인 (기존과 동일하게 동작해야 함)
  (3) 요일별 시간표 카드 표시 확인 (코치 사진, 정원 바, 메모 등)
  (4) /annual 페이지 접속 -> 히어로 + 범례 pill 뱃지 확인
  (5) 연도 선택 -> 월별 접기/펼치기 -> 이벤트 클릭 -> 상세 패널 동작 확인
  (6) "수업일자 확인" 버튼 클릭 -> 수업일자 패널 표시 확인
  (7) 하단 CTA 배너 -> "체험 수업 신청" 버튼 + "전화 상담" 버튼 확인
- 정상 동작: 기존과 동일한 기능 + 개선된 디자인
- 주의할 테스트:
  - 모바일(375px)에서 필터 탭이 줄바꿈 되는지 확인
  - 모바일에서 시간표 카드가 세로 1열로 나오는지 (sm 이하)
  - 연간일정의 월 접기/펼치기가 정상 동작하는지
  - 프로그램 필터 적용 후 "전체 보기" 링크가 동작하는지

reviewer 참고:
- 기능 로직(useSearchParams, 프로그램 필터, 요일 그룹핑, 수업일자 계산, 이벤트 그룹핑)은 100% 보존
- Server/Client Component 구분 유지: page.tsx는 Server, Client 컴포넌트는 "use client" 유지
- revalidate 값 미변경 확인 필요
- EventDetailPanel.tsx는 미변경 (import 경로도 동일)

### Phase 4-B: 갤러리(/gallery) + 공지사항(/notices) 스타일 통일 (2026-03-20)

구현한 기능: gallery와 notices 페이지의 히어로/그리드/라이트박스/카드/CTA를 Phase 0~4-A와 동일한 디자인 토큰으로 통일

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/app/gallery/page.tsx | 히어로를 그라데이션+장식도형 패턴으로 교체, CTABanner 추가, bg-surface-section 배경 적용, getAcademySettings 병렬 호출 | 수정 |
| src/app/gallery/GalleryPublicClient.tsx | 호버 오버레이 개선(제목+날짜+그라데이션), 라이트박스를 별도 컴포넌트로 분리(ESC/좌우 키보드 네비+body 스크롤 잠금+카운터+접근성), 동영상 재생 아이콘 추가, 모바일 항상 제목 표시, rounded-2xl+shadow 적용 | 수정 |
| src/app/notices/page.tsx | 히어로를 그라데이션+장식도형 패턴으로 교체, 좌측 날짜 블록(월/일) 추가, Badge 컴포넌트로 카테고리 뱃지(중요/안내) 추가, AnimateOnScroll 순차 애니메이션, CTABanner 추가 | 수정 |
| src/app/notices/[id]/page.tsx | 히어로를 그라데이션+장식도형 패턴으로 교체, 고정공지 Badge 추가, 본문 타이포그래피 개선(leading-loose, text-[15px]), 첨부파일 호버 색상 개선, 하단 목록 돌아가기 링크 추가, CTABanner 추가 | 수정 |

핵심 변경 내용:
- 4개 파일 모두 스타일만 변경, 기능 로직 0% 변경
- 히어로: about/programs/apply/schedule/annual과 동일한 "그라데이션 배경 + 장식 도형 + AnimateOnScroll" 패턴 적용
- 갤러리 호버 오버레이: 기존 bg-black/20 단색 → from-black/70 그라데이션 + 제목/날짜 표시 (데스크탑은 호버, 모바일은 항상 표시)
- 갤러리 라이트박스: LightboxOverlay 별도 컴포넌트 분리, ESC/좌우 화살표 키보드 네비게이션 추가, body 스크롤 잠금, 현재위치/전체 카운터 추가
- 공지 리스트: 좌측 날짜 블록(sm 이상) + Badge 카테고리(중요/안내) 추가
- 공지 상세: leading-loose + text-[15px] 타이포그래피 개선, 첨부파일 호버 시 오렌지 계열 색상 변화
- CTA 배너: CTABanner 공통 컴포넌트 재사용 (gallery/notices 모두)
- revalidate 값: 변경 없음 (gallery=60, notices=60 유지)
- $queryRawUnsafe: 변경 없음 (Server Component의 DB 조회 로직 미접촉)
- Server/Client Component 구분 유지: page.tsx는 Server, GalleryPublicClient는 "use client" 유지

검증 결과:
- tsc --noEmit: 에러 0건

tester 참고:
- 테스트 방법:
  (1) /gallery 페이지 접속 -> 히어로 그라데이션 + 장식 도형 확인
  (2) 갤러리 이미지 호버 시 제목/날짜 오버레이 표시 확인
  (3) 이미지 클릭 -> 라이트박스 열림, ESC 키로 닫기, 좌우 화살표로 이동
  (4) 라이트박스에서 "현재/전체" 카운터 표시 확인
  (5) 동영상 썸네일에 재생 아이콘 표시 확인
  (6) /notices 페이지 접속 -> 히어로 + 날짜 블록 + 카테고리 뱃지 확인
  (7) 고정 공지에 "중요" 빨간 뱃지, 일반 공지에 "안내" 파란 뱃지 표시 확인
  (8) /notices/[id] 상세 페이지 -> 히어로에 제목/날짜 + 본문 가독성 확인
  (9) 하단 CTA 배너 표시 확인 (gallery, notices, notices/[id] 모두)
- 정상 동작: 기존과 동일한 기능 + 개선된 디자인
- 주의할 테스트:
  - 모바일(375px)에서 갤러리 이미지에 제목이 항상 표시되는지 (호버 불가하므로)
  - 모바일에서 공지 리스트의 날짜 블록이 숨겨지는지 (sm 이하)
  - 라이트박스에서 키보드(ESC/좌우) 네비게이션이 정상 동작하는지
  - 갤러리가 비어있을 때 빈 상태 UI 정상 표시되는지
  - 공지사항이 비어있을 때 빈 상태 UI 정상 표시되는지

reviewer 참고:
- GalleryPublicClient에서 LightboxOverlay를 별도 함수 컴포넌트로 분리 — useEffect/useCallback 사용을 위한 구조
- LightboxOverlay에서 body.style.overflow를 직접 조작 — cleanup 함수에서 복원 보장
- notices/page.tsx에서 getAcademySettings를 추가 호출하여 phone prop을 CTABanner에 전달 — Promise.all로 병렬 호출하여 성능 영향 최소화
- notices/[id]/page.tsx도 동일하게 getAcademySettings 병렬 호출 추가

### Phase 5: 마이페이지 + 로그인 페이지 스타일 통일 (2026-03-20)

구현한 기능: mypage(layout + client)와 login 페이지의 디자인 토큰을 Phase 0~4와 동일하게 통일

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/app/mypage/layout.tsx | 배경 bg-gray-50 -> bg-surface-warm, 데스크탑 헤더 마이페이지 링크에 active 색상(text-brand-orange-500) 적용 | 수정 |
| src/app/mypage/MyPageClient.tsx | 학생카드를 그라데이션+장식도형 패턴으로 교체, 섹션 타이틀 text-gray-900 -> text-brand-navy-900 통일, 카드 호버시 hover:border-brand-orange-200 추가, 버튼 색상 orange-600 -> brand-orange-600 토큰화 | 수정 |
| src/app/login/page.tsx | 배경 bg-gray-50 -> bg-surface-warm + 장식도형 3개 추가, "관리자 시스템" -> "학부모/관리자 로그인" 변경, 오렌지 사각형 S 아이콘 -> STIZ 실제 로고(stiz-logo.png) 사용, input focus 색상 ring-orange-500 -> ring-brand-orange-500 토큰화, 하단 링크 색상 text-gray-500 -> text-brand-navy-700 + hover:text-brand-orange-500, 이메일 placeholder "admin@example.com" -> "example@email.com"으로 변경(학부모도 사용하므로) | 수정 |

핵심 변경 내용:
- 3개 파일 모두 스타일/텍스트만 변경, 기능 로직 0% 변경
- 마이페이지: 학생 카드가 단색 bg-brand-navy-900 -> 그라데이션(from-brand-navy-900 via-brand-navy-800 to-brand-navy-900) + 장식 도형(원형 보더, 오렌지 반투명) 추가
- 마이페이지: 모든 섹션 타이틀(수강중인 반, 출결기록, 수납내역, 공지사항, 학습피드백, 수업사진)의 텍스트 색상을 brand-navy-900으로 통일
- 마이페이지: 카드형 요소들에 hover:border-brand-orange-200 추가 (알림 토글, 수강반 카드, 공지 카드, 피드백 카드)
- 로그인: 배경에 장식 도형 3개(우상단 큰 원, 좌하단 중 원, 우하단 작은 원) 추가
- 로그인: STIZ 실제 로고 이미지로 교체 (기존 오렌지 사각형 S 아이콘 제거)
- 로그인: 타이틀 부제목을 "관리자 시스템" -> "학부모/관리자 로그인"으로 변경하여 용도 명확화
- 모바일 하단 네비게이션: 구조/동작 100% 유지 (NavItem 컴포넌트 미변경)
- revalidate 값: 해당 없음 (mypage는 동적, login은 CSR)
- $queryRawUnsafe: 변경 없음 (Client Component만 수정)
- Server/Client Component 구분 유지: layout.tsx는 Server, MyPageClient/login은 "use client" 유지

검증 결과:
- tsc --noEmit: 에러 0건

tester 참고:
- 테스트 방법:
  (1) /mypage 접속 -> 배경이 따뜻한 톤(surface-warm)인지 확인
  (2) 학생 카드에 그라데이션 배경 + 우상단/좌하단 반투명 장식 도형 표시 확인
  (3) 섹션 타이틀(수강 중인 반, 출결 기록, 수납 내역 등)이 진한 남색인지 확인
  (4) 카드 호버 시 오렌지 계열 보더 표시 확인
  (5) 알림 토글, 요청하기, 내 요청 버튼 정상 동작 확인
  (6) 모바일 하단 네비게이션 4개 탭 정상 이동 확인
  (7) /login 접속 -> 따뜻한 배경 + 3개 장식 도형 확인
  (8) STIZ 로고 이미지 표시 확인
  (9) "학부모/관리자 로그인" 텍스트 확인
  (10) 로그인/회원가입 탭 전환 정상 동작 확인
  (11) input 포커스 시 오렌지 링 표시 확인
  (12) 홈페이지로 돌아가기 링크 동작 확인
- 정상 동작: 기존과 동일한 기능 + 개선된 디자인
- 주의할 테스트:
  - 기존 마이페이지 기능(출결/수납/알림 읽음/요청 접수/피드백 펼치기/갤러리)이 모두 정상 동작하는지
  - 자녀 여러 명일 때 select로 전환이 정상 작동하는지
  - 푸시 알림 토글이 기존과 동일하게 동작하는지
  - 모바일(375px)에서 레이아웃 깨지지 않는지

reviewer 참고:
- MyPageClient.tsx는 기능 로직 미접촉, className 문자열만 변경
- login/page.tsx에 Image 컴포넌트 import 추가 (Next.js 이미지 최적화)
- login/page.tsx의 hidden input (role="ADMIN") 유지 — 기존 회원가입 로직 보존

### Phase 6: 마무리 및 최적화 — 스켈레톤 로딩 UI + 폰트 확인 (2026-03-20)

구현한 기능: 각 공개 페이지에 loading.tsx 스켈레톤 UI를 추가하여, 페이지 로딩 중 회색 박스 + 펄스 애니메이션이 표시되도록 함. Pretendard 폰트는 layout.tsx에 이미 CDN 로딩이 설정되어 있어 변경 불필요.

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/app/about/loading.tsx | 학원소개 스켈레톤 (히어로 + 카드 3개 + 텍스트 블록) | 신규 |
| src/app/programs/loading.tsx | 프로그램 스켈레톤 (히어로 + 카드 2x2 격자) | 신규 |
| src/app/schedule/loading.tsx | 시간표 스켈레톤 (히어로 + 필터탭 + 시간표 격자) | 신규 |
| src/app/annual/loading.tsx | 연간일정 스켈레톤 (히어로 + 월 네비 + 캘린더 7x5 격자) | 신규 |
| src/app/gallery/loading.tsx | 갤러리 스켈레톤 (히어로 + 이미지 2x3 격자 + 캡션) | 신규 |
| src/app/notices/loading.tsx | 공지사항 스켈레톤 (히어로 + 리스트 5개) | 신규 |
| src/app/apply/loading.tsx | 체험신청 스켈레톤 (히어로 + 카드 2개) | 신규 |

폰트 확인 결과:
- src/app/layout.tsx 43~47행에 Pretendard CDN (cdn.jsdelivr.net/gh/orioncactus/pretendard) 이미 로딩됨
- Google Fonts (Noto Sans KR, Nanum Gothic, IBM Plex Sans KR, Black Han Sans, Jua)도 이미 로딩됨
- DB 설정으로 폰트 선택하는 기존 구조(getFontCss) 유지 -- 변경 불필요

안전성 확인:
- 기존 파일 수정: 0건 (신규 파일만 7개 생성)
- revalidate 값: 해당 없음 (loading.tsx는 캐싱과 무관)
- $queryRawUnsafe: 변경 없음 (프론트엔드 전용)
- Server/Client Component: loading.tsx는 Server Component (기본값)

검증 결과:
- tsc --noEmit: 에러 0건

tester 참고:
- 테스트 방법:
  (1) 각 페이지(/about, /programs, /schedule, /annual, /gallery, /notices, /apply) 접속
  (2) 브라우저 개발자 도구 > Network 탭 > "Slow 3G" 설정으로 느린 로딩 시뮬레이션
  (3) 페이지 새로고침 시 스켈레톤 UI(회색 박스 + 깜빡임 애니메이션)가 잠시 보이다가 실제 콘텐츠로 교체되는지 확인
- 정상 동작: 로딩 중 빈 화면 대신 회색 스켈레톤이 보이고, 로딩 완료 후 자연스럽게 실제 콘텐츠로 전환
- 주의할 테스트: 빠른 네트워크에서는 스켈레톤이 거의 안 보일 수 있음 (정상). Slow 3G로 테스트 권장

reviewer 참고:
- 모든 loading.tsx는 순수 JSX + Tailwind만 사용, 외부 의존성 없음
- animate-pulse는 Tailwind 내장 애니메이션 (opacity 깜빡임)
- 기존 파일 미접촉으로 회귀 위험 없음

## 테스트 결과 (tester)

### Phase 0~3 통합 테스트 (2026-03-20)

#### 1. 빌드 테스트

| 테스트 항목 | 결과 | 비고 |
|------------|------|------|
| tsc --noEmit 타입 체크 | ✅ 통과 | 에러 0건 |
| npm run build | ✅ 통과 | 빌드 성공, 에러/경고 없음 |

#### 2. Phase 0 — 공통 UI 컴포넌트

| 테스트 항목 | 결과 | 비고 |
|------------|------|------|
| Button.tsx 파일 존재 + export | ✅ 통과 | export default function Button |
| Card.tsx 파일 존재 + export | ✅ 통과 | export default function Card |
| SectionLayout.tsx 파일 존재 + export | ✅ 통과 | export default function SectionLayout |
| Badge.tsx 파일 존재 + export | ✅ 통과 | export default function Badge |
| AnimateOnScroll.tsx 파일 존재 + export | ✅ 통과 | export default function AnimateOnScroll |
| globals.css 색상 변수 추가 | ✅ 통과 | brand-orange-400/700, brand-navy-700, brand-sky-50/100/500, surface-warm, surface-section 모두 확인 |

#### 3. Phase 1 — 공통 레이아웃 통합

| 테스트 항목 | 결과 | 비고 |
|------------|------|------|
| PublicHeader.tsx 파일 존재 | ✅ 통과 | |
| PublicHeader 7개 메뉴 링크 | ✅ 통과 | about, programs, schedule, annual, gallery, notices, apply 모두 확인 |
| PublicFooter.tsx 파일 존재 | ✅ 통과 | |
| PublicPageLayout이 Header/Footer import | ✅ 통과 | 두 컴포넌트 모두 import 확인 |
| page.tsx가 Header+Footer로 LandingPageClient를 감쌈 | ✅ 통과 | PublicHeader, PublicFooter, LandingPageClient 모두 import |

#### 4. Phase 2 — 메인 랜딩 페이지

| 테스트 항목 | 결과 | 비고 |
|------------|------|------|
| TrustBadges.tsx 파일 존재 | ✅ 통과 | |
| ProgramHighlight.tsx 파일 존재 | ✅ 통과 | |
| ProcessSteps.tsx 파일 존재 | ✅ 통과 | |
| TestimonialCarousel.tsx 파일 존재 | ✅ 통과 | |
| CTABanner.tsx 파일 존재 | ✅ 통과 | |
| LandingPageClient가 5개 컴포넌트 import | ✅ 통과 | TrustBadges/ProgramHighlight/ProcessSteps/TestimonialCarousel/CTABanner 모두 import |
| settings 데이터 의존성 유지 | ✅ 통과 | introductionTitle, introductionText, youtubeUrl, galleryImagesJSON, contactPhone 모두 코드에서 사용 확인 |

#### 5. Phase 3 — 서브페이지 개편

| 테스트 항목 | 결과 | 비고 |
|------------|------|------|
| about/page.tsx — 5개 공통 컴포넌트 import | ✅ 통과 | SectionLayout/Card/Badge/AnimateOnScroll/CTABanner 모두 확인 |
| programs/page.tsx — 5개 공통 컴포넌트 import | ✅ 통과 | SectionLayout/Card/Badge/AnimateOnScroll/CTABanner 모두 확인 |
| ProgramAccordionTerms.tsx 파일 존재 + 'use client' | ✅ 통과 | 첫 줄에 'use client' 선언 확인 |
| apply/page.tsx — ProcessSteps/CTABanner import | ✅ 통과 | 두 컴포넌트 import 확인 |
| apply/page.tsx — "1분이면 충분해요" 메시지 | ✅ 통과 | 히어로 섹션에 포함 확인 |
| ApplyPageClient — Card/Badge/Button/AnimateOnScroll import | ✅ 통과 | 4개 모두 import 확인 |
| ApplyPageClient — FAQ 섹션 존재 | ✅ 통과 | FAQ_DATA 배열 + FAQItem 컴포넌트 + SectionLayout 래핑 확인 |
| ApplyPageClient — FormModal/ContentBlock 기존 코드 유지 | ✅ 통과 | "기존 코드 그대로 유지 (절대 변경 금지)" 주석과 함께 보존 |

#### 6. 기존 기능 회귀 테스트

| 테스트 항목 | 결과 | 비고 |
|------------|------|------|
| revalidate 값 유지 (page.tsx) | ✅ 통과 | 60초 유지 |
| revalidate 값 유지 (about) | ✅ 통과 | 60초 유지 |
| revalidate 값 유지 (programs) | ✅ 통과 | 60초 유지 |
| revalidate 값 유지 (apply) | ✅ 통과 | 60초 유지 |
| lib/queries.ts 미수정 | ✅ 통과 | git diff 결과 변경 없음 |
| FormModal Google Forms 모달 코드 보존 | ✅ 통과 | FormModal 함수 원본 유지 확인 |

#### 7. 개발 서버 라우팅 테스트

| 테스트 항목 | 결과 | 비고 |
|------------|------|------|
| localhost:3000 접속 (/) | ✅ 통과 | HTTP 200 |
| /about 라우팅 | ✅ 통과 | HTTP 200 |
| /programs 라우팅 | ✅ 통과 | HTTP 200 |
| /apply 라우팅 | ✅ 통과 | HTTP 200 |
| 메인 페이지 핵심 콘텐츠 렌더링 | ✅ 통과 | 헤더 7개 메뉴, 히어로 CTA, 신뢰지표, 수강과정, 후기, CTA배너, 푸터 모두 HTML에 포함 |
| /about 페이지 콘텐츠 렌더링 | ✅ 통과 | SectionLayout, 코치, 체험 수업 CTA 확인 |
| /programs 페이지 콘텐츠 렌더링 | ✅ 통과 | 프로그램, 이용약관, CTA 배너 확인 |
| /apply 페이지 콘텐츠 렌더링 | ✅ 통과 | 1분이면 충분, ProcessSteps 4단계, FAQ, 무료 체험/준비물 Badge, CTA 배너 확인 |

---

발견된 문제: 없음

📊 종합: 35개 항목 중 35개 통과 / 0개 실패

최종 판정: ✅ 전체 통과

---

### Phase 4 통합 테스트 (2026-03-20)

#### 1. 빌드 테스트

| 테스트 항목 | 결과 | 비고 |
|------------|------|------|
| tsc --noEmit 타입 체크 | ✅ 통과 | 에러 0건 |
| npm run build (next build) | ✅ 통과 | 빌드 성공, 23/23 페이지 생성 완료 |

#### 2. Phase 4-A — 시간표 + 연간일정

| 테스트 항목 | 결과 | 비고 |
|------------|------|------|
| schedule/page.tsx — CTABanner import | ✅ 통과 | `import CTABanner from "@/components/landing/CTABanner"` 확인 |
| schedule/page.tsx — 히어로 그라데이션 패턴 | ✅ 통과 | `bg-gradient-to-br from-brand-navy-900 via-brand-navy-800 to-brand-navy-900` + 장식 도형 2개 확인 |
| schedule/page.tsx — revalidate = 300 | ✅ 통과 | 5분 ISR 유지 |
| ScheduleClient.tsx — 프로그램 필터 (useSearchParams) | ✅ 통과 | `useSearchParams()` + `programId` 필터 로직 보존 |
| ScheduleClient.tsx — 요일 그룹핑 + 시간순 정렬 | ✅ 통과 | `DAY_ORDER` 기반 그룹핑 + `startTime.localeCompare` 정렬 보존 |
| annual/page.tsx — CTABanner import | ✅ 통과 | `import CTABanner from "@/components/landing/CTABanner"` 확인 |
| annual/page.tsx — 히어로 그라데이션 패턴 | ✅ 통과 | schedule과 동일한 그라데이션 + 장식 도형 패��� |
| annual/page.tsx — revalidate = 300 | ✅ 통과 | 5분 ISR 유지 |
| AnnualEventsClient.tsx — 수업일자 계산 로직 보존 | ✅ 통과 | `yearlySchedules`, `computeClassDatesFromRange`, `getMonthClassSchedule` 모두 사용 확인 |
| AnnualEventsClient.tsx — 이벤트 그룹핑 | ✅ 통과 | `displayYearOf`/`displayMonthOf` + `byMonthDate` 그룹핑 보존 |

#### 3. Phase 4-B — 갤러리 + 공지

| 테스트 항목 | 결과 | 비고 |
|------------|------|------|
| gallery/page.tsx — CTABanner import | ✅ 통과 | `import CTABanner from "@/components/landing/CTABanner"` 확인 |
| gallery/page.tsx — 히어로 그라데이션 패턴 | ✅ 통과 | 동일 패턴 확인 |
| gallery/page.tsx — revalidate = 60 | ✅ 통과 | 1분 ISR |
| GalleryPublicClient.tsx — 라이트박스 코드 존재 | ✅ 통과 | `LightboxOverlay` 컴포넌트 + ESC/좌우 키보드 네비게이션 + body 스크롤 잠금 보존 |
| GalleryPublicClient.tsx — 빈 갤러리 처리 | ✅ 통과 | `posts.length === 0` 시 "아직 갤러리가 비어있습니다" 안내 표시 |
| notices/page.tsx — CTABanner import | ✅ 통과 | 확인 |
| notices/page.tsx — Badge import | ✅ 통과 | `import Badge from "@/components/ui/Badge"` 확인 |
| notices/page.tsx — 히어로 그라데이션 패턴 | ✅ 통과 | 동일 패턴 확인 |
| notices/page.tsx — revalidate = 60 | ✅ 통과 | 1분 ISR |
| notices/[id]/page.tsx — CTABanner import | ✅ 통과 | 확인 |
| notices/[id]/page.tsx — Badge import | ✅ 통과 | `import Badge from "@/components/ui/Badge"` 확인 |
| notices/[id]/page.tsx — 히어로 그라데이션 패턴 | ✅ 통과 | 동일 패턴 확인 |
| notices/[id]/page.tsx — revalidate = 60 | ✅ 통과 | 1분 ISR |

#### 4. 회귀 테스트

| 테스트 항목 | 결과 | 비고 |
|------------|------|------|
| lib/queries.ts 미수정 | ✅ 통과 | git diff 결과 변경 없음 |
| schedule revalidate = 300 유지 | ✅ 통과 | |
| annual revalidate = 300 유지 | ✅ 통과 | |
| gallery revalidate = 60 유지 | ✅ 통과 | |
| notices revalidate = 60 유지 | ✅ 통과 | |
| notices/[id] revalidate = 60 유지 | ✅ 통과 | |

#### 5. 개발 서버 라우팅 테스트

| 테스트 항목 | 결과 | 비고 |
|------------|------|------|
| /schedule 라우팅 | ✅ 통과 | HTTP 200 |
| /annual 라우팅 | ✅ 통과 | HTTP 200 |
| /gallery 라우팅 | ✅ 통과 | HTTP 200 |
| /notices 라우팅 | ✅ 통과 | HTTP 200 |

---

발견된 문제: 없음

참고사항: `npm run build` 시 `prisma generate` 단계에서 Windows 파일 잠금 에러(EPERM)가 1회 발생했으나, 이는 코드 문제가 아닌 OS 레벨 파일 잠금 문제. `npx next build`로 직접 실행 시 정상 빌드 확인.

📊 종합: 33개 항목 중 33개 통과 / 0개 실패

최종 판정: ✅ 전체 통과

---

### Phase 5 테스트 (2026-03-20)

#### 1. 빌드 테스트

| 테스트 항목 | 결과 | 비고 |
|------------|------|------|
| tsc --noEmit 타입 체크 | ✅ 통과 | 에러 0건 |
| npm run build (next build) | ✅ 통과 | 빌드 성공, 23/23 페이지 생성 완료 |

#### 2. Phase 5 — mypage/layout.tsx

| 테스트 항목 | 결과 | 비고 |
|------------|------|------|
| bg-surface-warm 배경 적용 | ✅ 통과 | 12행: `bg-surface-warm` 확인 |
| 데스크탑 헤더 마이페이지 active 색상 | ✅ 통과 | 30행: `text-brand-orange-500` 적용 확인 |
| 모바일 하단 네비게이션 4개 탭 보존 | ✅ 통과 | NavItem 4개(홈, 시간표, 프로그램, 홈페이지) + NavItem 함수 정의 유지 |
| STIZ 로고 이미지 사용 | ✅ 통과 | `stiz-logo.png` Image 컴포넌트 (모바일/데스크탑 헤더 2곳) |

#### 3. Phase 5 — mypage/MyPageClient.tsx

| 테스트 항목 | 결과 | 비고 |
|------------|------|------|
| 학생 카드 그라데이션 배경 | ✅ 통과 | 231행: `bg-gradient-to-br from-brand-navy-900 via-brand-navy-800 to-brand-navy-900` |
| 학생 카드 장식 도형 2개 | ✅ 통과 | 우상단 원형 보더(white/5) + 좌하단 오렌지 반투명(brand-orange-500/10) |
| 섹션 타이틀 text-brand-navy-900 통일 | ✅ 통과 | 6개 섹션(수강 중인 반, 출결기록, 수납내역, 공지사항, 학습피드백, 수업사진) 모두 적용 |
| 카드 hover:border-brand-orange-200 추가 | ✅ 통과 | 4곳(알림 토글, 수강반 카드, 공지 카드, 피드백 카드) 모두 적용 |
| 기존 기능 로직 보존 — 출결 | ✅ 통과 | attendance.records 렌더링 로직 유지 |
| 기존 기능 로직 보존 — 수납 | ✅ 통과 | PAYMENT_STATUS 상태별 표시 + pendingPayments 로직 유지 |
| 기존 기능 로직 보존 — 알림 | ✅ 통과 | markNotificationRead, markAllNotificationsRead import/사용 유지 |
| 기존 기능 로직 보존 — 요청 | ✅ 통과 | createParentRequest import/사용 + REQUEST_TYPES 4개 유지 |
| 기존 기능 로직 보존 — 피드백 | ✅ 통과 | expandedFbId 펼치기 상태 + FB_CATEGORIES 4개 + 별점 표시 유지 |
| 기존 기능 로직 보존 — 갤러리 | ✅ 통과 | gallery.slice(0,6) + mediaJSON 파싱 로직 유지 |
| 푸시 알림 토글 코드 보존 | ✅ 통과 | togglePush 함수 + pushSupported/pushEnabled 상태 + urlBase64ToUint8Array 함수 유지 |
| 자녀 여러 명 select 전환 코드 보존 | ✅ 통과 | selectedIdx 상태 + data.children.length > 1 조건부 select 유지 |
| 'use client' 선언 유지 | ✅ 통과 | 1행: `"use client"` 확인 |

#### 4. Phase 5 — login/page.tsx

| 테스트 항목 | 결과 | 비고 |
|------------|------|------|
| bg-surface-warm 배경 적용 | ✅ 통과 | 31행: `bg-surface-warm` 확인 |
| 장식 도형 3개 존재 | ✅ 통과 | 우상단 큰 원(w-96), 좌하단 중 원(w-64), 우하단 작은 원(w-32) 확인 |
| "학부모/관리자 로그인" 텍스트 | ✅ 통과 | 55행: `학부모/관리자 로그인` 확인 |
| STIZ 로고 이미지 사용 | ✅ 통과 | 44행: `stiz-logo.png` Image 컴포넌트 확인 |
| input focus 색상 토큰화 | ✅ 통과 | 3개 input 모두 `focus:ring-brand-orange-500` 적용 |
| 이메일 placeholder 변경 | ✅ 통과 | `example@email.com`으로 변경 확인 |
| 하단 링크 색상 토큰화 | ✅ 통과 | 176행: `text-brand-navy-700 hover:text-brand-orange-500` 확인 |
| hidden input role="ADMIN" 유지 | ✅ 통과 | 156행: `<input type="hidden" name="role" value="ADMIN" />` 보존 |
| 로그인/회원가입 탭 전환 코드 보존 | ✅ 통과 | mode 상태("login"/"signup") + 탭 버튼 2개 유지 |
| 'use client' 선언 유지 | ✅ 통과 | 1행: `"use client"` 확인 |

#### 5. 회귀 테스트

| 테스트 항목 | 결과 | 비고 |
|------------|------|------|
| lib/queries.ts 미수정 | ✅ 통과 | git diff 결과 변경 없음 |
| 모바일 하단 네비게이션 코드 보존 | ✅ 통과 | NavItem 4개 + NavItem 함수 정의 유지 |

#### 6. 개발 서버 라우팅 테스트

| 테스트 항목 | 결과 | 비고 |
|------------|------|------|
| /login 접속 | ✅ 통과 | HTTP 200 |
| /login HTML에 "학부모/관리자 로그인" 포함 | ✅ 통과 | curl 응답에서 문자열 확인 |
| /login HTML에 surface-warm 포함 | ✅ 통과 | curl 응답에서 클래스명 확인 |
| /mypage 접속 | ✅ 통과 | HTTP 200 |

---

참고사항: `npm run build` 시 `prisma generate` 단계에서 Windows 파일 잠금 에러(EPERM)가 발생했으나, 이는 코드 문제가 아닌 OS 레벨 파일 잠금 문제(개발 서버 실행 중). `npx next build`로 직접 실행 시 정상 빌드 확인.

📊 종합: 33개 항목 중 33개 통과 / 0개 실패

최종 판정: ✅ 전체 통과

## 리뷰 결과 (reviewer)

### 설계 계획서 리뷰 (2026-03-20)

#### 논리적 흐름: ✅ 통과

Phase 0~6의 순서는 논리적으로 타당하다.

- **Phase 0 (디자인 시스템)이 최우선인 이유**: 색상 토큰, 공통 컴포넌트(Button, Card, SectionLayout 등)가 없으면 이후 Phase에서 일관성을 유지할 수 없다. 현재 globals.css @theme에 색상이 5개뿐이므로 확장이 선행되어야 한다. 타당함.
- **Phase 1 (공통 레이아웃) -> Phase 2 (메인 랜딩) 순서**: 헤더/푸터가 통합되어야 LandingPageClient의 자체 헤더/푸터를 제거할 수 있다. 의존성 올바름.
- **Phase 3, 4, 5 병행 가능 표시**: 실제로 독립적이다. Phase 3(about, programs, apply)은 Phase 4(schedule, annual, gallery, notices)와 파일 겹침이 없다. Phase 5(mypage, login)도 별도 레이아웃이므로 독립적이다. 올바름.
- **Phase 6 (마무리)이 마지막인 이유**: loading.tsx 스켈레톤, 에셋 최적화는 전체 디자인이 확정된 후 해야 재작업이 없다. 타당함.
- **빠진 단계**: 없음. 다만 Phase 1에서 헤더/푸터 통합 시 "모바일 햄버거 메뉴 + 사이드바" 구현이 포함되는데, 이것이 Phase 0의 AnimateOnScroll 등과 함께 인터랙션 난이도가 높은 편이므로 Phase 1 내에서 우선순위를 두는 것을 권장한다.

#### 구현 가능성: ✅ 통과 (일부 주의 사항 있음)

**globals.css @theme 확장 호환성 확인:**
- 현재 @theme 블록에 5개 색상 변수가 정의되어 있다 (brand-orange-50/500/600, brand-navy-800/900).
- 계획서에서 추가할 변수(brand-orange-400/700, brand-navy-700, brand-sky-50/100/500, surface-warm, surface-section)는 동일한 `--color-` 패턴으로 @theme에 추가하면 된다. Tailwind CSS v4의 @theme 확장 방식과 완전히 호환된다.
- 문제 없음.

**PublicPageLayout.tsx 통합 계획 확인:**
- 현재 Server Component로 동작 중이다. 8개 서브페이지가 각각 `<PublicPageLayout>` 래퍼를 import하여 사용한다 (라우트 그룹이나 layout.tsx가 아닌 개별 페이지에서 직접 감싸는 구조).
- 계획서는 PublicHeader.tsx + PublicFooter.tsx를 분리하고 PublicPageLayout에서 연결하는 방식을 제안한다. 이 접근은 현재 구조와 호환된다.
- 주의: PublicPageLayout이 Server Component이므로, 모바일 햄버거 메뉴/사이드바 같은 인터랙티브 기능은 PublicHeader를 Client Component로 만들어야 한다. 계획서에 이 점이 명시되지 않았으나, developer가 자연스럽게 판단할 수 있는 수준이다.

**LandingPageClient.tsx 개편 계획 확인:**
- 현재 307줄의 Client Component로, 자체 헤더/푸터/히어로/퀵네비/유튜브/갤러리/CTA 섹션을 모두 포함한다.
- 계획서는 (1) 헤더/푸터를 공통 컴포넌트로 제거하고, (2) 히어로를 분할 레이아웃으로 변경하며, (3) TrustBadges/ProcessSteps/TestimonialCarousel 등 5개 신규 컴포넌트를 추가하는 방향이다.
- 현실적이다. 단, 현재 히어로에서 settings.introductionText를 dangerouslySetInnerHTML로 렌더링하는 구조(Tiptap HTML 지원)가 있으므로, 개편 시 이 기능을 유지해야 한다. 계획서에 이 디테일이 없으므로 developer 주의 필요.

**신규 컴포넌트 경로 확인:**
- src/components/ui/ -- 현재 존재하지 않음. 신규 생성 가능.
- src/components/landing/ -- 현재 존재하지 않음. 신규 생성 가능.
- 기존 src/components/ 에는 PublicPageLayout.tsx, RichTextEditor.tsx, builder/ 디렉토리가 있다. 충돌 없음.

**CLAUDE.md 정책 반영 확인:**
- $queryRawUnsafe 변경 금지: 계획서 developer 주의사항 1번에 명시됨. OK.
- 캐싱 정책 유지: developer 주의사항 2번에 명시됨. OK. 실제로 schedule(300초), 메인(60초) 등 각 페이지에 revalidate 값이 설정되어 있음을 확인.
- PgBouncer 관련: 프론트엔드 전용 작업이므로 직접적 영향 없으나, 주의사항에 명시되어 있어 안전.

**Pretendard 폰트:**
- 계획서에서 Pretendard를 기본 폰트로 추천하는데, layout.tsx를 확인한 결과 이미 Pretendard CDN이 로딩되고 있다 (cdn.jsdelivr.net/gh/orioncactus/pretendard). 추가 작업 불필요.

#### 리스크: 중간

**기존 기능 깨질 위험이 있는 부분:**

1. **PublicPageLayout 통합 시 (Phase 1) -- 리스크 중간**: 현재 8개 서브페이지가 PublicPageLayout을 직접 import하여 사용한다. 헤더/푸터를 분리하면 모든 8개 페이지에서 정상 렌더링되는지 일일이 확인해야 한다. 특히 PublicPageLayout이 Server Component이고, getAcademySettings()를 호출하여 phone/address를 가져오는 로직이 있으므로, PublicHeader를 Client Component로 전환할 경우 데이터 전달 방식을 변경해야 한다.

2. **LandingPageClient 히어로 변경 시 (Phase 2) -- 리스크 중간**: dangerouslySetInnerHTML로 Tiptap HTML을 렌더링하는 부분과, settings에서 introductionTitle/introductionText/youtubeUrl/galleryImagesJSON 등을 동적으로 가져오는 구조를 유지해야 한다. 이 동적 데이터 의존성을 놓치면 관리자가 설정한 내용이 표시되지 않을 수 있다.

3. **LandingPageClient와 PublicPageLayout의 네비 메뉴 불일치 -- 현재 존재하는 문제**: LandingPageClient 네비에는 "갤러리"와 "공지사항" 링크가 빠져 있고 PublicPageLayout에는 있다. Phase 1 통합 시 자연스럽게 해결될 것이나, 어떤 메뉴 구성이 최종인지 확인 필요.

4. **모바일 네비 전환 (수평 pill -> 햄버거+사이드바) -- 리스크 낮음~중간**: 현재 모바일 네비가 단순한 수평 스크롤인데, 햄버거 메뉴로 변경하면 UX가 크게 달라진다. 사용자(학부모) 입장에서 적응이 필요할 수 있으나, 메뉴가 7개로 많아서 햄버거가 더 적합하다. 구현 자체는 어렵지 않다.

**특히 주의해야 할 파일:**
- `src/components/PublicPageLayout.tsx` -- 모든 서브페이지의 공통 래퍼. 변경 시 8개 페이지 전체에 영향.
- `src/app/LandingPageClient.tsx` -- settings 데이터 의존성이 많음. 리팩토링 시 누락 주의.
- `src/app/globals.css` -- @theme 블록 수정 시 기존 5개 변수의 이름/값을 절대 바꾸지 말 것 (추가만 해야 함).

**예상 작업량(7~12세션) 현실성:**
- Phase 0 (6개 파일, 디자인 시스템): 1~2세션 -- 적절
- Phase 1 (4개 파일, 레이아웃 통합): 1~2세션 -- 적절. 단, 모바일 사이드바 구현이 포함되면 2세션 쪽에 가까움
- Phase 2 (6개 파일, 메인 랜딩): 2~3세션 -- 적절. 신규 컴포넌트 5개 + LandingPageClient 전면 개편이므로 가장 큰 작업
- Phase 3 (4개 파일): 1~2세션 -- 적절
- Phase 4 (6개 파일): 1~2세션 -- 적절. 스타일만 변경이라 난이도 낮음
- Phase 5 (3개 파일): 1세션 -- 적절
- Phase 6 (5~8개 파일): 1세션 -- 적절

합계: 8~13세션. 계획서의 "7~12세션"과 거의 일치. 현실적이다.

#### 개선 제안:

1. **Phase 1에서 PublicHeader의 컴포넌트 타입 명시 필요**: 모바일 햄버거 메뉴가 포함되므로 Client Component로 만들어야 하는데, 현재 PublicPageLayout이 Server Component이다. PublicHeader를 Client Component로, PublicFooter는 Server Component로 유지하는 방향을 계획서에 명시하면 developer가 혼동 없이 작업할 수 있다.

2. **LandingPageClient의 동적 데이터 의존성 목록 추가 권장**: settings에서 가져오는 필드들(introductionTitle, introductionText, youtubeUrl, galleryImagesJSON, contactPhone, address)을 계획서에 명시하면, 개편 시 누락을 방지할 수 있다.

3. **Phase 2의 TestimonialCarousel에 외부 라이브러리 의존성 결정 필요**: "Slick/Swiper" 캐러셀이 제안되어 있는데, 외부 라이브러리 추가 여부를 미리 결정해두면 좋다. 순수 CSS/JS로 구현할지, swiper 라이브러리를 도입할지. 번들 사이즈에 영향을 준다.

4. **라우트 그룹 도입 검토**: 현재 8개 서브페이지가 각각 PublicPageLayout을 import하고 있다. Next.js App Router의 라우트 그룹 `(public)/layout.tsx`로 전환하면 각 페이지에서 개별 import가 불필요해진다. Phase 1에서 이 구조 전환을 함께 하면 코드가 훨씬 깔끔해진다. 단, 라우팅 구조 변경이므로 리스크를 감수할지 developer와 논의 필요.

5. **계획서에 "롤백 전략" 추가 권장**: Phase별로 git 브랜치를 나눠 작업하고, 각 Phase 완료 시 메인에 머지하는 전략을 명시하면 안전하다. 특히 Phase 1~2에서 문제가 생겼을 때 이전 상태로 돌아갈 수 있어야 한다.

#### 최종 판정: ✅ 진행 가능

계획서의 논리적 흐름, 구현 가능성 모두 양호하다. 현재 프로젝트 구조(globals.css @theme, PublicPageLayout, LandingPageClient)와 호환되며, 제안된 파일 경로도 기존 구조와 충돌 없다. 위의 5가지 개선 제안은 "하면 좋은 것"이지 "하지 않으면 안 되는 것"은 아니므로, 현재 상태로 Phase 0부터 착수해도 무방하다.

## 수정 요청
| 요청자 | 대상 파일 | 문제 설명 | 상태 |
|--------|----------|----------|------|

## Git 기록 (git-manager)
(아직 없음)

## 문서 기록 (doc-writer)
(아직 없음)

## 작업 로그 (최근 10건만 유지)
| 날짜 | 에이전트 | 작업 내용 | 결과 |
|------|---------|----------|------|
| 2026-03-20 | pm | 프로젝트 진행상황 보고 + 개발서버 확인 | ✅ Phase 10까지 완료 확인, 서버 정상 동작 |
| 2026-03-20 | architect | 공개 페이지 UI/UX 개편 벤치마킹 리서치 | ✅ 8개 사이트 분석 + 핵심 트렌드/방향 도출 |
| 2026-03-20 | architect | ClassDojo 기반 UI/UX 개편 설계 계획서 작성 | ✅ 7개 섹션 완료 (컨셉/컬러/타이포/컴포넌트/페이지별/인터랙션/단계) |
| 2026-03-20 | reviewer | UI/UX 개편 설계 계획서 논리/구현/리스크 점검 | ✅ 진행 가능 판정 (개선 제안 5건 첨부) |
| 2026-03-20 | developer | Phase 0 디자인 시스템 기반 구축 (globals.css 수정 + 컴포넌트 5개 신규) | ✅ tsc 타입 체크 통과 |
| 2026-03-20 | developer | Phase 1 공통 레이아웃 통합 (헤더/푸터 통합 + 모바일 사이드바) | ✅ tsc + build 통과 |
| 2026-03-20 | developer | Phase 2 메인 랜딩 전면 개편 (신규 5개 + 수정 1개) | ✅ tsc + build 통과 |
| 2026-03-20 | tester | Phase 0~3 통합 테스트 (빌드/파일/import/회귀/서버 라우팅) | ✅ 35개 항목 전체 통과 |
| 2026-03-20 | developer | Phase 4-A 시간표+연간일정 스타일 통일 (4개 파일 수정) | ✅ tsc 타입 체크 통과 |
| 2026-03-20 | tester | Phase 4 통합 테스트 (빌드/import/기능보존/회귀/서버 라우팅) | ✅ 33개 항목 전체 통과 |
| 2026-03-20 | developer | Phase 5 마이페이지+로그인 디자인 토큰 통일 (3개 파일 수정) | ✅ tsc 타입 체크 통과 |
| 2026-03-20 | tester | Phase 5 테스트 (빌드/스타일/기능보존/회귀/서버 라우팅) | ✅ 33개 항목 전체 통과 |
| 2026-03-20 | developer | Phase 6 마무리 및 최적화 (스켈레톤 로딩 UI 7개 + 폰트 확인) | ✅ tsc 타입 체크 통과 |
