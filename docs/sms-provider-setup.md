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

## 발송 실패 확인

문자 발송 실패는 관리자 알림 로그의 `SMS_PROVIDER_FAILED`로 기록됩니다. 뿌리오에서 자주 확인해야 하는 실패 원인은 인증 실패, 서버 IP 미등록, 발신번호 미등록, 요청 제한입니다.
