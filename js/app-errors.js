const MESSAGE_LIBRARY = {
  generalError: {
    title: "مشکلی پیش آمده است",
    message: "در پردازش درخواست شما خطایی رخ داد.",
    hint: "لطفاً پس از چند لحظه دوباره تلاش کنید یا در صورت تداوم با پشتیبانی تماس بگیرید.",
    type: "error",
  },
  networkError: {
    title: "اختلال در اتصال",
    message: "ارتباط با سرور برقرار نشد.",
    hint: "اتصال اینترنت خود را بررسی کنید و اگر از VPN استفاده می‌کنید آن را موقتاً غیرفعال کنید.",
    steps: [
      "صفحه را یکبار تازه‌سازی کنید.",
      "در صورت ادامه مشکل با پشتیبانی اطلاع‌رسانی نمایید."
    ],
    type: "error",
  },
  playersEmpty: {
    title: "بازیکنی برای نمایش وجود ندارد",
    message: "هنوز بازیکن برتری در این بخش ثبت نشده است.",
    hint: "به محض ثبت مسابقات جدید این لیست به‌روزرسانی خواهد شد.",
    type: "info",
  },
  playersLoadFailed: {
    title: "نمایش بازیکنان ناموفق بود",
    message: "اطلاعات بازیکنان برتر دریافت نشد.",
    hint: "کمی بعد دوباره تلاش کنید. اگر مشکل پابرجاست تیم پشتیبانی را مطلع سازید.",
    type: "error",
  },
  tournamentsLoading: {
    title: "در حال آماده‌سازی اطلاعات",
    message: "در حال بارگذاری فهرست تورنمنت‌ها هستیم.",
    hint: "لطفاً لحظاتی صبر کنید.",
    type: "info",
  },
  tournamentsEmpty: {
    title: "تورنمنتی یافت نشد",
    message: "در حال حاضر تورنمنتی برای نمایش وجود ندارد.",
    hint: "به زودی تورنمنت‌های جدید اضافه خواهند شد. بعداً سر بزنید.",
    type: "info",
  },
  tournamentsLoadFailed: {
    title: "مشکل در دریافت تورنمنت‌ها",
    message: "نتوانستیم فهرست تورنمنت‌ها را دریافت کنیم.",
    hint: "اتصال خود را بررسی کنید و در صورت ادامه مشکل به پشتیبانی اطلاع دهید.",
    type: "error",
  },
  walletNotFound: {
    title: "کیف پولی یافت نشد",
    message: "اطلاعات کیف پول شما در حال حاضر قابل نمایش نیست.",
    hint: "در صورت داشتن حساب فعال با پشتیبانی تماس بگیرید تا موضوع بررسی شود.",
    type: "error",
  },
  walletLoadFailed: {
    title: "بارگذاری کیف پول ناموفق بود",
    message: "در زمان دریافت اطلاعات کیف پول مشکلی رخ داد.",
    hint: "اتصال اینترنت را بررسی کرده و صفحه را دوباره بارگذاری کنید.",
    type: "error",
  },
  transactionsEmpty: {
    title: "تراکنشی برای نمایش وجود ندارد",
    message: "هیچ تراکنشی در بازه انتخاب‌شده ثبت نشده است.",
    hint: "فیلترها را تغییر دهید یا بعداً دوباره سر بزنید.",
    type: "info",
  },
  transactionsLoadFailed: {
    title: "خطا در دریافت تراکنش‌ها",
    message: "دریافت فهرست تراکنش‌ها با مشکل روبه‌رو شد.",
    hint: "کمی بعد دوباره تلاش کنید. در صورت تکرار موضوع را به پشتیبانی اعلام کنید.",
    type: "error",
  },
  loginRequired: {
    title: "نیاز به ورود",
    message: "برای مشاهده این بخش ابتدا باید وارد حساب کاربری شوید.",
    hint: "پس از ورود دوباره به این صفحه بازگردید.",
    type: "info",
  },
  invalidDepositAmount: {
    title: "مبلغ واریز نامعتبر است",
    message: "حداقل مبلغ واریز باید ۱۰۰۰ تومان باشد.",
    hint: "عدد وارد شده را اصلاح کنید و دوباره اقدام نمایید.",
    type: "error",
  },
  invalidWithdrawAmount: {
    title: "مبلغ برداشت نامعتبر است",
    message: "حداقل مبلغ برداشت باید ۱۰۰۰ تومان باشد.",
    hint: "مبلغ برداشت را با دقت وارد کنید.",
    type: "error",
  },
  withdrawMoreThanBalance: {
    title: "برداشت بیشتر از موجودی",
    message: "مبلغ درخواستی بیشتر از موجودی قابل برداشت است.",
    hint: "مقدار را کاهش دهید یا ابتدا موجودی خود را افزایش دهید.",
    type: "error",
  },
  depositFailed: {
    title: "واریز ناموفق بود",
    message: "در زمان ایجاد درخواست واریز مشکلی پیش آمد.",
    hint: "چند لحظه دیگر دوباره تلاش کنید یا با پشتیبانی تماس بگیرید.",
    type: "error",
  },
  depositSuccess: {
    title: "درخواست واریز ثبت شد",
    message: "درخواست واریز شما با موفقیت ارسال شد.",
    hint: "در صورت نیاز به پرداخت آنلاین به درگاه منتقل خواهید شد.",
    type: "success",
    duration: 6000,
  },
  withdrawFailed: {
    title: "برداشت ناموفق بود",
    message: "در پردازش درخواست برداشت مشکلی رخ داد.",
    hint: "لحظاتی بعد مجدداً تلاش کنید. در صورت عدم رفع، موضوع را گزارش دهید.",
    type: "error",
  },
  withdrawSuccess: {
    title: "درخواست برداشت ثبت شد",
    message: "درخواست برداشت شما با موفقیت ثبت شد و در صف بررسی قرار گرفت.",
    hint: "پس از تأیید، نتیجه از طریق اعلان به شما اطلاع داده می‌شود.",
    type: "success",
    duration: 6000,
  },
  walletRefreshed: {
    title: "کیف پول به‌روز شد",
    message: "اطلاعات کیف پول با موفقیت تازه‌سازی شد.",
    hint: "می‌توانید فعالیت خود را ادامه دهید.",
    type: "success",
    duration: 5000,
  },
};

const TYPE_CLASS_MAP = {
  error: "error",
  info: "info",
  success: "success",
};

function resolveTemplate(key, overrides = {}) {
  const base = MESSAGE_LIBRARY[key] || MESSAGE_LIBRARY.generalError;
  const merged = {
    ...base,
    ...overrides,
    steps: overrides.steps ?? base.steps,
    type: overrides.type || base.type || "info",
    duration: overrides.duration ?? base.duration,
  };

  if (!merged.title) merged.title = MESSAGE_LIBRARY.generalError.title;
  if (!merged.message) merged.message = MESSAGE_LIBRARY.generalError.message;
  if (!merged.hint) merged.hint = MESSAGE_LIBRARY.generalError.hint;

  return merged;
}

function buildMessageHtml(config) {
  const parts = [];
  if (config.message) parts.push(`<p class="app-message__text">${config.message}</p>`);
  if (config.hint) parts.push(`<p class="app-message__hint">${config.hint}</p>`);
  if (Array.isArray(config.steps) && config.steps.length) {
    const items = config.steps.map(step => `<li>${step}</li>`).join("");
    parts.push(`<ul class="app-message__steps">${items}</ul>`);
  }
  return parts.join("");
}

function stripHtml(value) {
  const div = typeof document !== "undefined" ? document.createElement("div") : null;
  if (!div) return value;
  div.innerHTML = value;
  return div.textContent || div.innerText || value;
}

function showNotification(key, overrides = {}) {
  const config = resolveTemplate(key, overrides);
  const html = buildMessageHtml(config);
  const type = TYPE_CLASS_MAP[config.type] || "info";
  const duration = typeof config.duration === "number" ? config.duration : 8000;

  if (typeof window !== "undefined" && typeof window.renderAlert === "function") {
    window.renderAlert({
      title: config.title,
      message: html,
      type,
      duration,
    });
    return;
  }

  if (typeof window !== "undefined" && typeof window.alert === "function") {
    const plain = stripHtml(`${config.title}\n${config.message}${config.hint ? `\n${config.hint}` : ""}`);
    window.alert(plain);
  }
}

function renderInlineMessage(container, key, overrides = {}) {
  if (!container) return;
  const config = resolveTemplate(key, overrides);
  const type = TYPE_CLASS_MAP[config.type] || "info";
  const html = buildMessageHtml(config);

  container.innerHTML = `
    <div class="app-message app-message--${type}" role="alert">
      <div class="app-message__header">
        <span class="app-message__title">${config.title}</span>
      </div>
      <div class="app-message__body">${html}</div>
    </div>
  `;
}

function exposeToWindow() {
  if (typeof window === "undefined") return;
  const api = {
    showNotification,
    renderInlineMessage,
    resolveTemplate,
  };
  window.AppNotifier = api;
}

exposeToWindow();

export { showNotification as showAppNotification, renderInlineMessage, resolveTemplate };
export default {
  showAppNotification: showNotification,
  renderInlineMessage,
  resolveTemplate,
};
