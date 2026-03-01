import { Users, CreditCard, CalendarCheck, TrendingUp } from "lucide-react";

export default function AdminDashboard() {
    return (
        <div className="max-w-7xl mx-auto space-y-8">
            {/* Welcome Heading */}
            <div>
                <h1 className="text-2xl font-extrabold text-gray-900 mb-2">대시보드</h1>
                <p className="text-gray-500">스티즈농구교실 다산점의 오늘 현황입니다.</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="총 재원생 수"
                    value="152명"
                    change="+3명 이번달"
                    icon={<Users className="w-6 h-6 text-blue-500" />}
                    positive={true}
                />
                <StatCard
                    title="이번달 예상 수납액"
                    value="15,400,000원"
                    change="85% 수납 완료"
                    icon={<CreditCard className="w-6 h-6 text-brand-orange-500" />}
                />
                <StatCard
                    title="오늘 출석률"
                    value="92%"
                    change="결석 예정 4명"
                    icon={<CalendarCheck className="w-6 h-6 text-emerald-500" />}
                />
                <StatCard
                    title="신규 문의"
                    value="8건"
                    change="미확인 3건"
                    icon={<TrendingUp className="w-6 h-6 text-purple-500" />}
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Today's Schedule */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-gray-900 text-lg">오늘의 수업 일정</h3>
                        <button className="text-sm text-brand-orange-500 font-medium hover:underline">시간표 관리</button>
                    </div>

                    <div className="space-y-4">
                        {[
                            { time: "14:00 - 15:30", name: "초등 저학년 기초반", coach: "김스티즈 강사", students: "8/10명" },
                            { time: "16:00 - 17:30", name: "초등 고학년 스킬반", coach: "이농구 강사", students: "12/12명 (마감)" },
                            { time: "18:00 - 19:30", name: "중등부 대표팀", coach: "최다산 원장", students: "9/12명" },
                        ].map((schedule, i) => (
                            <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-brand-orange-300 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="bg-orange-50 text-brand-orange-600 px-3 py-1 rounded-md font-bold text-sm">
                                        {schedule.time}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900">{schedule.name}</h4>
                                        <span className="text-xs text-gray-500">{schedule.coach} 담당</span>
                                    </div>
                                </div>
                                <div className="text-sm font-medium text-gray-600 bg-gray-50 px-3 py-1 rounded-full">
                                    {schedule.students}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Action Items / Alerts */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-900 text-lg mb-6">확인 필요</h3>
                    <div className="space-y-4">
                        <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                            <div className="text-red-800 font-bold text-sm mb-1">수강료 미납 알림</div>
                            <p className="text-red-600 text-xs mb-3">3명의 원생이 수강료 납부일을 초과했습니다.</p>
                            <button className="text-xs bg-white text-red-600 border border-red-200 px-3 py-1.5 rounded font-medium hover:bg-red-50">알림톡 발송하기</button>
                        </div>
                        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                            <div className="text-blue-800 font-bold text-sm mb-1">보강 신청 대기</div>
                            <p className="text-blue-600 text-xs mb-3">박가온 학생이 금일 16시 수업 보강을 신청했습니다.</p>
                            <div className="flex gap-2">
                                <button className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded font-medium hover:bg-blue-700">승인</button>
                                <button className="text-xs bg-white text-blue-600 border border-blue-200 px-3 py-1.5 rounded font-medium">거절</button>
                            </div>
                        </div>
                        <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-xl">
                            <div className="text-yellow-800 font-bold text-sm mb-1">신규 가입 대기</div>
                            <p className="text-yellow-700 text-xs">어제 2명의 학부모님이 앱에 가입했습니다. 승인 대기중입니다.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, change, icon, positive }: any) {
    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
                    <h3 className="text-3xl font-extrabold text-gray-900">{value}</h3>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                    {icon}
                </div>
            </div>
            <div>
                <span className={`text-sm font-medium ${positive ? 'text-green-600' : 'text-gray-500'}`}>
                    {change}
                </span>
            </div>
        </div>
    );
}
