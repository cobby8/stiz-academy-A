# 문자 발송 공급자 설정

STIZ 관리자 문자 발송은 `src/lib/sms.ts` 한 곳을 통해 실행됩니다. 체험 신청, 수강신청, 방학특강, 교사 초대 인증번호가 같은 통로를 사용합니다.

## 뿌리오 사용

Vercel 환경변수에 아래 값을 등록합니다. 값은 예시 이름만 적고, 실제 비밀값은 문서나 코드에 남기지 않습니다.

```bash
SMS_PROVIDER=BIZPPURIO
BIZPPURIO_ACCOUNT=뿌리오_계정
BIZPPURIO_PASSWORD=뿌리오_API_비밀번호
BIZPPURIO_SENDER=등록된_발신번호
BIZPPURIO_HOST=api.bizppurio.com
```

`BIZPPURIO_PASSWORD` 대신 기존 운영 환경에 맞춰 `BIZPPURIO_API_KEY`를 사용할 수 있습니다. `BIZPPURIO_SENDER` 대신 `BIZPPURIO_FROM`도 인식합니다.

뿌리오에서 먼저 준비해야 하는 항목입니다.

- 기업회원 및 문자연동 API 사용 승인
- 실제 서버 IP 등록
- 발신번호 사전 등록
- 운영 발송 주소 사용: `api.bizppurio.com`

## SOLAPI 유지

기존 SOLAPI를 계속 쓰려면 아래 값을 유지합니다.

```bash
SMS_PROVIDER=SOLAPI
SOLAPI_API_KEY=솔라피_API_KEY
SOLAPI_API_SECRET=솔라피_API_SECRET
SOLAPI_SENDER=등록된_발신번호
```

`SMS_PROVIDER`를 비워두면 `BIZPPURIO_ACCOUNT`가 있을 때는 뿌리오, 없을 때는 SOLAPI를 사용합니다.

## 문자 개인정보 보호 비밀키

문자 공급자 종류와 관계없이 Vercel의 **Production**과 **Preview** 환경에 아래 서버 전용 환경변수를 등록합니다.

```bash
MESSAGE_PRIVACY_HMAC_SECRET=32바이트_이상의_암호학적으로_안전한_무작위_비밀값
```

이 값은 문자 발송 장부에 전화번호 원문 대신 일관된 해시 식별값을 남기기 위한 비밀키입니다. 자물쇠의 열쇠처럼 관리해야 하며 다음 원칙을 지킵니다.

- 암호학적으로 안전한 방식으로 만든 최소 32바이트의 무작위 값을 사용합니다. 예를 들어 32개의 무작위 바이트를 64자리 16진수 문자열로 인코딩할 수 있습니다.
- 같은 전화번호를 같은 식별값으로 비교할 수 있도록 운영 중에는 값을 안정적으로 유지합니다. 값을 바꾸면 기존 장부와 새 장부의 해시를 서로 연결할 수 없습니다.
- 코드, 문서, Git, 빌드 로그, 오류 로그에 실제 값을 넣거나 출력하지 않습니다.
- `NEXT_PUBLIC_` 접두사를 붙이지 않습니다. 브라우저로 전달되는 클라이언트 환경변수가 아니라 서버 전용 비밀값입니다.
- Vercel 프로젝트의 Settings → Environment Variables에서 Production과 Preview 범위에 각각 등록한 뒤 재배포합니다.

로컬 개발에서는 실제 운영값을 복사하지 말고 별도의 개발용 값을 사용합니다. `npm run release:preflight`는 Production 또는 Preview 배포 전에 이 항목이 빠졌으면 배포 준비 실패로 처리하지만 비밀값 자체는 출력하지 않습니다.

## 발송 실패 확인

문자 발송 실패는 관리자 알림 로그의 `SMS_PROVIDER_FAILED`로 기록됩니다. 뿌리오에서 자주 확인해야 하는 실패 원인은 인증 실패, 서버 IP 미등록, 발신번호 미등록, 요청 제한입니다.
