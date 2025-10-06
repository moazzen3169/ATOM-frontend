// Alert/Toast JS functions extracted from js/loby.js and js/user-dashboard.js

function ensureAlertStack() {
  let stack = document.getElementById("alert_stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "alert_stack";
    stack.className = "alert_stack";
    document.body.appendChild(stack);
  }
  return stack;
}

function renderAlert({ classes = [], title = "", message = "", actions = [], duration = 7000, type = "error" }) {
  const stack = ensureAlertStack();
  const el = document.createElement("div");
  const base = ["alert"];
  if (type === "error") base.push("alert-error");
  if (type === "success") base.push("alert-success");
  if (type === "info") base.push("alert-info");

  el.className = [...base, ...classes].join(" ");
  el.setAttribute("role", "alert");
  el.innerHTML = `
    <button class="alert_close" aria-label="بستن">&times;</button>
    ${title ? `<div class="alert_title">${title}</div>` : ""}
    ${message ? `<div class="alert_msg">${message}</div>` : ""}
    ${actions?.length ? `
      <div class="alert_actions">
        ${actions.map(a => a.href
          ? `<a class="alert_btn" href="${a.href}" target="${a.target || "_self"}">${a.label}</a>`
          : `<button class="alert_btn" data-action="${a.action || ""}">${a.label}</button>`
        ).join("")}
      </div>` : ""}
  `;
  stack.appendChild(el);

  const closer = el.querySelector(".alert_close");
  closer.addEventListener("click", () => el.remove());

  el.querySelectorAll("button.alert_btn[data-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      const act = btn.getAttribute("data-action");
      document.dispatchEvent(new CustomEvent("alertAction", { detail: act }));
      el.remove();
    });
  });

  if (duration > 0) {
    setTimeout(() => el.remove(), duration);
  }
}

function showError(msg) {
  renderAlert({ title: "خطا", message: msg, type: "error" });
}

function showSuccess(msg) {
  renderAlert({ title: "موفقیت‌آمیز", message: msg, type: "success", duration: 5000 });
}

function showInfo(msg) {
  renderAlert({ title: "اطلاع", message: msg, type: "info", duration: 6000 });
}

// Export functions to global scope for usage in other scripts
window.showError = showError;
window.showSuccess = showSuccess;
window.showInfo = showInfo;
window.renderAlert = renderAlert;
window.ensureAlertStack = ensureAlertStack;
