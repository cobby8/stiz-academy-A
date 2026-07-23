"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";

type Step = "method" | "phone" | "account" | "done";

const inputClass =
  "min-h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-gray-900 outline-none transition focus:border-brand-orange-500 focus:ring-2 focus:ring-brand-orange-500/20 dark:border-gray-600 dark:bg-gray-950 dark:text-white";

function friendlyError(value: unknown) {
  if (value instanceof Error && value.message) return value.message;
  return "잠시 문제가 생겼습니다. 입력 내용을 확인하고 다시 시도해 주세요.";
}

async function postJson(path: string, body: object) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    challengeToken?: string;
    proof?: string;
  };
  if (!response.ok) throw new Error(data.error || "요청을 처리하지 못했습니다.");
  return data;
}

export default function ParentSignupClient() {
  const searchParams = useSearchParams();
  const socialSignup = searchParams.get("social") === "1";
  const enrollmentHandoff = searchParams.get("enrollmentHandoff") || "";
  const next = searchParams.get("next") || "/parent";
  const initialName = searchParams.get("name") || "";
  const initialPhone = (searchParams.get("phone") || "").replace(/[^0-9]/g, "");
  const [step, setStep] = useState<Step>(socialSignup ? "phone" : "method");
  const [phone, setPhone] = useState(initialPhone);
  const [otp, setOtp] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [proof, setProof] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(searchParams.get("error"));

  async function startPhoneVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await postJson("/api/auth/parent-signup/start", { phone, social: socialSignup });
      if (!data.challengeToken) throw new Error("인증 요청을 다시 시도해 주세요.");
      setChallengeToken(data.challengeToken);
      setStep("phone");
    } catch (reason) {
      setError(friendlyError(reason));
    } finally {
      setLoading(false);
    }
  }

  async function verifyPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await postJson("/api/auth/parent-signup/verify-otp", {
        challengeToken,
        otp,
      });
      if (!data.proof) throw new Error("인증번호 확인을 다시 시도해 주세요.");
      setProof(data.proof);
      setStep("account");
    } catch (reason) {
      setError(friendlyError(reason));
    } finally {
      setLoading(false);
    }
  }

  async function completeSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    if (password !== String(form.get("passwordConfirm") || "")) {
      setError("비밀번호가 서로 다릅니다.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await postJson("/api/auth/parent-signup/complete", {
        challengeToken,
        proof,
        enrollmentHandoff: enrollmentHandoff || undefined,
        next,
        username: String(form.get("username") || "").trim(),
        ...(socialSignup ? {} : { password }),
        name: String(form.get("name") || "").trim(),
        consents: {
          terms: form.get("terms") === "on",
          privacy: form.get("privacy") === "on",
          age: form.get("age") === "on",
        },
      });
      setStep("done");
    } catch (reason) {
      setError(friendlyError(reason));
    } finally {
      setLoading(false);
    }
  }

  const progress = step === "method" ? 1 : step === "phone" ? 2 : step === "account" ? 3 : 4;
  const continueParams = new URLSearchParams({ next });
  if (enrollmentHandoff) continueParams.set("enrollmentHandoff", enrollmentHandoff);
  if (initialName) continueParams.set("name", initialName);
  if (initialPhone) continueParams.set("phone", initialPhone);

  return (
    <div className="space-y-6">
      {step !== "done" && (
        <div aria-label={`가입 ${progress}/3단계`} className="flex gap-2">
          {[1, 2, 3].map((number) => (
            <span key={number} className={`h-1.5 flex-1 rounded-full ${number <= progress ? "bg-brand-orange-500 dark:bg-brand-neon-lime" : "bg-gray-200 dark:bg-gray-700"}`} />
          ))}
        </div>
      )}

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {step === "method" && (
        <>
          <div>
            <h2 className="text-xl font-bold text-brand-navy-900 dark:text-white">학부모 회원가입</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">편한 가입 방법을 골라주세요.</p>
          </div>
          <button type="button" onClick={() => setStep("phone")} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-orange-500 px-4 font-bold text-white hover:bg-brand-orange-600 dark:bg-brand-neon-lime dark:text-brand-navy-900">
            아이디로 가입하기
          </button>
          <div className="flex items-center gap-3 text-xs text-gray-400"><span className="h-px flex-1 bg-gray-200" />간편가입<span className="h-px flex-1 bg-gray-200" /></div>
          <div className="grid gap-3">
            <Link href={`/auth/oauth/google?intent=parent-signup&${continueParams.toString()}`} className="flex min-h-12 items-center justify-center rounded-xl border border-gray-300 bg-white font-semibold text-gray-800">Google로 계속</Link>
            <Link href={`/auth/oauth/kakao?intent=parent-signup&${continueParams.toString()}`} className="flex min-h-12 items-center justify-center rounded-xl border border-gray-300 bg-white font-semibold text-gray-800">카카오로 계속</Link>
            <Link href={`/auth/oauth/naver?intent=parent-signup&${continueParams.toString()}`} className="flex min-h-12 items-center justify-center rounded-xl border border-gray-300 bg-white font-semibold text-gray-800">네이버로 계속</Link>
          </div>
          <p className="text-center text-xs leading-5 text-gray-500">간편가입도 처음 한 번은 안전한 계정 연결을 위해 휴대폰 인증이 필요합니다.</p>
        </>
      )}

      {step === "phone" && !challengeToken && (
        <form onSubmit={startPhoneVerification} className="space-y-4">
          <div><h2 className="text-xl font-bold">휴대폰 인증</h2><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">본인 명의로 사용하는 번호를 입력해 주세요.</p></div>
          <label className="block text-sm font-semibold">휴대폰 번호<input className={`${inputClass} mt-2`} type="tel" value={phone} onChange={(event) => setPhone(event.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" autoComplete="tel" placeholder="01012345678" minLength={10} maxLength={11} required /></label>
          {initialPhone && (
            <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">
              수강신청서의 보호자 번호를 불러왔습니다. 이 번호로 본인 인증해야 신청서가 계정에 연결됩니다.
            </p>
          )}
          <button disabled={loading} className="min-h-12 w-full rounded-xl bg-brand-orange-500 font-bold text-white disabled:opacity-50">{loading ? "보내는 중..." : "인증번호 받기"}</button>
        </form>
      )}

      {step === "phone" && challengeToken && (
        <form onSubmit={verifyPhone} className="space-y-4">
          <div><h2 className="text-xl font-bold">인증번호 입력</h2><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{phone}로 보낸 6자리 번호를 입력해 주세요.</p></div>
          <label className="block text-sm font-semibold">인증번호<input className={`${inputClass} mt-2 text-center text-xl tracking-[0.4em]`} value={otp} onChange={(event) => setOtp(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required /></label>
          <button disabled={loading || otp.length !== 6} className="min-h-12 w-full rounded-xl bg-brand-orange-500 font-bold text-white disabled:opacity-50">{loading ? "확인 중..." : "인증 완료"}</button>
          <button type="button" onClick={() => { setChallengeToken(""); setOtp(""); setError(null); }} className="w-full text-sm text-gray-600 underline">번호 다시 입력하기</button>
        </form>
      )}

      {step === "account" && (
        <form onSubmit={completeSignup} className="space-y-4">
          <div><h2 className="text-xl font-bold">계정 정보</h2><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">로그인에 사용할 정보만 입력하면 끝입니다.</p></div>
          <label className="block text-sm font-semibold">이름<input name="name" defaultValue={initialName} className={`${inputClass} mt-2`} autoComplete="name" required /></label>
          <label className="block text-sm font-semibold">로그인 아이디<input name="username" className={`${inputClass} mt-2`} autoComplete="username" minLength={4} maxLength={20} pattern="[A-Za-z][A-Za-z0-9_]{3,19}" placeholder="영문으로 시작, 영문·숫자·밑줄" required /></label>
          {!socialSignup && <label className="block text-sm font-semibold">비밀번호<input name="password" type="password" className={`${inputClass} mt-2`} autoComplete="new-password" minLength={8} placeholder="8자 이상" required /></label>}
          {!socialSignup && <label className="block text-sm font-semibold">비밀번호 확인<input name="passwordConfirm" type="password" className={`${inputClass} mt-2`} autoComplete="new-password" minLength={8} required /></label>}
          <div className="space-y-2 rounded-xl bg-gray-50 p-4 text-sm dark:bg-gray-900">
            <label className="flex gap-2"><input name="terms" type="checkbox" required /> <span><Link href="/terms" target="_blank" className="underline">이용약관</Link> 동의 (필수)</span></label>
            <label className="flex gap-2"><input name="privacy" type="checkbox" required /> <span><Link href="/privacy" target="_blank" className="underline">개인정보 수집·이용</Link> 동의 (필수)</span></label>
            <label className="flex gap-2"><input name="age" type="checkbox" required /> <span>만 14세 이상입니다 (필수)</span></label>
          </div>
          <button disabled={loading} className="min-h-12 w-full rounded-xl bg-brand-orange-500 font-bold text-white disabled:opacity-50">{loading ? "가입하는 중..." : "가입 완료"}</button>
        </form>
      )}

      {step === "done" && (
        <div className="py-6 text-center">
          <span className="material-symbols-outlined text-5xl text-brand-orange-500" aria-hidden="true">check_circle</span>
          <h2 className="mt-3 text-xl font-bold">가입이 완료됐습니다</h2>
          <p className="mt-2 text-sm text-gray-600">
            {enrollmentHandoff ? "수강신청서가 계정에 연결되었습니다. 로그인해서 확인해주세요." : "이제 만든 아이디로 로그인해 주세요."}
          </p>
          <Link href={`/login?${new URLSearchParams({ redirect: next }).toString()}`} className="mt-6 flex min-h-12 items-center justify-center rounded-xl bg-brand-orange-500 font-bold text-white">로그인하기</Link>
        </div>
      )}
    </div>
  );
}
