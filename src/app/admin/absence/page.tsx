import { requireAdmin } from "@/lib/auth-guard";
import {
  getRegularAbsences,
  getRegularAbsenceClasses,
  getMakeupClassOptions,
} from "@/lib/regular/admin-regular-absence";
import RegularAbsenceAdminClient from "./RegularAbsenceAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminRegularAbsencePage() {
  await requireAdmin();
  // 목록 + 반 필터 옵션 + 보강 반 옵션 병렬 조회.
  const [rows, classes, makeupClasses] = await Promise.all([
    getRegularAbsences(),
    getRegularAbsenceClasses(),
    getMakeupClassOptions(),
  ]);
  const initial = JSON.parse(JSON.stringify({ rows, classes, makeupClasses }));
  return <RegularAbsenceAdminClient initial={initial} />;
}
