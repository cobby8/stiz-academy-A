/**
 * 스태프 관리 페이지 — 서버 컴포넌트
 * ADMIN/VICE_ADMIN/INSTRUCTOR 사용자 목록 + Coach 연결 + 초대 목록을 조회하여 클라이언트에 전달
 * revalidate: 30 — 역할 변경 시 Server Action에서 revalidatePath로 즉시 갱신
 */

import { getStaffUsers, getAllCoaches, getStaffInvitations } from "@/lib/queries";
import StaffClient from "./StaffClient";

export const revalidate = 30;

export default async function StaffPage() {
    // 구조 보강은 스태프 생성/역할 변경/초대 액션에서 수행하고, 목록 화면은 읽기만 빠르게 처리한다.
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
