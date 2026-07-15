import { existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const skipEnv = process.argv.includes("--skip-env");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scope = (process.env.RELEASE_ENV_SCOPE || process.env.VERCEL_ENV || "").toLowerCase();

function isPresent(name) {
  return typeof process.env[name] === "string" && process.env[name].trim().length > 0;
}

function checkEnvironment() {
  const missing = [];
  const requireAll = (names) => names.forEach((name) => {
    if (!isPresent(name)) missing.push(name);
  });

  if (!scope || !["production", "preview"].includes(scope)) {
    console.error("[환경] RELEASE_ENV_SCOPE 또는 VERCEL_ENV를 production/preview로 지정해야 합니다.");
    return false;
  }

  requireAll([
    "DATABASE_URL",
    "DIRECT_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "CRON_SECRET",
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
    "GEMINI_API_KEY",
    "INVITE_OTP_SECRET",
    "SOLAPI_API_KEY",
    "SOLAPI_API_SECRET",
    "SOLAPI_SENDER",
    "TOSS_PAYMENTS_SECRET_KEY",
  ]);

  if (!isPresent("NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY") && !isPresent("TOSS_PAYMENTS_CLIENT_KEY")) {
    missing.push("NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY (또는 TOSS_PAYMENTS_CLIENT_KEY)");
  }

  if (process.env.RELEASE_REQUIRE_INSTAGRAM === "true") {
    if (!isPresent("INSTAGRAM_ACCESS_TOKEN") && !isPresent("META_ACCESS_TOKEN")) {
      missing.push("INSTAGRAM_ACCESS_TOKEN (또는 META_ACCESS_TOKEN)");
    }
    requireAll(["INSTAGRAM_BUSINESS_ACCOUNT_ID"]);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "";
  if (siteUrl && (scope === "production") && (!siteUrl.startsWith("https://") || /localhost/i.test(siteUrl))) {
    console.error("[환경] production의 NEXT_PUBLIC_SITE_URL은 localhost가 아닌 https URL이어야 합니다.");
    return false;
  }

  if (missing.length > 0) {
    console.error(`[환경] ${scope} 범위에서 누락된 변수 ${missing.length}개:`);
    missing.forEach((name) => console.error(`- ${name}`));
    console.error("비밀값은 출력하지 않았습니다. Vercel의 해당 Environment 범위를 확인하세요.");
    return false;
  }

  console.log(`[환경] ${scope} 필수 변수의 존재 여부를 확인했습니다. 비밀값은 출력하지 않았습니다.`);
  return true;
}

function run(label, command, args) {
  console.log(`\n[검사] ${label}`);
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", shell: false });
  if (result.error) {
    console.error(`[실패] ${label}: ${result.error.message}`);
    return false;
  }
  if (result.status !== 0) {
    console.error(`[실패] ${label} (종료 코드 ${result.status ?? "unknown"})`);
    return false;
  }
  console.log(`[통과] ${label}`);
  return true;
}

if (!skipEnv && !checkEnvironment()) process.exit(1);
if (skipEnv) console.log("[환경] --skip-env로 환경변수 검사를 생략했습니다. 배포 승인을 의미하지 않습니다.");

const prisma = resolve(root, "node_modules", "prisma", "build", "index.js");
const tsc = resolve(root, "node_modules", "typescript", "bin", "tsc");

if (!existsSync(prisma) || !existsSync(tsc)) {
  console.error("[실패] node_modules가 없습니다. npm ci 후 다시 실행하세요.");
  process.exit(1);
}

const testFiles = readdirSync(resolve(root, "tests"))
  .filter((name) => name.endsWith(".test.mjs"))
  .sort()
  .map((name) => resolve(root, "tests", name));

const checks = [
  ["Prisma 스키마", process.execPath, [prisma, "validate"]],
  ["TypeScript", process.execPath, [tsc, "--noEmit"]],
  ["정책 및 계약 테스트", process.execPath, ["--test", ...testFiles]],
];

for (const [label, command, args] of checks) {
  if (!run(label, command, args)) process.exit(1);
}

console.log("\n[완료] 읽기 전용 릴리스 검사를 통과했습니다. DB SQL 적용·배포·외부 발송은 수행하지 않았습니다.");
