import { getAcademySettings, getCoaches } from "@/app/actions/admin";
import AdminSettingsClient from "./AdminSettingsClient";

export default async function AdminSettingsPage() {
    let settings = null;
    let coaches: any[] = [];
    let fetchError = false;

    try {
        settings = await getAcademySettings();
        coaches = await getCoaches();
    } catch (e) {
        console.error("Error fetching settings:", e);
        fetchError = true;
    }

    return <AdminSettingsClient initialSettings={settings} coaches={coaches} fetchError={fetchError} />;
}
