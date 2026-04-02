/**
 * 스태프 관리 페이지 — 서버 컴포넌트
 * ADMIN/VICE_ADMIN/INSTRUCTOR 사용자 목록 + Coach 연결 + 초대 목록을 조회하여 클라이언트에 전달
 * revalidate: 30 — 역할 변경 시 Server Action에서 revalidatePath로 즉시 갱신
 */

import { getStaffUsers, getAllCoaches, getStaffInvitations } from "@/lib/queries";
import { ensureStaffColumns, ensureStaffInvitationTable } from "@/app/actions/admin";
import StaffClient from "./StaffClient";

export const revalidate = 30;

export default async function StaffPage() {
    // DDL ensure: VICE_ADMIN enum + Coach.userId + StaffInvitation 테이블 자동 생성
    await Promise.all([
        ensureStaffColumns(),
        ensureStaffInvitationTable(),
    ]);

    // 스태프 목록 + 코치 목록 + 초대 목록 병렬 조회
    const [staffUsers, coaches, invitations] = await Promise.all([
        getStaffUsers(),
        getAllCoaches(),
        getStaffInvitations(),
    ]);

    return (
        <StaffClient
            staffUsers={staffUsers}
            coaches={coaches}
            invitations={invitations}
        />
    );
}
