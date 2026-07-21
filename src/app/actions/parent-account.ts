"use server";

import { cookies } from "next/headers";
import {
  consumeParentAccountClaim,
  parentClaimProofCookieName,
  readParentAccountClaim,
  sendParentClaimOtp,
  verifyParentClaimOtp,
} from "@/lib/parent-account-claim";
import { createClient } from "@/lib/supabase/server";

export async function getParentAccountClaim(token: string) {
  return readParentAccountClaim(token.trim());
}

export async function sendParentAccountOtp(token: string) {
  return sendParentClaimOtp(token.trim());
}

export async function verifyParentAccountOtp(token: string, code: string) {
  const normalizedToken = token.trim();
  const result = await verifyParentClaimOtp(normalizedToken, code);
  if ("error" in result) return { error: result.error };
  const cookieStore = await cookies();
  cookieStore.set(parentClaimProofCookieName(normalizedToken), result.proof, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  return { ok: true, verified: true };
}

export async function acceptParentAccountClaim(token: string, email: string, password: string) {
  const normalizedToken = token.trim();
  const cookieStore = await cookies();
  const cookieName = parentClaimProofCookieName(normalizedToken);
  const proof = cookieStore.get(cookieName)?.value || "";
  const result = await consumeParentAccountClaim(normalizedToken, proof, email, password);
  if (!("ok" in result) || !result.ok) return result;

  cookieStore.delete(cookieName);
  const supabase = await createClient();
  const signedIn = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (signedIn.error) {
    const loginRedirect = `/login?redirect=${encodeURIComponent(result.redirectPath)}`;
    return { ...result, sessionEstablished: false, loginRedirect };
  }
  return { ...result, sessionEstablished: true };
}
