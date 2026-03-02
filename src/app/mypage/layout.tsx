import { Home, Calendar, CreditCard, User, Bell } from "lucide-react";
import Link from "next/link";

export default function MyPageLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col pb-20 md:pb-0">
            {/* Mobile Top Header */}
            <header className="bg-white sticky top-0 z-50 shadow-sm border-b border-gray-100 flex items-center justify-between px-4 py-3 md:hidden">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-brand-orange-500 text-white font-black italic rounded flex items-center justify-center text-sm">
                        S
                    </div>
                    <span className="font-bold text-gray-900">마이페이지</span>
                </div>
                <button className="text-gray-500 relative">
                    <Bell className="w-6 h-6" />
                    <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
            </header>

            {/* Desktop Header */}
            <header className="bg-white sticky top-0 z-50 shadow-sm border-b border-gray-100 hidden md:flex items-center justify-between px-8 py-4">
                <Link href="/" className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-brand-orange-500 text-white font-black italic rounded flex items-center justify-center text-xl">
                        STIZ
                    </div>
                    <span className="font-extrabold text-xl text-brand-navy-900">
                        스티즈농구교실 <span className="text-brand-orange-500">다산점</span>
                    </span>
                </Link>
                <nav className="flex items-center gap-8 font-bold text-gray-600">
                    <Link href="/mypage" className="text-brand-orange-500">학습현황</Link>
                    <Link href="/mypage/attendance" className="hover:text-brand-orange-500">출결/보강</Link>
                    <Link href="/mypage/payment" className="hover:text-brand-orange-500">수납관리</Link>
                </nav>
                <div className="flex items-center gap-4">
                    <button className="text-gray-500 hover:text-gray-900 relative">
                        <Bell className="w-6 h-6" />
                        <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gray-200"></div>
                        <span className="text-sm font-bold text-gray-700">박학부모님</span>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8">
                {children}
            </main>

            {/* Mobile Bottom Navigation */}
            <nav className="md:hidden fixed bottom-0 w-full bg-white border-t border-gray-200 flex justify-around items-center h-16 pb-safe z-50">
                <NavItem href="/mypage" icon={<Home className="w-6 h-6" />} label="홈" active />
                <NavItem href="/mypage/attendance" icon={<Calendar className="w-6 h-6" />} label="출결/보강" />
                <NavItem href="/mypage/payment" icon={<CreditCard className="w-6 h-6" />} label="결제" />
                <NavItem href="/mypage/profile" icon={<User className="w-6 h-6" />} label="내 정보" />
            </nav>
        </div>
    );
}

function NavItem({ href, icon, label, active }: any) {
    return (
        <Link href={href} className={`flex flex-col items-center justify-center w-full h-full gap-1 ${active ? 'text-brand-orange-500' : 'text-gray-400'}`}>
            {icon}
            <span className="text-[10px] font-bold">{label}</span>
        </Link>
    );
}
