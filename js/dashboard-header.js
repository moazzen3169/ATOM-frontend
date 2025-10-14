(function () {
  'use strict';

  const DASHBOARD_HEADER_VERSION = '1';
  const CACHE_KEY = `user_dashboard_header_html_v${DASHBOARD_HEADER_VERSION}`;
  const HEADER_PATH = 'dashboard-header.html';

  function applyHeader(container, html, source) {
    if (!container) return;
    container.innerHTML = html;
    container.dataset.dashboardHeaderSource = source;
    container.dispatchEvent(
      new CustomEvent('dashboardHeader:loaded', {
        bubbles: false,
        detail: { source }
      })
    );
  }

  function loadHeaderFromCache(container) {
    try {
      const cachedHtml = localStorage.getItem(CACHE_KEY);
      if (typeof cachedHtml === 'string' && cachedHtml.trim()) {
        applyHeader(container, cachedHtml, 'cache');
        return true;
      }
    } catch (error) {
      console.warn('Cannot access localStorage for dashboard header:', error);
    }
    return false;
  }

  async function fetchAndCacheHeader(container) {
    try {
      const response = await fetch(HEADER_PATH, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      applyHeader(container, html, 'network');
      try {
        localStorage.setItem(CACHE_KEY, html);
      } catch (storageError) {
        console.warn('Unable to cache dashboard header HTML:', storageError);
      }
    } catch (error) {
      console.error('Failed to load dashboard header:', error);
      applyHeader(
        container,
        '<div class="dashboard_header__error" role="status">امکان بارگذاری هدر وجود ندارد.</div>',
        'error'
      );
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('dashboard_header');
    if (!container) return;

    const loadedFromCache = loadHeaderFromCache(container);
    if (!loadedFromCache) fetchAndCacheHeader(container);
  });
})();
