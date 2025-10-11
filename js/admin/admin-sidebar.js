const SIDEBAR_PATH = "./admin-sidebar.html";

async function loadSidebarTemplate() {
  const sidebarEl = document.getElementById("sidebar");
  if (!sidebarEl) return null;

  try {
    const response = await fetch(SIDEBAR_PATH);
    if (!response.ok) throw new Error(`Failed to load sidebar template: ${response.status}`);
    const html = await response.text();
    sidebarEl.innerHTML = html;
    document.dispatchEvent(new CustomEvent("adminSidebarReady"));
    return sidebarEl;
  } catch (error) {
    console.error("Error loading sidebar:", error);
    return null;
  }
}

function highlightActiveLink(sidebarEl) {
  if (!sidebarEl) return;

  const currentPage = (window.location.pathname.split("/").pop() || "").toLowerCase();
  const links = sidebarEl.querySelectorAll(".sidebar__link[href]");
  let activeApplied = false;

  links.forEach((link) => {
    const href = (link.getAttribute("href") || "").toLowerCase();
    if (!href || href === "#") return;

    const normalizedHref = href.split("?")[0];
    if (currentPage === normalizedHref) {
      link.classList.add("is-active");
      activeApplied = true;
    }
  });

  if (!activeApplied && links.length) {
    links[0].classList.add("is-active");
  }
}

function registerSidebarEvents(sidebarEl) {
  if (!sidebarEl) return;

  const logoutButton = sidebarEl.querySelector('[data-action="logout"]');
  if (logoutButton) {
    logoutButton.addEventListener("click", (event) => {
      event.preventDefault();
      try {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user_data");
      } catch (error) {
        console.warn("Failed to clear local storage on logout", error);
      }
      window.location.href = "/register/login.html";
    });
  }

  const links = sidebarEl.querySelectorAll(".sidebar__link");
  links.forEach((link) => {
    link.addEventListener("click", () => {
      document.body.classList.remove("sidebar-open");
    });
  });
}

async function initAdminSidebar() {
  const sidebarEl = await loadSidebarTemplate();
  if (!sidebarEl) return;

  highlightActiveLink(sidebarEl);
  registerSidebarEvents(sidebarEl);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void initAdminSidebar();
  });
} else {
  void initAdminSidebar();
}
