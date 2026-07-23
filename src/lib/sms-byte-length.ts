export const SOLAPI_SMS_MAX_BYTES = 90;

/**
 * 솔라피의 국내 단문 기준으로 본문 크기를 계산한다.
 * ASCII(영문, 숫자, 공백, 줄바꿈 포함)는 1바이트, 그 밖의 문자는 2바이트다.
 */
export function getSolapiSmsByteLength(body: string): number {
    let bytes = 0;

    for (const character of body) {
        bytes += character.codePointAt(0)! <= 0x7f ? 1 : 2;
    }

    return bytes;
}

export function isSolapiShortSms(body: string): boolean {
    return getSolapiSmsByteLength(body) <= SOLAPI_SMS_MAX_BYTES;
}

/**
 * 공급자 호출 전에 사용해 LMS 자동 전환과 예상 밖의 추가 과금을 차단한다.
 */
export function assertSolapiShortSms(body: string): void {
    const bytes = getSolapiSmsByteLength(body);
    if (bytes > SOLAPI_SMS_MAX_BYTES) {
        throw new Error(`SMS_BODY_TOO_LONG:${bytes}/${SOLAPI_SMS_MAX_BYTES}`);
    }
}
