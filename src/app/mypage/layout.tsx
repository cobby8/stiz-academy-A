import { Home, Calendar, CreditCard, User } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function MyPageLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col pb-20 md:pb-0">
            {/* Mobile Top Header */}
            <header className="bg-white sticky top-0 z-50 shadow-sm border-b border-gray-100 flex items-center justify-between px-4 py-3 md:hidden">
                <Link href="/" className="flex items-center gap-2">
                    <Image src="/stiz-logo.png" alt="STIZ" width={100} height={25} className="h-7 w-auto object-contain" />
                </Link>
                <span className="font-bold text-gray-900 text-sm">마이페이지</span>
            </header>

            {/* Desktop Header */}
            <header className="bg-white sticky top-0 z-50 shadow-sm border-b border-gray-100 hidden md:flex items-center justify-between px-8 py-4">
                <Link href="/" className="flex items-center gap-2">
                    <Image src="/stiz-logo.png" alt="STIZ" width={140} height={35} className="h-9 w-auto object-contain" />
                    <span className="font-extrabold text-xl text-brand-navy-900">
                        스티즈농구교실 <span className="text-brand-orange-500">다산점</span>
                    </span>
                </Link>
                <nav className="flex items-center gap-8 font-bold text-gray-600">
                    <Link href="/mypage" className="hover:text-brand-orange-500 transition-colors">마이페이지</Link>
                    <Link href="/" className="hover:text-brand-orange-500 transition-colors">홈으로</Link>
                </nav>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8">
                {children}
            </main>

            {/* Mobile Bottom Navigation */}
            <nav className="md:hidden fixed bottom-0 w-full bg-white border-t border-gray-200 flex justify-around items-center h-16 pb-safe z-50">
                <NavItem href="/mypage" icon={<Home className="w-6 h-6" />} label="홈" />
                <NavItem href="/schedule" icon={<Calendar className="w-6 h-6" />} label="시간표" />
                <NavItem href="/programs" icon={<CreditCard className="w-6 h-6" />} label="프로그램" />
                <NavItem href="/" icon={<User className="w-6 h-6" />} label="홈페이지" />
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
