import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const files = [
  "src/app/api/push/route.ts",
  "src/app/api/admin/backup/route.ts",
  "src/app/api/admin/backup-now/route.ts",
  "src/app/api/admin/cloud-backups/route.ts",
  "src/app/api/admin/export-seed/route.ts",
  "src/app/api/admin/seed/route.ts",
  "src/app/api/admin/parse-excel/route.ts",
  "src/app/actions/public.ts",
  "src/app/apply/enroll/EnrollApplicationForm.tsx",
  "src/app/apply/enroll/EnrollApplicationLaterSteps.tsx",
  "src/app/apply/trial/TrialApplicationForm.tsx",
];

const mojibake = /[�泥蹂媛怨諛鍮]|[?][가-힣]|[가-힣][?]/;
const userFacingLine = /\b(error|reason|relation|results\.[A-Za-z0-9_]+)\s*:|throw new Error|NextResponse\.json|setError\(|setExistingNotice\(|setPaymentNotice\(|notifyAdmins\(/;

for (const file of files) {
  const source = readFileSync(file, "utf8");
  source.split(/\r?\n/).forEach((line, index) => {
    const codeOnly = line.split("//")[0].trim();
    if (!codeOnly || codeOnly.startsWith("*") || codeOnly.startsWith("/*")) return;
    if (!userFacingLine.test(codeOnly)) return;

    assert.doesNotMatch(
      codeOnly,
      mojibake,
      `${file}:${index + 1} has mojibake in a user-facing message`,
    );
  });
}
