/**
 * Modal management utilities
 */

import { getDomElement, toggleDisplay, updateText } from "./dom.js";

const modalRegistry = new Map();

export function createModalController(modalId, { onOpen, onClose } = {}) {
  const modalElement = () => getDomElement(modalId);

  function open() {
    const element = modalElement();
    if (!element) return;
    element.setAttribute("aria-hidden", "false");
    toggleDisplay(element, true, "flex");
    onOpen?.();
  }

  function close() {
    const element = modalElement();
    if (!element) return;
    element.setAttribute("aria-hidden", "true");
    toggleDisplay(element, false);
    onClose?.();
  }

  function bindDismiss() {
    const element = modalElement();
    if (!element) return;
    element.addEventListener("click", (event) => {
      if (event.target === element) {
        close();
      }
    });
  }

  return { modalId, open, close, bindDismiss };
}

export function registerModal(id, options) {
  if (!id || modalRegistry.has(id)) {
    return modalRegistry.get(id);
  }
  const controller = createModalController(id, options);
  modalRegistry.set(id, controller);
  return controller;
}

export function getModal(id) {
  return modalRegistry.get(id) || registerModal(id);
}

export function showModal(id) {
  getModal(id)?.open();
}

export function hideModal(id) {
  getModal(id)?.close();
}

export function ensureFeedbackModal() {
  let modal = getDomElement("globalFeedbackModal");
  if (modal) {
    return modal;
  }

  if (!document.body) {
    return null;
  }

  modal = document.createElement("div");
  modal.id = "globalFeedbackModal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-hidden", "true");
  modal.style.cssText =
    "display:none;position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,0.8);" +
    "align-items:center;justify-content:center;padding:24px;";

  modal.innerHTML = `
    <div class="atom-modal__dialog" style="max-width:420px;width:100%;background:#0f172a;color:#fff;border-radius:16px;padding:24px;box-shadow:0 24px 48px rgba(8,15,31,0.4);border:1px solid rgba(148,163,184,0.2);position:relative;">
      <button type="button" id="globalFeedbackModalClose" aria-label="بستن" style="position:absolute;top:12px;left:12px;background:transparent;border:none;color:inherit;font-size:20px;cursor:pointer;">&times;</button>
      <h3 id="globalFeedbackModalTitle" style="font-size:1.25rem;margin-bottom:12px;"></h3>
      <p id="globalFeedbackModalMessage" style="line-height:1.8;margin-bottom:16px;"></p>
      <div id="globalFeedbackModalAction" style="display:flex;gap:12px;flex-wrap:wrap;justify-content:flex-end;"></div>
    </div>
  `;

  document.body.appendChild(modal);
  domCache.set("globalFeedbackModal", modal);

  const closeBtn = modal.querySelector("#globalFeedbackModalClose");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => hideModal("globalFeedbackModal"));
  }

  registerModal("globalFeedbackModal", {
    onClose: () => {
      const action = modal.querySelector("#globalFeedbackModalAction");
      if (action) {
        action.innerHTML = "";
      }
    },
  }).bindDismiss();

  return modal;
}

export function showFeedbackModal({
  title,
  message,
  type = "info",
  action,
} = {}) {
  const modal = ensureFeedbackModal();
  if (!modal) {
    if (message) {
      window.alert?.(message);
    }
    return;
  }

  const accent =
    type === "success" ? "#22c55e" : type === "error" ? "#ef4444" : "#38bdf8";
  const dialog = modal.querySelector(".atom-modal__dialog");
  if (dialog) {
    dialog.style.borderColor = accent;
  }

  updateText("globalFeedbackModalTitle", title || "پیام سیستم");
  updateText("globalFeedbackModalMessage", message || "");

  const actionContainer = modal.querySelector("#globalFeedbackModalAction");
  if (actionContainer) {
    actionContainer.innerHTML = "";
    if (action?.label && action?.href) {
      const link = document.createElement("a");
      link.href = action.href;
      link.textContent = action.label;
      link.target = action.external ? "_blank" : "_self";
      link.rel = action.external ? "noopener" : "";
      link.style.cssText =
        `background:${accent};color:#0f172a;font-weight:600;padding:10px 18px;border-radius:999px;text-decoration:none;`;
      actionContainer.appendChild(link);
    }
  }

  showModal("globalFeedbackModal");
}

export function showModalError(elementId, message) {
  const element = getDomElement(elementId);
  if (!element) return;

  const text = message?.toString().trim() || "";
  updateText(element, text);
  element.classList.toggle("is-hidden", !text);
}

export function clearModalError(elementId) {
  showModalError(elementId, "");
}
