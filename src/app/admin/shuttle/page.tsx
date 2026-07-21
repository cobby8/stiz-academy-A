import { redirect } from "next/navigation";

/** Keeps old bookmarks and notification links working after shuttle moved into seasonal applications. */
export default function LegacyShuttleAdminPage() {
    redirect("/admin/seasonal?tab=applications");
}
