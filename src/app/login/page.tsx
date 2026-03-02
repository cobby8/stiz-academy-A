import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function LoginPage() {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="p-8 pb-6 border-b border-gray-100 bg-brand-navy-900 text-center relative">
                    <Link href="/" className="absolute left-6 top-6 text-white/70 hover:text-white transition">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <div className="w-12 h-12 bg-brand-orange-500 rounded-xl mx-auto flex items-center justify-center font-black italic text-white text-xl shadow-lg mb-4">
                        STIZ
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">학부모 로그인</h1>
                    <p className="text-brand-orange-50 text-sm opacity-80">우리아이 스마트 학원 관리 시스템</p>
                </div>

                <div className="p-8">
                    <form className="space-y-6">
                        <div>
                            <label htmlFor="phone" className="block text-sm font-bold text-gray-700 mb-2">휴대폰 번호</label>
                            <input
                                type="tel"
                                id="phone"
                                name="phone"
                                placeholder="010-0000-0000"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange-500 focus:bg-white transition text-gray-900"
                                required
                            />
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label htmlFor="password" className="block text-sm font-bold text-gray-700">비밀번호</label>
                                <Link href="#" className="text-sm font-medium text-brand-orange-500 hover:text-brand-orange-600">비밀번호 찾기</Link>
                            </div>
                            <input
                                type="password"
                                id="password"
                                name="password"
                                placeholder="비밀번호를 입력해주세요"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange-500 focus:bg-white transition text-gray-900"
                                required
                            />
                        </div>

                        <div className="pt-2">
                            <Link
                                href="/mypage"
                                className="w-full block text-center py-4 px-4 bg-brand-orange-500 hover:bg-brand-orange-600 text-white font-bold rounded-lg transition-colors shadow-md shadow-brand-orange-500/20"
                            >
                                로그인
                            </Link>
                        </div>
                    </form>

                    <div className="mt-8 text-center text-sm text-gray-500">
                        아직 STIZ 스마트 시스템 회원이 아니신가요? <br />
                        <Link href="/signup" className="text-brand-navy-900 font-bold hover:underline mt-2 inline-block">신규 원생 가입 후 이용 가능합니다</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
