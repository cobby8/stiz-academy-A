export type StaffNavigationPreparation = { ok: boolean; message?: string };

export function prepareStaffNavigation() {
  return new Promise<StaffNavigationPreparation>((resolve) => {
    const detail = { handled: false, complete: resolve };
    window.dispatchEvent(new CustomEvent("staff:prepare-navigation", { detail }));
    if (!detail.handled) resolve({ ok: true });
  });
}
