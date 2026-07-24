# 학부모 회원가입 운영 설정

학부모 회원가입은 일반 아이디 가입과 Google·Kakao·Naver 간편가입을 지원한다. 모든 신규 가입은 SMS 휴대폰 인증을 완료해야 앱 계정이 생성된다.

## 필수 환경변수

- `NEXT_PUBLIC_SITE_URL`: 운영 HTTPS 주소
- `PARENT_SIGNUP_SECRET`: 32바이트 이상의 임의 비밀값. 가입 토큰·휴대폰·OTP 해시에 사용
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `SMS_PROVIDER`와 선택한 Bizppurio 또는 Solapi 발송 환경변수
- `SUPABASE_NAVER_PROVIDER_ENABLED=true`: Supabase의 `custom:naver` 검증이 끝난 뒤에만 설정

비밀값은 `NEXT_PUBLIC_` 이름으로 만들지 않는다. Preview와 Production 환경은 각각 설정한다.

## 공급자 콘솔

1. Supabase Auth의 URL Configuration을 먼저 맞춘다.
   - Site URL: 운영 주소. 예: `https://stiz-dasan.kr`
   - Redirect URLs: `${NEXT_PUBLIC_SITE_URL}/auth/callback`
   - 로컬 테스트가 필요하면 `http://localhost:4000/auth/callback`도 추가한다.
   - Vercel Preview를 테스트할 때만 Vercel preview wildcard를 별도로 추가한다.
2. Google OAuth Web Client를 만든 뒤 Supabase Auth Provider의 Google에 Client ID와 Secret을 입력하고 활성화한다.
   - Google Authorized JavaScript origin: 운영 origin. 예: `https://stiz-dasan.kr`
   - Google Authorized redirect URI: Supabase Google provider 화면에 표시되는 callback URL
   - 필수 scope: `openid`, email, profile
3. Kakao Developers에서 Kakao Login을 켜고 Supabase Auth Provider의 Kakao에 REST API Key와 Client Secret을 입력하고 활성화한다.
   - Kakao Redirect URI: Supabase Kakao provider 화면에 표시되는 callback URL
   - Kakao 동의항목: 프로필과 이메일을 활성화한다.
   - OpenID Connect를 사용할 수 있으면 활성화한다.
4. Naver는 Supabase Custom OAuth Provider로 등록한다. 실제 로그인·콜백 PoC를 통과한 뒤 `SUPABASE_NAVER_PROVIDER_ENABLED=true`를 켠다.
   - Supabase provider identifier: `custom:naver`
   - Authorization URL: `https://nid.naver.com/oauth2.0/authorize`
   - Token URL: `https://nid.naver.com/oauth2.0/token`
   - UserInfo URL: `https://openapi.naver.com/v1/nid/me`
   - Naver Callback URL: Supabase Custom OAuth Provider 생성 화면에 표시되는 read-only Callback URL

키와 Secret은 문서나 코드에 저장하지 않는다. Google, Kakao, Naver 콘솔에서 발급한 값은 Supabase Dashboard와 Vercel Environment Variables에만 입력한다.

## 배포 순서

1. 운영 DB 백업과 마이그레이션 검토
2. `20260723110000_add_parent_signup_verification` 마이그레이션 적용
3. 환경변수와 공급자 Redirect URL 등록
4. 일반가입 테스트 계정으로 SMS 수신·로그인·마이페이지 확인
5. Google, Kakao, Naver 순서로 실제 간편가입 확인

가입 인증 테이블은 Data API에서 직접 접근할 수 없고 서버에서만 사용한다. 미완료 가입 개인정보는 새로운 인증 요청이 들어올 때 7일이 지난 기록부터 정리된다.
