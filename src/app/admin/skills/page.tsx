import SkillsClient from "./SkillsClient";

// Keep the admin page cache policy while letting the shell render first.
export const revalidate = 30;

export default function AdminSkillsPage() {
    return <SkillsClient />;
}
