import { resolveRunToken } from "@/lib/seasonal/shuttleRun";
import { isRegularRunToken } from "./regularRun";

/**
 * 기사님 운행 링크 토큰인지 판정한다(방학특강·정규 어느 쪽이든).
 *
 * 왜 합쳤나: 기사님 화면이 하나로 통합되어, **링크 종류와 무관하게 그날 특강·정규를 함께** 보여 준다.
 * 그래서 방학특강 링크로 열어도 정규 행을 체크할 수 있어야 하고, 그 반대도 마찬가지다.
 * 토큰 생성·저장 키·저장 테이블은 종전 그대로이며, 여기선 "누구를 통과시킬지"만 넓힌다.
 *
 * ⚠️ 판정 함수 자체는 기존 것(resolveRunToken / isRegularRunToken)을 그대로 쓴다(새 검증 규칙 없음).
 */
export async function isAnyDriverRunToken(token: string): Promise<boolean> {
  const t = typeof token === "string" ? token.trim() : "";
  if (!/^[a-f0-9]{16,64}$/.test(t)) return false;
  if (await isRegularRunToken(t)) return true;
  return (await resolveRunToken(t)) !== null;
}
