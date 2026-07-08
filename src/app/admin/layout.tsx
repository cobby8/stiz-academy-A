import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guard";
import AdminShellClient from "./AdminShellClient";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    try {
        await requireAdmin();
    } catch {
        redirect("/login?redirect=/admin");
    }

    return <AdminShellClient>{children}</AdminShellClient>;
}
