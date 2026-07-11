import StaffClient from "./StaffClient";
import { getCachedAdminStaffPayload } from "@/lib/adminReadPayloads";

export const revalidate = 30;

export default async function StaffPage() {
    const { staffUsers, coaches, invitations } = await getCachedAdminStaffPayload();

    return (
        <StaffClient
            staffUsers={staffUsers}
            coaches={coaches}
            invitations={invitations}
        />
    );
}
