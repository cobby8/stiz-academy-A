// Node's type-stripping tests require the runtime extension while Next.js
// resolves the same source module during the application build.
// @ts-expect-error -- TypeScript runtime test compatibility
import { defaultPathForRole, parseAppRole } from "./auth-routes.ts";

/**
 * Returns null only when the verified database role may view parent pages.
 * Unknown or missing roles fail closed instead of being treated as a parent.
 */
export function redirectPathForMyPageRole(role: unknown) {
  const parsedRole = parseAppRole(role);

  if (parsedRole === "PARENT") return null;
  if (parsedRole) return defaultPathForRole(parsedRole);

  return "/";
}
