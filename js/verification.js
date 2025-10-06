import { API_BASE_URL } from "../js/config.js";

const overlay = document.querySelector(".overlay");
const leveL2Modal = document.querySelector(".level_2_modal");
const leveL3Modal = document.querySelector(".level_3_modal");
const level2btn = document.querySelector("#level-2-btn");
const level3btn = document.querySelector("#level-3-btn");
const nemuneh = document.querySelector(".nemuneh");
const nemunehModal = document.querySelector(".nemuneh_modal");

// باز کردن مودال‌ها
level2btn.addEventListener("click", function () {
  overlay.classList.remove("hidden");
  leveL2Modal.classList.remove("hidden");
  initializeLevel2FileHandlers();
});

level3btn.addEventListener("click", function () {
  overlay.classList.remove("hidden");
  leveL3Modal.classList.remove("hidden");
  initializeLevel3FileHandlers();
});

// بستن مودال‌ها
overlay.addEventListener("click", function () {
  leveL3Modal.classList.add("hidden");
  leveL2Modal.classList.add("hidden");
  overlay.classList.add("hidden");
  nemunehModal.classList.add("hidden");
});

nemuneh.addEventListener("click", function () {
  overlay.classList.remove("hidden");
  nemunehModal.classList.remove("hidden");
  leveL3Modal.classList.add("hidden");
  leveL2Modal.classList.add("hidden");
});

// نمایش سایز فایل انتخابی
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function handleFileSelection(input, infoDiv, maxSizeMB) {
  const file = input.files[0];
  if (file) {
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      infoDiv.innerHTML = `<span style="color: red;">حجم فایل بیش از حد مجاز است (${maxSizeMB}MB)</span>`;
      input.value = "";
    } else {
      infoDiv.innerHTML = `حجم فایل: ${formatFileSize(file.size)} | ${file.name}`;
    }
  }
}

// مدیریت فایل‌های سطح 2
function initializeLevel2FileHandlers() {
  const level2SelfyInput = document.querySelector("#selfy_picture_level2");
  const level2IdCardInput = document.querySelector("#id_card");
  const level2SelfyInfo = document.querySelector("#selfy_info");
  const level2IdCardInfo = document.querySelector("#id_card_info");

  if (level2SelfyInput) {
    level2SelfyInput.addEventListener("change", function () {
      handleFileSelection(this, level2SelfyInfo, 5);
    });
  }
  if (level2IdCardInput) {
    level2IdCardInput.addEventListener("change", function () {
      handleFileSelection(this, level2IdCardInfo, 5);
    });
  }
}

// مدیریت فایل‌های سطح 3
function initializeLevel3FileHandlers() {
  const level3VideoInput = document.querySelector("#selfy_video_level3");
  const level3VideoInfo = document.querySelector("#video_info");

  if (level3VideoInput) {
    level3VideoInput.addEventListener("change", function () {
      handleFileSelection(this, level3VideoInfo, 10);
    });
  }
}

// 📌 دریافت وضعیت کاربر
async function fetchVerificationStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/verification/status/`, {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("access_token")
        ,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) throw new Error("خطا در دریافت وضعیت");
    const data = await response.json();
    updateUIBasedOnStatus(data);
  } catch (error) {
    console.error(error);
  }
}

// 📌 بروزرسانی UI
function updateUIBasedOnStatus(data) {
  const level2Status = document.querySelector(".verification_level_2 .level_status");
  const level3Status = document.querySelector(".verification_level_3 .level_status");

  // پیش‌فرض: دکمه‌ها قفل
  level2btn.disabled = true;
  level3btn.disabled = true;

  if (data.level === 1 && data.is_verified) {
    // سطح 1 تایید شده ⇒ می‌تونه سطح 2 شروع کنه
    level2Status.className = "level_status not_accepted";
    level2Status.innerText = "تکمیل نشد";
    level2btn.disabled = false;
  }

  if (data.level === 2 && !data.is_verified) {
    // سطح 2 در حال بررسی
    level2Status.className = "level_status pending";
    level2Status.innerText = "در حال بررسی";
  }

  if (data.level === 2 && data.is_verified) {
    // سطح 2 تایید شده ⇒ می‌تونه سطح 3 شروع کنه
    level2Status.className = "level_status accepted";
    level2Status.innerText = "تایید شده";
    level3btn.disabled = false;
  }

  if (data.level === 3 && !data.is_verified) {
    // سطح 3 در حال بررسی
    level3Status.className = "level_status pending";
    level3Status.innerText = "در حال بررسی";
  }

  if (data.level === 3 && data.is_verified) {
    // سطح 3 تایید شده ⇒ همه چیز کامل
    level3Status.className = "level_status accepted";
    level3Status.innerText = "تایید شده";
  }
}

// 📌 ارسال مدارک سطح 2
document.querySelector(".level_2_modal_form").addEventListener("submit", async function (e) {
  e.preventDefault();
  const idCardFile = document.querySelector("#id_card").files[0];
  const selfieFile = document.querySelector("#selfy_picture_level2").files[0];

  if (!idCardFile || !selfieFile) {
    alert("لطفا هر دو فایل را انتخاب کنید.");
    return;
  }

  const formData = new FormData();
  formData.append("id_card_image", idCardFile);
  formData.append("selfie_image", selfieFile);

  try {
    const response = await fetch(`${API_BASE_URL}/api/verification/submit_level2/`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + localStorage.getItem("access_token")
        ,
      },
      body: formData,
    });
    if (!response.ok) throw new Error("ارسال مدارک سطح 2 ناموفق بود");
    alert("مدارک سطح 2 ارسال شد. در حال بررسی...");
    fetchVerificationStatus();
  } catch (error) {
    console.error(error);
  }
});

// 📌 ارسال مدارک سطح 3
document.querySelector(".level_3_modal form").addEventListener("submit", async function (e) {
  e.preventDefault();
  const videoFile = document.querySelector("#selfy_video_level3").files[0];

  if (!videoFile) {
    alert("لطفا ویدیو را انتخاب کنید.");
    return;
  }

  const formData = new FormData();
  formData.append("video", videoFile);

  try {
    const response = await fetch(`${API_BASE_URL}/api/verification/submit_level3/`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + localStorage.getItem("access_token")
        ,
      },
      body: formData,
    });
    if (!response.ok) throw new Error("ارسال مدارک سطح 3 ناموفق بود");
    alert("مدارک سطح 3 ارسال شد. در حال بررسی...");
    fetchVerificationStatus();
  } catch (error) {
    console.error(error);
  }
});

// 🚀 اولین بار که صفحه لود میشه وضعیت کاربر رو بگیر
fetchVerificationStatus();
