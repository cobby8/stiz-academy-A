import Link from "next/link";
import { redirect } from "next/navigation";
import { requireVerifiedParent } from "@/lib/auth-guard";
import { bindIdentity } from "@/lib/kakao-parent-chatbot";

export const dynamic = "force-dynamic";

export default async function KakaoConnectPage({ searchParams }: { searchParams: Promise<{ token?: string; done?: string }> }) {
  const params = await searchParams;
  const token = params.token?.trim() || "";
  const parent = await requireVerifiedParent();

  async function connect() {
    "use server";
    const verifiedParent = await requireVerifiedParent();
    if (!token) throw new Error("인증 링크가 없습니다.");
    await bindIdentity(token, verifiedParent.appUserId);
    redirect("/mypage/kakao-connect?done=1");
  }

  if (params.done === "1") {
    return (
      <main className="mx-auto max-w-lg px-5 py-12">
        <div className="rounded-3xl border border-emerald-200 bg-white p-7 text-center shadow-sm">
          <div className="text-4xl">✅</div>
          <h1 className="mt-4 text-xl font-black text-gray-950">카카오 학부모 인증 완료</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">이제 카카오 채널에서 평소처럼 말씀하시면 연결된 자녀를 자동으로 확인합니다. 결석·당일 셔틀·입금·영수증은 실제 수업과 청구서를 고르는 전용 화면으로 바로 접수할 수 있어요.</p>
          <div className="mt-6 grid gap-2">
            <a href="https://pf.kakao.com/_HhaQG/chat" className="inline-flex justify-center rounded-xl bg-yellow-400 px-5 py-3 text-sm font-black text-gray-950">카카오 채널로 돌아가기</a>
            <Link href="/mypage" className="inline-flex justify-center rounded-xl bg-gray-950 px-5 py-3 text-sm font-bold text-white">학부모 마이페이지 보기</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-5 py-12">
      <div className="rounded-3xl border border-yellow-200 bg-white p-7 shadow-sm">
        <p className="text-sm font-bold text-yellow-700">최초 1회 인증</p>
        <h1 className="mt-2 text-2xl font-black text-gray-950">카카오와 학부모 계정 연결</h1>
        <p className="mt-4 text-sm leading-6 text-gray-600">{parent.appUserName} 학부모님의 검증된 계정을 현재 카카오 대화와 연결합니다. 카카오 사용자 키와 전화번호 원문은 화면이나 운영 기록에 노출하지 않습니다.</p>
        <form action={connect} className="mt-7">
          <button disabled={!token} className="w-full rounded-xl bg-yellow-400 px-5 py-3.5 font-black text-gray-950 disabled:cursor-not-allowed disabled:opacity-40">이 카카오 계정 연결하기</button>
        </form>
        <p className="mt-4 text-xs leading-5 text-gray-500">본인이 요청하지 않았다면 연결하지 말고 창을 닫아주세요. 인증 링크는 15분 후 만료됩니다.</p>
      </div>
    </main>
  );
}
