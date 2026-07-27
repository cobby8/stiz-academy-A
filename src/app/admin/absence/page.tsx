import { requireAdmin } from "@/lib/auth-guard";
import { getRegularAbsences, getRegularAbsenceClasses } from "@/lib/regular/admin-regular-absence";
import RegularAbsenceAdminClient from "./RegularAbsenceAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminRegularAbsencePage() {
  await requireAdmin();
  // 목록 + 반 필터 옵션 병렬 조회.
  const [rows, classes] = await Promise.all([
    getRegularAbsences(),
    getRegularAbsenceClasses(),
  ]);
  const initial = JSON.parse(JSON.stringify({ rows, classes }));
  return <RegularAbsenceAdminClient initial={initial} />;
}
