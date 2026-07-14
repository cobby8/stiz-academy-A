export type AppRole = "ADMIN" | "VICE_ADMIN" | "INSTRUCTOR" | "PARENT";

export function normalizeAppRole(value: unknown): AppRole {
  if (value === "ADMIN" || value === "VICE_ADMIN" || value === "INSTRUCTOR" || value === "PARENT") {
    return value;
  }
  return "PARENT";
}

export function defaultPathForRole(role: AppRole) {
  if (role === "ADMIN" || role === "VICE_ADMIN") return "/admin";
  if (role === "INSTRUCTOR") return "/staff";
  return "/mypage";
}

export function isSafeInternalPath(path?: string | null) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return false;
  if (/[\\\u0000-\u001f\u007f]/.test(path)) return false;

  try {
    const decoded = decodeURIComponent(path);
    if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("\\")) return false;
    const parsed = new URL(path, "https://stiz.internal");
    return parsed.origin === "https://stiz.internal" && !parsed.pathname.startsWith("/login");
  } catch {
    return false;
  }
}

export function canRoleAccessPath(role: AppRole, path?: string | null) {
  if (!isSafeInternalPath(path)) return false;
  const target = path || "/";

  if (target.startsWith("/admin")) {
    return role === "ADMIN" || role === "VICE_ADMIN";
  }
  if (target.startsWith("/staff")) {
    return role === "ADMIN" || role === "VICE_ADMIN" || role === "INSTRUCTOR";
  }
  if (target.startsWith("/mypage")) {
    return role === "PARENT";
  }

  return true;
}

export function resolveRedirectForRole(role: AppRole, requestedPath?: string | null) {
  if (canRoleAccessPath(role, requestedPath)) return requestedPath as string;
  return defaultPathForRole(role);
}
