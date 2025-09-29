
// utils.js - shared functions

export function showMsg(type, text) {
  const box = document.getElementById("message");
  box.className = "message " + type;
  box.innerText = text;
  box.style.display = "block";
}

export function normalizeErrors(data) {
  if (!data) return "خطای ناشناخته.";
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.join("، ");
  if (data.detail) return data.detail;
  if (data.non_field_errors) return data.non_field_errors.join("، ");
  return Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(" | ");
}

export async function safeFetch(url, options, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}
