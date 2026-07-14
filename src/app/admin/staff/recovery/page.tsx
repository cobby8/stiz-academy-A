import { requireOwner } from "@/lib/auth-guard";
import { listStaffInvitationRecoveries } from "@/app/actions/staff-invite-recovery";
import StaffInviteRecoveryClient from "./StaffInviteRecoveryClient";

export const dynamic = "force-dynamic";

export default async function StaffInviteRecoveryPage() {
  await requireOwner();
  const invitations = await listStaffInvitationRecoveries();
  return <StaffInviteRecoveryClient initialInvitations={invitations.map((item) => ({
    ...item,
    processingStartedAt: item.processingStartedAt?.toISOString() || null,
  }))} />;
}
