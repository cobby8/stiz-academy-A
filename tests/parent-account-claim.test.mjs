import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync("prisma/migrations/20260722160000_add_parent_account_claims/migration.sql", "utf8");
const claim = readFileSync("src/lib/parent-account-claim.ts", "utf8");
const actions = readFileSync("src/app/actions/parent-account.ts", "utf8");
const seasonal = readFileSync("src/app/api/admin/seasonal/route.ts", "utf8");

test("parent activation stores only token and OTP hashes", () => {
  const claimModel = schema.match(/model ParentAccountClaim \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(schema, /model ParentAccountClaim/);
  assert.match(schema, /authUserId\s+String\?\s+@unique/);
  assert.match(schema, /tokenHash\s+String\s+@unique/);
  assert.match(schema, /otpHash\s+String\?/);
  assert.doesNotMatch(claimModel, /\n\s+token\s+String/);
  assert.match(migration, /ParentAccountClaim_tokenHash_check/);
  assert.match(claim, /randomBytes\(32\)\.toString\("base64url"\)/);
  assert.match(claim, /createHmac\("sha256"/);
  assert.match(claim, /timingSafeEqual/);
});

test("claim acceptance is OTP-gated, single-consumer, and compensates orphan auth", () => {
  assert.match(claim, /status !== "VERIFIED"/);
  assert.match(claim, /SET status = 'PROCESSING'/);
  assert.match(claim, /status = 'PROCESSING'[\s\S]*?status = 'VERIFIED'/);
  assert.match(claim, /SET status = 'CONSUMED'/);
  assert.match(claim, /auth\.admin\.deleteUser\(authUserId\)/);
  assert.match(claim, /RECOVERY_REQUIRED/);
  assert.match(claim, /parentAccountClaimAttemptId === claim!\.processingAttemptId/);
  assert.match(claim, /updateUserById/);
  assert.match(claim, /PROCESSING_LEASE_MINUTES = 5/);
  assert.match(claim, /recoverExpiredProcessingClaim/);
  assert.match(claim, /SET status = 'PENDING'/);
  assert.match(claim, /SET email = \$1, "authUserId" = \$4/);
  assert.match(migration, /User_authUserId_key/);
  assert.match(claim, /Number\(duplicates\[0\]\?\.count\) !== 1/);
  assert.match(claim, /proofHash/);
  assert.match(claim, /safeEqual\(current\.proofHash, suppliedProofHash\)/);
  assert.match(actions, /httpOnly: true/);
  assert.match(actions, /secure: true/);
  assert.match(actions, /sameSite: "lax"/);
  assert.match(actions, /signInWithPassword/);
});

test("OTP is bounded and tests cannot call the external SMS provider", () => {
  assert.match(claim, /MAX_OTP_ATTEMPTS = 5/);
  assert.match(claim, /15 \* 60_000/);
  assert.match(claim, /OTP_TTL_MINUTES = 5/);
  assert.match(claim, /process\.env\.NODE_ENV === "test"/);
  assert.match(claim, /if \(process\.env\.NODE_ENV === "test"\)[\s\S]*?return \{ ok: true \}/);
  assert.match(schema, /model ParentAccountClaimOtpSend/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON TABLE "ParentAccountClaim" FROM anon, authenticated/);
  assert.match(migration, /REVOKE ALL ON TABLE "ParentAccountClaimOtpSend" FROM anon, authenticated/);
});

test("public actions and seasonal reissue expose the agreed contract", () => {
  assert.match(actions, /export async function getParentAccountClaim/);
  assert.match(actions, /export async function sendParentAccountOtp/);
  assert.match(actions, /export async function verifyParentAccountOtp/);
  assert.match(actions, /export async function acceptParentAccountClaim/);
  assert.match(seasonal, /body\.resource === "accountActivation"/);
  assert.match(seasonal, /data\.action !== "reissue"/);
  assert.match(seasonal, /accountActivationRequired/);
  assert.match(seasonal, /activationUrl/);
});
