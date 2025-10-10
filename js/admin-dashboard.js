import { ensureAdminAccess } from "./admin/admin-auth.js";

async function initAdminDashboard() {
  try {
    await ensureAdminAccess();
    document.body.classList.add("admin-dashboard-ready");
  } catch (error) {
    console.error("Admin dashboard bootstrap failed", error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void initAdminDashboard();
  });
} else {
  void initAdminDashboard();
}
