"use client";

import Link from "next/link";
import { useInstalledApp } from "./useInstalledApp";

/**
 * 브라우저에서는 링크, 설치된 앱에서는 이동하지 않는 껍데기.
 *
 * 링크가 곧 내용인 자리에 쓴다(사진 타일 등). 감춰버리면 사진이 사라지지만,
 * 그대로 두면 설치된 앱이 제 범위를 벗어나 돌아올 길이 없어진다.
 * 겉모습은 같게 유지해 화면이 흔들리지 않는다.
 */
export default function AppSafeLink({
  href,
  className = "",
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const installed = useInstalledApp();
  if (installed) return <span className={className}>{children}</span>;
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
