/**
 * DOM manipulation utilities
 */

const domCache = new Map();

export function getDomElement(id) {
  if (!id) return null;
  if (domCache.has(id)) return domCache.get(id);
  const element = document.getElementById(id);
  domCache.set(id, element || null);
  return element || null;
}

export function updateText(id, value) {
  const element = typeof id === "string" ? getDomElement(id) : id;
  if (!element) return;
  element.textContent = value ?? "";
}

export function toggleHidden(id, hidden) {
  const element = typeof id === "string" ? getDomElement(id) : id;
  if (!element) return;
  element.classList.toggle("is-hidden", Boolean(hidden));
}

export function toggleDisplay(id, show, displayValue = "block") {
  const element = typeof id === "string" ? getDomElement(id) : id;
  if (!element) return;
  element.style.display = show ? displayValue : "none";
}

export function updateImage(id, { src, alt, fallbackSrc }) {
  const element = typeof id === "string" ? getDomElement(id) : id;
  if (!element) return;
  if (src) {
    element.src = src;
  } else if (fallbackSrc) {
    element.src = fallbackSrc;
  }
  if (alt) {
    element.alt = alt;
  }
}

export function hidePreloader() {
  toggleDisplay("preloader", false);
}

export function showLoginRequired() {
  toggleDisplay("login_required", true, "flex");
  toggleDisplay("lobby_page", false);
  hidePreloader();
}

export function showLobbyPage() {
  toggleDisplay("login_required", false);
  toggleDisplay("lobby_page", true, "grid");
}
