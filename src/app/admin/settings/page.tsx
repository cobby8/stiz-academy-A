import { getAcademySettings } from "@/lib/queries";
import AdminSettingsClient from "./AdminSettingsClient";

export default async function AdminSettingsPage() {
    let settings = null;
    let fetchError = false;

    try {
        settings = await getAcademySettings();
    } catch (e) {
        console.error("Error fetching settings:", e);
        fetchError = true;
    }

    return <AdminSettingsClient initialSettings={settings} fetchError={fetchError} />;
}
