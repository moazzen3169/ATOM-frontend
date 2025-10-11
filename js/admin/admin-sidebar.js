document.addEventListener('DOMContentLoaded', async () => {
  const sidebarEl = document.getElementById('sidebar');
  if (!sidebarEl) return;

  try {
    const response = await fetch('admin-dashboard/admin-sidebar.html');
    if (!response.ok) throw new Error('Failed to load sidebar');
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const sidebarContent = doc.querySelector('.user_sidebar_container');
    if (sidebarContent) {
      sidebarEl.innerHTML = sidebarContent.outerHTML;
    }
  } catch (error) {
    console.error('Error loading sidebar:', error);
  }
});
