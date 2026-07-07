export type AppRole = "ADMIN" | "VICE_ADMIN" | "INSTRUCTOR" | "PARENT";

export function normalizeAppRole(value: unknown): AppRole {
  if (value === "ADMIN" || value === "VICE_ADMIN" || value === "INSTRUCTOR" || value === "PARENT") {
    return value;
  }
  return "PARENT";
}

export function defaultPathForRole(role: AppRole) {
  if (role === "ADMIN" || role === "VICE_ADMIN") return "/admin";
  if (role === "INSTRUCTOR") return "/staff/quick-post";
  return "/mypage";
}

export function isSafeInternalPath(path?: string | null) {
  return Boolean(path && path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/login"));
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
