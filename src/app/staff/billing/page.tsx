import StaffBillingClient from "./StaffBillingClient";
import { getStaffBilling } from "@/lib/staff-portal-queries";
export const dynamic = "force-dynamic";
export default async function StaffBillingPage() { return <StaffBillingClient bills={await getStaffBilling()} />; }
