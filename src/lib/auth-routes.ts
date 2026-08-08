export type AppRole = "ADMIN" | "VICE_ADMIN" | "INSTRUCTOR" | "DRIVER" | "PARENT";

export function parseAppRole(value: unknown): AppRole | null {
  if (value === "ADMIN" || value === "VICE_ADMIN" || value === "INSTRUCTOR" || value === "DRIVER" || value === "PARENT") {
    return value;
  }
  return null;
}

export function normalizeAppRole(value: unknown): AppRole {
  return parseAppRole(value) ?? "PARENT";
}

export function defaultPathForRole(role: AppRole) {
  if (role === "ADMIN" || role === "VICE_ADMIN") return "/admin";
  if (role === "INSTRUCTOR") return "/staff";
  if (role === "DRIVER") return "/staff/shuttle";
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
  const target = new URL(path as string, "https://stiz.internal").pathname;

  if (target === "/admin" || target.startsWith("/admin/")) {
    return role === "ADMIN" || role === "VICE_ADMIN";
  }
  if (target === "/staff" || target.startsWith("/staff/")) {
    if (target === "/staff/shuttle" || target.startsWith("/staff/shuttle/")) {
      return role === "ADMIN" || role === "VICE_ADMIN" || role === "DRIVER";
    }
    return role === "ADMIN" || role === "VICE_ADMIN" || role === "INSTRUCTOR";
  }
  if (target === "/mypage" || target.startsWith("/mypage/")) {
    return role === "PARENT";
  }

  return true;
}

/** 설치된 선생님 앱의 영역(manifest scope)인 /staff 안쪽인지. */
export function isStaffScopePath(path?: string | null) {
  if (!isSafeInternalPath(path)) return false;
  const target = new URL(path as string, "https://stiz.internal").pathname;
  return target === "/staff" || target.startsWith("/staff/");
}

export function resolveRedirectForRole(
  role: AppRole,
  requestedPath?: string | null,
  options?: { preferRoleHome?: boolean; stayInStaffApp?: boolean },
) {
  // 설치된 선생님 앱에서 로그인한 경우. 앱의 영역은 /staff 라 여기서 벗어나면
  // 앱이 브라우저로 튕긴다. 원장(ADMIN)도 앱 안에서는 선생님 화면을 연다 —
  // 관리자 화면은 앱 메뉴의 바로가기로 따로 나간다.
  if (options?.stayInStaffApp) {
    if (isStaffScopePath(requestedPath) && canRoleAccessPath(role, requestedPath)) {
      return requestedPath as string;
    }
    const roleHome = defaultPathForRole(role);
    // 선생님·기사님은 역할 기본 화면이 이미 /staff 안이다.
    if (isStaffScopePath(roleHome)) return roleHome;
    // 관리자는 /admin 이 기본이지만 앱 안에서는 /staff 로 연다.
    // 학부모가 선생님 앱으로 로그인한 경우처럼 /staff 를 못 쓰면 제 화면으로 보낸다.
    return canRoleAccessPath(role, "/staff") ? "/staff" : roleHome;
  }
  if (options?.preferRoleHome) return defaultPathForRole(role);
  if (canRoleAccessPath(role, requestedPath)) return requestedPath as string;
  return defaultPathForRole(role);
}
