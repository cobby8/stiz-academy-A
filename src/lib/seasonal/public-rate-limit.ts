import { createHash } from "node:crypto";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * 서버리스 인스턴스별 메모리 제한입니다. 여러 인스턴스를 아우르는 강한 제한은
 * 추후 Redis/DB 같은 공유 저장소로 교체해야 합니다.
 */
export function takePublicRateLimit(
  key: string,
  options: { limit: number; windowMs: number; now?: number },
): RateLimitResult {
  const now = options.now ?? Date.now();
  const current = buckets.get(key);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + options.windowMs }
    : current;

  if (bucket.count >= options.limit) {
    return {
      allowed: false,
      limit: options.limit,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  buckets.set(key, bucket);
  pruneBuckets(now);
  return {
    allowed: true,
    limit: options.limit,
    remaining: Math.max(0, options.limit - bucket.count),
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

export function clientIpKey(request: Request): string {
  const raw = request.headers.get("cf-connecting-ip")
    || request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]
    || "unknown";
  return raw.trim().slice(0, 100) || "unknown";
}

/** 원문 전화번호 등 민감값을 제한 장부에 보관하지 않기 위한 단방향 키입니다. */
export function hashSensitiveRateLimitKey(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function pruneBuckets(now: number) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now || buckets.size >= MAX_BUCKETS) buckets.delete(key);
    if (buckets.size < MAX_BUCKETS) break;
  }
}

export function resetPublicRateLimitsForTests() {
  buckets.clear();
}
