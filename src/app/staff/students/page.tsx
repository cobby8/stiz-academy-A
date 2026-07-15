import StaffStudentsClient from "./StaffStudentsClient";
import { getStaffStudents } from "@/lib/staff-portal-queries";
export const dynamic = "force-dynamic";
export default async function StaffStudentsPage() { return <StaffStudentsClient students={await getStaffStudents()} />; }
