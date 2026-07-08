import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guard";
import AdminShellClient from "./AdminShellClient";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    let adminUser: Awaited<ReturnType<typeof requireAdmin>>;

    try {
        adminUser = await requireAdmin();
    } catch {
        redirect("/login?redirect=/admin");
    }

    return (
        <AdminShellClient
            initialUserName={adminUser.user_metadata?.name || "관리자"}
            initialUserEmail={adminUser.email || ""}
        >
            {children}
        </AdminShellClient>
    );
}
