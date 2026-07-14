"use client";

import { useState } from "react";
import { login, signup } from "@/app/actions/auth";
import Image from "next/image";
import Link from "next/link";
import { isRedirectError } from "next/dist/client/components/redirect-error";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // 비밀번호 보기/숨기기 토글 상태
  const [showPassword, setShowPassword] = useState(false);
  // 개인정보보호법 준수: 회원가입 시 동의 체크박스 상태
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setLoading(true);

    const requestedPath = new URLSearchParams(window.location.search).get("redirect");
    if (requestedPath?.startsWith("/") && !requestedPath.startsWith("//")) {
      formData.set("redirectTo", requestedPath);
    }

    try {
      const action = mode === "login" ? login : signup;
      const result = await action(formData);
      if (result?.error) {
        setError(result.error);
      }
      setLoading(false);
    } catch (err) {
      if (isRedirectError(err)) {
        throw err;
      }
      setError(err instanceof Error ? err.message : "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      setLoading(false);
    }
  }

  return (
    // surface-warm 배경 — 공개 페이지와 동일한 따뜻한 톤
    <div className="min-h-screen bg-surface-warm dark:bg-gray-950 flex items-center justify-center px-4 relative overflow-hidden">
      {/* 배경 장식 도형 — 공개 페이지 히어로 패턴과 통일된 반투명 원형 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute right-0 top-0 w-96 h-96 border-[30px] border-brand-navy-900/5 rounded-full translate-x-1/3 -translate-y-1/3" />
        <div className="absolute left-0 bottom-0 w-64 h-64 border-[20px] border-brand-orange-500 dark:border-brand-neon-lime/5 rounded-full -translate-x-1/4 translate-y-1/4" />
        <div className="absolute right-1/4 bottom-1/4 w-32 h-32 border-[10px] border-brand-orange-500 dark:border-brand-neon-lime/5 rounded-full" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* 로고 & 타이틀 — STIZ 실제 로고 사용 + 용도 명확화 */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image
              src="/stiz-logo.png"
              alt="STIZ 농구교실"
              width={160}
              height={40}
              className="h-10 w-auto object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-brand-navy-900 dark:text-white">
            STIZ 로그인
          </h1>
          <p className="text-brand-navy-700 dark:text-gray-300 mt-1">계정 권한에 맞는 화면으로 이동합니다</p>
        </div>

        {/* 카드 — 기존 구조 유지, 디자인 토큰 적용 */}
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          {/* 탭 — 기존 구조 유지 */}
          <div className="flex mb-6 bg-gray-100 dark:bg-gray-900 rounded-lg p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
                setShowPassword(false); // 모드 전환 시 비밀번호 숨김으로 초기화
                setAgreePrivacy(false); // 동의 체크박스 초기화
                setAgreeTerms(false);
              }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === "login"
                  ? "bg-white text-brand-navy-900 dark:bg-brand-neon-lime dark:text-brand-navy-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
              }`}
            >
              로그인
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
                setShowPassword(false); // 모드 전환 시 비밀번호 숨김으로 초기화
                setAgreePrivacy(false);
                setAgreeTerms(false);
              }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === "signup"
                  ? "bg-white text-brand-navy-900 dark:bg-brand-neon-lime dark:text-brand-navy-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
              }`}
            >
              계정 만들기
            </button>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* 폼 — 기존 구조 100% 유지, 포커스 색상만 브랜드 오렌지로 통일 */}
          <form action={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                  >
                    이름
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    autoComplete="off"
                    placeholder="홍길동"
                    className="w-full px-4 py-2.5 border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 rounded-lg focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime focus:border-brand-orange-500 dark:border-gray-600 dark:bg-gray-950 dark:text-white dark:placeholder:text-gray-500 outline-none transition-colors"
                  />
                </div>
              </>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
              >
                이메일
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete={mode === "login" ? "email" : "off"}
                placeholder="example@email.com"
                className="w-full px-4 py-2.5 border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 rounded-lg focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime focus:border-brand-orange-500 dark:border-gray-600 dark:bg-gray-950 dark:text-white dark:placeholder:text-gray-500 outline-none transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
              >
                비밀번호
              </label>
              {/* 비밀번호 입력 + 보기/숨기기 토글을 감싸는 relative 컨테이너 */}
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete={mode === "login" ? "current-password" : "off"}
                  placeholder="6자 이상"
                  className="w-full px-4 py-2.5 pr-10 border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 rounded-lg focus:ring-2 focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime focus:border-brand-orange-500 dark:border-gray-600 dark:bg-gray-950 dark:text-white dark:placeholder:text-gray-500 outline-none transition-colors"
                />
                {/* 비밀번호 보기/숨기기 토글 버튼 — 눈 아이콘 인라인 SVG */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-300 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                >
                  {showPassword ? (
                    /* 눈 열림 아이콘 — 비밀번호가 보이는 상태 */
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : (
                    /* 눈 닫힘 아이콘 (사선 있음) — 비밀번호가 숨겨진 상태 */
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* 회원가입 모드에서만 개인정보 동의 체크박스 표시 (개인정보보호법 준수) */}
            {mode === "signup" && (
              <div className="space-y-3 pt-2 pb-1">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreePrivacy}
                    onChange={(e) => setAgreePrivacy(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-brand-orange-500 dark:text-brand-neon-lime focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-200">
                    <a
                      href="/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-orange-500 dark:text-brand-neon-lime underline underline-offset-2 hover:text-brand-orange-600 dark:text-brand-neon-lime dark:hover:text-lime-400"
                    >
                      개인정보 수집 및 이용
                    </a>
                    에 동의합니다 <span className="text-red-500">(필수)</span>
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-brand-orange-500 dark:text-brand-neon-lime focus:ring-brand-orange-500 dark:focus:ring-brand-neon-lime"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-200">
                    <a
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-orange-500 dark:text-brand-neon-lime underline underline-offset-2 hover:text-brand-orange-600 dark:text-brand-neon-lime dark:hover:text-lime-400"
                    >
                      이용약관
                    </a>
                    에 동의합니다 <span className="text-red-500">(필수)</span>
                  </span>
                </label>
              </div>
            )}

            {loading && (
              <div
                role="status"
                aria-live="polite"
                className="flex items-center gap-2 rounded-lg border border-brand-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-brand-orange-700 dark:border-brand-neon-lime/30 dark:bg-brand-neon-lime/10 dark:text-brand-neon-lime"
              >
                <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                <span>
                  {mode === "login"
                    ? "로그인 중입니다. 이동할 때까지 잠시만 기다려 주세요."
                    : "계정을 만드는 중입니다. 잠시만 기다려 주세요."}
                </span>
              </div>
            )}

            {/* 제출 버튼 — 회원가입 모드에서는 두 체크박스 모두 체크해야 활성화 */}
            <button
              type="submit"
              disabled={
                loading ||
                (mode === "signup" && (!agreePrivacy || !agreeTerms))
              }
              className="flex min-h-11 w-full items-center justify-center gap-2 py-2.5 bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 hover:bg-brand-orange-600 dark:hover:bg-lime-400 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && (
                <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
              )}
              <span>
                {loading
                  ? mode === "login"
                    ? "로그인 중..."
                    : "계정 생성 중..."
                  : mode === "login"
                    ? "로그인"
                    : "학부모 계정 만들기"}
              </span>
            </button>
          </form>
        </div>

        {/* 하단 링크 — 기존 구조 유지 */}
        <div className="text-center mt-6">
          <Link href="/" className="text-sm text-brand-navy-700 hover:text-brand-orange-500 dark:text-gray-200 dark:hover:text-brand-neon-lime transition-colors">
            홈페이지로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
