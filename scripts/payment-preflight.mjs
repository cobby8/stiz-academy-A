function readEnv(name) {
  return typeof process.env[name] === "string" ? process.env[name].trim() : "";
}

function inferTossKeyMode(key) {
  if (key.startsWith("test_")) return "test";
  if (key.startsWith("live_")) return "live";
  return "unknown";
}

function modeLabel(mode) {
  if (mode === "test") return "테스트 결제";
  if (mode === "live") return "실거래 결제";
  return "확인 필요";
}

function makeUrl(origin, path, invoiceId) {
  const url = new URL(path, origin);
  url.searchParams.set("invoiceId", invoiceId);
  return url.toString();
}

const scope = (readEnv("RELEASE_ENV_SCOPE") || readEnv("VERCEL_ENV") || "local").toLowerCase();
const clientKey = readEnv("NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY") || readEnv("TOSS_PAYMENTS_CLIENT_KEY");
const secretKey = readEnv("TOSS_PAYMENTS_SECRET_KEY");
const siteUrl = readEnv("NEXT_PUBLIC_SITE_URL");
const errors = [];
const warnings = [];

if (!clientKey) errors.push("토스 공개키가 필요합니다.");
if (!secretKey) errors.push("토스 서버키가 필요합니다.");

const clientMode = inferTossKeyMode(clientKey);
const secretMode = inferTossKeyMode(secretKey);
const keyPairReady = Boolean(clientKey && secretKey && clientMode !== "unknown" && clientMode === secretMode);

if (clientKey && clientMode === "unknown") errors.push("토스 공개키 종류를 확인할 수 없습니다. test_ 또는 live_ 키를 사용해 주세요.");
if (secretKey && secretMode === "unknown") errors.push("토스 서버키 종류를 확인할 수 없습니다. test_ 또는 live_ 키를 사용해 주세요.");
if (clientKey && secretKey && clientMode !== secretMode) errors.push("토스 공개키와 서버키의 테스트/실거래 종류가 서로 다릅니다.");
if (scope === "production" && keyPairReady && clientMode === "test") errors.push("운영 배포에는 토스 실거래 키가 필요합니다.");
if (scope === "preview" && keyPairReady && clientMode === "live") warnings.push("미리보기 환경에서 실거래 키를 사용 중입니다.");

let origin = "";
if (!siteUrl) {
  errors.push("사이트 주소가 필요합니다.");
} else {
  try {
    origin = new URL(siteUrl).origin;
    if (!/^https?:\/\//i.test(origin)) errors.push("사이트 주소는 http 또는 https 주소여야 합니다.");
    if (scope === "production" && (!origin.startsWith("https://") || /localhost/i.test(origin))) {
      errors.push("운영 사이트 주소는 localhost가 아닌 https 주소여야 합니다.");
    }
  } catch {
    errors.push("사이트 주소 형식이 올바르지 않습니다.");
  }
}

console.log("[토스 결제 점검]");
console.log(`- 범위: ${scope}`);
console.log(`- 결제 모드: ${keyPairReady ? modeLabel(clientMode) : "준비 필요"}`);
console.log(`- 공개키: ${clientKey ? "있음" : "없음"}`);
console.log(`- 서버키: ${secretKey ? "있음" : "없음"}`);

if (origin) {
  console.log(`- 성공 복귀 주소: ${makeUrl(origin, "/payments/success", "invoice-id")}`);
  console.log(`- 실패 복귀 주소: ${makeUrl(origin, "/payments/fail", "invoice-id")}`);
  console.log(`- 토스 관리자 웹훅 등록 주소: ${new URL("/api/payments/toss/webhook", origin).toString()}`);
}

warnings.forEach((message) => console.warn(`[주의] ${message}`));

if (errors.length > 0) {
  console.error(`\n[실패] 결제 설정에서 ${errors.length}개 항목을 확인해야 합니다.`);
  errors.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}

console.log("\n[통과] 실제 결제 요청 없이 결제 설정 형식을 확인했습니다.");
