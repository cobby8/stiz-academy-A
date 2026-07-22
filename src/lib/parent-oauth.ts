import type { Provider } from "@supabase/supabase-js";

export const PARENT_OAUTH_PROVIDERS = ["google", "kakao", "naver"] as const;

export type ParentOAuthProvider = (typeof PARENT_OAUTH_PROVIDERS)[number];

export function parseParentOAuthProvider(value: string): ParentOAuthProvider | null {
  return PARENT_OAUTH_PROVIDERS.includes(value as ParentOAuthProvider)
    ? (value as ParentOAuthProvider)
    : null;
}

export function toSupabaseProvider(provider: ParentOAuthProvider): Provider {
  // Google and Kakao are built in. Naver is registered in Supabase as a
  // project-specific custom OAuth provider.
  return (provider === "naver" ? "custom:naver" : provider) as Provider;
}

export function isParentOAuthProviderReady(provider: ParentOAuthProvider) {
  if (provider !== "naver") return true;
  return process.env.SUPABASE_NAVER_PROVIDER_ENABLED === "true";
}

export function safeInternalRedirect(value: string | null, fallback = "/mypage") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback;

  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("\\")) {
      return fallback;
    }
    const parsed = new URL(value, "https://stiz.local");
    return parsed.origin === "https://stiz.local"
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}

export function publicSiteOrigin(requestOrigin: string) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return requestOrigin;

  try {
    return new URL(configured).origin;
  } catch {
    return requestOrigin;
  }
}
