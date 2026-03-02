import { CalendarCheck, CreditCard, ChevronRight, Bus, MapPin } from "lucide-react";

export default function MyPageDashboard() {
    return (
        <div className="space-y-6">
            {/* Student Selector / Greeting */}
            <div className="bg-brand-navy-900 text-white rounded-2xl p-6 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 mix-blend-overlay rounded-full -mr-10 -mt-10 blur-xl"></div>
                <div className="relative z-10">
                    <div className="flex justify-between items-center mb-4">
                        <h1 className="text-2xl font-bold">
                            박가온 <span className="text-brand-orange-500 text-lg font-medium">학생</span>
                        </h1>
                        <button className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full text-xs font-bold transition">
                            자녀 변경
                        </button>
                    </div>
                    <p className="text-gray-300 text-sm mb-6">초등 저학년 기초반 (화/목 14:00)</p>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/5">
                            <div className="text-white/60 text-xs font-medium mb-1">이번 달 출석</div>
                            <div className="text-xl font-bold">8 <span className="text-sm font-normal text-white/60">/ 8회</span></div>
                        </div>
                        <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/5">
                            <div className="text-white/60 text-xs font-medium mb-1">잔여 보강권</div>
                            <div className="text-xl font-bold text-brand-orange-400">1 <span className="text-sm font-normal text-white/60">회</span></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Action Alerts */}
            <div className="space-y-3">
                {/* Payment Alert (Conditional) */}
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3 text-red-700">
                        <div className="bg-white p-2 rounded-full shadow-sm text-red-500">
                            <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="font-bold text-sm">3월 수강료 결제 안내</p>
                            <p className="text-xs text-red-600 opacity-80 mt-0.5">납부 마감일: 3월 5일</p>
                        </div>
                    </div>
                    <button className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-full shadow-sm transition">
                        결제하기
                    </button>
                </div>

                {/* Shuttle Bus Tracker */}
                <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center justify-between shadow-sm hover:border-brand-orange-300 transition cursor-pointer group">
                    <div className="flex items-center gap-3 text-gray-800">
                        <div className="bg-blue-50 p-2 rounded-full text-blue-500 group-hover:bg-brand-orange-50 group-hover:text-brand-orange-500 transition">
                            <Bus className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="font-bold text-sm">셔틀버스 실시간 위치</p>
                            <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                                <MapPin className="w-3 h-3 text-brand-orange-500" />
                                <span>현재 다산롯데캐슬 앞 정차중</span>
                            </div>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-brand-orange-500" />
                </div>
            </div>

            {/* Recent Class Log */}
            <div>
                <div className="flex justify-between items-center mb-4 px-1">
                    <h2 className="font-bold text-gray-900">최근 수업 일지</h2>
                    <button className="text-xs font-medium text-gray-500 hover:text-brand-orange-500">전체보기</button>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex gap-3">
                            <div className="bg-emerald-50 text-emerald-600 font-bold text-xs px-2.5 py-1 rounded">출석완료</div>
                            <div className="text-sm font-bold text-gray-900">2월 26일 (목)</div>
                        </div>
                        <span className="text-xs text-gray-500">담당: 김스티즈 강사</span>
                    </div>
                    <h3 className="font-bold text-gray-800 mb-2">드리블 기초 및 패스 워밍업</h3>
                    <p className="text-gray-600 text-sm leading-relaxed mb-4">
                        오늘은 양손 드리블 밸런스를 맞추는 훈련과 체스트 패스, 바운스 패스 기초를 진행했습니다. 가온이가 드리블 할 때 시선을 앞으로 두는 것을 많이 어려워했지만 연습을 통해 점점 나아지는 모습을 보였습니다.
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        <img src="https://api.system/placeholder/noise" className="w-24 h-24 object-cover rounded-lg bg-gray-100 border border-gray-200" alt="수업 사진" />
                        <img src="https://api.system/placeholder/noise" className="w-24 h-24 object-cover rounded-lg bg-gray-100 border border-gray-200" alt="수업 사진" />
                    </div>
                </div>
            </div>
        </div>
    );
}
