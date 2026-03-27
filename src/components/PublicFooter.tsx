/**
 * PublicFooter — 통합 공개 페이지 푸터 (Phase 1)
 *
 * 메인 랜딩과 서브페이지 양쪽에서 사용하던 푸터를 하나로 통합.
 * Server Component 가능 — 상태/이벤트가 없으므로 'use client' 불필요.
 *
 * props로 settings 데이터(phone, address)를 부모에서 받아온다.
 */

import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone } from "lucide-react";

// 부모에서 전달받을 props 타입
interface PublicFooterProps {
  phone: string;
  address: string;
}

// 퀵 링크 목록 — 헤더 메뉴와 동일하게 7개 전부 포함
const QUICK_LINKS = [
  { href: "/about", label: "학원/멤버소개" },
  { href: "/programs", label: "프로그램안내" },
  { href: "/schedule", label: "수업시간표" },
  { href: "/annual", label: "연간일정표" },
  { href: "/gallery", label: "포토갤러리" },
  { href: "/notices", label: "공지사항" },
  { href: "/apply", label: "체험/수강신청" },
];

export default function PublicFooter({ phone, address }: PublicFooterProps) {
  return (
    <footer className="bg-gray-900 text-gray-300 pt-12 pb-8 border-t-4 border-brand-orange-500">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {/* 학원 로고 + 소개 */}
          <div>
            <div className="bg-white px-4 py-2.5 rounded-lg inline-flex items-center justify-center mb-4">
              <Image
                src="/stiz-logo.png"
                alt="STIZ"
                width={140}
                height={35}
                className="h-9 w-auto object-contain"
              />
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              아이들이 농구를 통해 협동심과
              <br />
              건강한 체력을 기를 수 있도록 지도합니다.
            </p>
          </div>

          {/* 학원 정보 — 주소, 전화번호, 운영시간 */}
          <div>
            <h4 className="text-white font-bold mb-4">학원 정보</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              {address && (
                <li className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 text-gray-500 shrink-0" />
                  <span>{address}</span>
                </li>
              )}
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-500 shrink-0" />
                <span>{phone}</span>
              </li>
              <li className="text-xs text-gray-500 mt-1">
                평일 13:00~21:00 / 토 09:00~18:00
              </li>
            </ul>

            {/* 소셜미디어 아이콘 영역 — 향후 인스타그램 등 추가 예정 */}
            <div className="mt-4 flex gap-3">
              {/* 현재는 빈 공간만 준비. Phase 2 이후에 아이콘 추가 가능 */}
            </div>
          </div>

          {/* 퀵 링크 */}
          <div>
            <h4 className="text-white font-bold mb-4">바로가기</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              {QUICK_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 저작권 표시 + 이용약관 링크 */}
        <div className="border-t border-gray-800 pt-6 text-center text-xs text-gray-500">
          <p>&copy; 2026 STIZ Basketball Academy. All rights reserved.</p>
          {/* 독립 이용약관 페이지로 이동 */}
          <Link
            href="/terms"
            className="inline-block mt-2 text-gray-500 hover:text-white transition-colors underline underline-offset-2"
          >
            이용약관
          </Link>
        </div>
      </div>
    </footer>
  );
}
