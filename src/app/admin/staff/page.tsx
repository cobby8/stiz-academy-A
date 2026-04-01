/**
 * 스태프 관리 페이지 — 서버 컴포넌트
 * ADMIN/VICE_ADMIN/INSTRUCTOR 사용자 목록 + Coach 연결 정보를 조회하여 클라이언트에 전달
 * revalidate: 30 — 역할 변경 시 Server Action에서 revalidatePath로 즉시 갱신
 */

import { getStaffUsers, getAllCoaches } from "@/lib/queries";
import { ensureStaffColumns } from "@/app/actions/admin";
import StaffClient from "./StaffClient";

export const revalidate = 30;

export default async function StaffPage() {
    // DDL ensure: VICE_ADMIN enum + Coach.userId 컬럼이 없으면 자동 생성
    await ensureStaffColumns();

    // 스태프 목록 + 코치 목록 병렬 조회
    const [staffUsers, coaches] = await Promise.all([
        getStaffUsers(),
        getAllCoaches(),
    ]);

    return <StaffClient staffUsers={staffUsers} coaches={coaches} />;
}
