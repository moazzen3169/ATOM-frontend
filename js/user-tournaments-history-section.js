(function () {
  'use strict';

  const COMPONENT_NAME = 'user-tournaments-history';
  const COMPONENT_SELECTOR = `[data-component="${COMPONENT_NAME}"]`;
  const COMPONENT_PATH = 'components/user-tournaments-history.html';
  const READY_EVENT = 'userTournamentsHistory:ready';

  let templateCache = null;
  let isLoading = false;
  let pendingEnhancement = false;

  function hasWindowFetch() {
    return typeof window.fetch === 'function';
  }

  async function loadTemplate() {
    if (templateCache) {
      return templateCache;
    }

    if (!hasWindowFetch()) {
      throw new Error('fetch API is not available.');
    }

    const response = await fetch(COMPONENT_PATH, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to load component: HTTP ${response.status}`);
    }

    const html = await response.text();
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    templateCache = template;
    return templateCache;
  }

  function getPlaceholders(root = document) {
    if (!root.querySelectorAll) {
      return [];
    }
    return Array.from(root.querySelectorAll(COMPONENT_SELECTOR));
  }

  function injectContent(placeholder, template) {
    if (!placeholder || placeholder.dataset.componentLoaded === 'true') {
      return false;
    }

    placeholder.innerHTML = '';
    const clone = template.content.cloneNode(true);
    placeholder.appendChild(clone);
    placeholder.dataset.componentLoaded = 'true';
    placeholder.removeAttribute('data-component');
    placeholder.dispatchEvent(
      new CustomEvent('userTournamentsHistory:componentLoaded', {
        bubbles: false,
        detail: { placeholder },
      }),
    );
    return true;
  }

  function showErrorFallback(placeholder, error) {
    if (!placeholder) return;
    const fallback = placeholder.querySelector('[data-component-fallback]');
    const message = error instanceof Error ? error.message : String(error);
    if (fallback) {
      fallback.textContent = `خطا در بارگذاری تاریخچه تورنومنت‌ها: ${message}`;
      fallback.classList.add('tournaments_history_hint--error');
    } else {
      placeholder.textContent = `خطا در بارگذاری تاریخچه تورنومنت‌ها: ${message}`;
      placeholder.classList.add('tournaments_history_hint', 'tournaments_history_hint--error');
    }
    placeholder.dataset.componentLoaded = 'error';
  }

  async function enhancePlaceholders(root = document) {
    if (isLoading) {
      pendingEnhancement = true;
      return;
    }

    const placeholders = getPlaceholders(root).filter(
      (placeholder) => placeholder.dataset.componentLoaded !== 'true',
    );

    if (placeholders.length === 0) {
      return;
    }

    isLoading = true;
    try {
      const template = await loadTemplate();
      let injectedCount = 0;
      placeholders.forEach((placeholder) => {
        const success = injectContent(placeholder, template);
        if (success) {
          injectedCount += 1;
        }
      });
      if (injectedCount > 0) {
        document.dispatchEvent(
          new CustomEvent(READY_EVENT, {
            bubbles: false,
            detail: { count: injectedCount },
          }),
        );
      }
    } catch (error) {
      placeholders.forEach((placeholder) => showErrorFallback(placeholder, error));
    } finally {
      isLoading = false;
      if (pendingEnhancement) {
        pendingEnhancement = false;
        enhancePlaceholders();
      }
    }
  }

  function watchForDynamicPlaceholders() {
    if (!('MutationObserver' in window) || !document.body) {
      return;
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (!mutation.addedNodes) continue;
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches && node.matches(COMPONENT_SELECTOR)) {
            enhancePlaceholders(node.parentNode || document);
            return;
          }
          const nested = node.querySelector && node.querySelector(COMPONENT_SELECTOR);
          if (nested) {
            enhancePlaceholders(node);
            return;
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function bootstrap() {
    enhancePlaceholders();
    watchForDynamicPlaceholders();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
