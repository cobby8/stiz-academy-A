"use client";

import { useEffect } from "react";
import {
  DRIVER_TOKEN_STORAGE_KEY,
  sanitizeStoredDriverToken,
} from "@/lib/shuttle/driverTokenStorage";

/**
 * 열려 있는 운행 링크를 이 기기에 기억시킨다(화면에는 아무것도 그리지 않는다).
 *
 * 서버가 토큰을 확인한 뒤에만 이 컴포넌트를 그린다. 만료된 링크를 기억하면
 * 홈 화면 아이콘이 매번 "유효하지 않은 링크" 화면을 여는 꼴이 된다.
 */
export default function RememberDriverToken({ token }: { token: string }) {
  useEffect(() => {
    const safe = sanitizeStoredDriverToken(token);
    if (!safe) return;
    try {
      window.localStorage.setItem(DRIVER_TOKEN_STORAGE_KEY, safe);
    } catch {
      // 사생활 보호 모드 등으로 저장이 막힌 기기. 링크로 여는 기존 방식은 그대로 된다.
    }
  }, [token]);

  return null;
}
