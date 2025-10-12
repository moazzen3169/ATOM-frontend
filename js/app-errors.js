(function (global) {
  if (!global) return;

  const MESSAGE_LIBRARY = {
    generalError: {
      title: "مشکلی پیش آمده است",
      message: "در پردازش درخواست شما خطایی رخ داد.",
      hint: "لطفاً پس از چند لحظه دوباره تلاش کنید یا در صورت تداوم با پشتیبانی تماس بگیرید.",
      type: "error",
    },
    customError: {
      title: "خطا",
      message: "در انجام عملیات مشکلی پیش آمد.",
      hint: "جزئیات ورودی را بررسی کرده و دوباره تلاش کنید.",
      type: "error",
    },
    customSuccess: {
      title: "عملیات موفق",
      message: "درخواست شما با موفقیت انجام شد.",
      hint: "می‌توانید به کار خود ادامه دهید.",
      type: "success",
      duration: 5000,
    },
    customInfo: {
      title: "اطلاع‌رسانی سیستم",
      message: "در حال انجام دستور شما هستیم.",
      hint: "در صورت نیاز صفحه را بازنگری کنید.",
      type: "info",
    },
    customWarning: {
      title: "هشدار",
      message: "لطفاً مقادیر وارد شده را بازبینی کنید.",
      hint: "در صورت تداوم، موضوع را به پشتیبانی اطلاع دهید.",
      type: "info",
    },
    generalInfo: {
      title: "اطلاع‌رسانی سیستم",
      message: "به‌روزرسانی‌های مورد نیاز انجام شد.",
      hint: "در صورت نیاز صفحه را بازنگری کنید.",
      type: "info",
    },
    networkError: {
      title: "اختلال در اتصال",
      message: "ارتباط با سرور برقرار نشد.",
      hint: "اتصال اینترنت خود را بررسی کنید و اگر از VPN استفاده می‌کنید آن را موقتاً غیرفعال کنید.",
      steps: [
        "صفحه را یکبار تازه‌سازی کنید.",
        "در صورت ادامه مشکل با پشتیبانی اطلاع‌رسانی نمایید.",
      ],
      type: "error",
    },
    loginRequired: {
      title: "نیاز به ورود",
      message: "برای مشاهده این بخش ابتدا باید وارد حساب کاربری شوید.",
      hint: "پس از ورود دوباره به این صفحه بازگردید.",
      type: "info",
    },
    sessionExpired: {
      title: "نشست منقضی شده است",
      message: "نشست کاربری شما پایان یافته است.",
      hint: "برای ادامه استفاده، دوباره وارد حساب کاربری خود شوید.",
      type: "info",
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
    tournamentFetchFailed: {
      title: "امکان دریافت جزئیات تورنمنت وجود ندارد",
      message: "بازی‌ها یا تورنمنت‌های انتخاب‌شده در دسترس نیستند.",
      hint: "چند دقیقه دیگر دوباره صفحه را بررسی کنید.",
      type: "error",
    },
    tournamentJoinFailed: {
      title: "ثبت‌نام انجام نشد",
      message: "امکان ثبت‌نام در این تورنمنت وجود ندارد.",
      hint: "شرایط حضور را بررسی کرده و دوباره تلاش کنید.",
      type: "error",
    },
    teamSelectionRequired: {
      title: "تیم انتخاب نشده است",
      message: "برای ادامه باید ابتدا یک تیم را انتخاب کنید.",
      hint: "از فهرست تیم‌های خود یک مورد را برگزینید.",
      type: "info",
    },
    teamTooLarge: {
      title: "تعداد اعضای تیم زیاد است",
      message: "اعضای تیم انتخابی بیش از ظرفیت مجاز تورنمنت هستند.",
      hint: "یکی از تیم‌های کوچک‌تر را انتخاب کنید یا اعضا را کاهش دهید.",
      type: "error",
    },
    teamAlreadyRegistered: {
      title: "تیم قبلاً ثبت شده است",
      message: "این تیم پیش‌تر در تورنمنت حضور یافته است.",
      hint: "در صورت نیاز تیم دیگری را انتخاب کنید.",
      type: "info",
    },
    teamJoinUnauthorized: {
      title: "دسترسی کافی وجود ندارد",
      message: "اجازه ثبت‌نام این تیم برای شما صادر نشده است.",
      hint: "با مالک تیم یا پشتیبانی تماس بگیرید.",
      type: "error",
    },
    tournamentJoinSuccess: {
      title: "ثبت‌نام با موفقیت انجام شد",
      message: "درخواست ثبت‌نام شما در صف بررسی قرار گرفت.",
      hint: "جزئیات تکمیلی از طریق اعلان به شما اطلاع داده می‌شود.",
      type: "success",
      duration: 6000,
    },
    teamJoinSuccess: {
      title: "تیم ثبت شد",
      message: "تیم انتخابی با موفقیت در تورنمنت حضور یافت.",
      hint: "می‌توانید وضعیت تیم را در صفحه تورنمنت بررسی کنید.",
      type: "success",
      duration: 6000,
    },
    tournamentIdMissing: {
      title: "شناسه تورنمنت پیدا نشد",
      message: "شناسه معتبر برای تورنمنت در آدرس صفحه موجود نیست.",
      hint: "از لینک صحیح برای ورود به صفحه استفاده کنید.",
      type: "info",
    },
    gameIdMissing: {
      title: "شناسه بازی پیدا نشد",
      message: "شناسه بازی در لینک شما وجود ندارد.",
      hint: "به صفحه بازی‌ها بازگردید و دوباره تلاش کنید.",
      type: "info",
    },
    requestTimeout: {
      title: "درخواست طولانی شد",
      message: "پاسخ سرور بیشتر از حد انتظار زمان برد.",
      hint: "ارتباط اینترنت خود را بررسی کرده و دوباره تلاش کنید.",
      type: "error",
    },
    gameTournamentsLoadFailed: {
      title: "بارگذاری اطلاعات ناموفق بود",
      message: "در دریافت جزئیات بازی و تورنمنت‌ها خطایی رخ داد.",
      hint: "لحظاتی بعد دوباره صفحه را بررسی کنید.",
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
    verificationFormMissing: {
      title: "فرم تأیید هویت کامل نیست",
      message: "برخی از عناصر فرم یافت نشدند یا بارگذاری نشده‌اند.",
      hint: "صفحه را بازنگری کنید و پس از تکمیل دوباره اقدام نمایید.",
      type: "error",
    },
    verificationFilesMissing: {
      title: "فایل‌های مورد نیاز انتخاب نشده‌اند",
      message: "برای ادامه باید هر دو فایل خواسته‌شده را بارگذاری کنید.",
      hint: "لطفاً فایل کارت ملی و سلفی را انتخاب و سپس ارسال کنید.",
      type: "info",
    },
    verificationVideoMissing: {
      title: "عنصر ویدیو در دسترس نیست",
      message: "امکان نمایش یا ضبط ویدیو وجود ندارد.",
      hint: "صفحه را بازنگری کنید یا مرورگر دیگری را امتحان کنید.",
      type: "error",
    },
    verificationVideoRequired: {
      title: "ویدیو انتخاب نشده است",
      message: "برای ارسال سطح مورد نظر باید ویدیوی خود را بارگذاری کنید.",
      hint: "پس از انتخاب فایل ویدیو، دوباره اقدام نمایید.",
      type: "info",
    },
    verificationLevel2Submitted: {
      title: "مدارک سطح دو ارسال شد",
      message: "پرونده شما با موفقیت ثبت و برای بررسی ارسال شد.",
      hint: "نتیجه از طریق اعلان به شما اطلاع داده می‌شود.",
      type: "success",
      duration: 6000,
    },
    verificationLevel2Failed: {
      title: "ارسال مدارک سطح دو ناموفق بود",
      message: "در زمان ارسال مدارک خطایی رخ داد.",
      hint: "لطفاً اتصال اینترنت را بررسی کرده و دوباره تلاش کنید.",
      type: "error",
    },
    verificationLevel3Submitted: {
      title: "مدارک سطح سه ارسال شد",
      message: "اطلاعات سطح سه شما ثبت و در صف بررسی قرار گرفت.",
      hint: "نتیجه بررسی از طریق اعلان اطلاع‌رسانی خواهد شد.",
      type: "success",
      duration: 6000,
    },
    verificationLevel3Failed: {
      title: "ارسال مدارک سطح سه ناموفق بود",
      message: "در زمان ارسال مدارک سطح سه خطایی رخ داد.",
      hint: "لحظاتی بعد مجدداً تلاش کنید و در صورت تکرار موضوع را گزارش دهید.",
      type: "error",
    },
    adminVerificationApproveSuccess: {
      title: "درخواست تأیید شد",
      message: "وضعیت کاربر با موفقیت به تأیید تغییر یافت.",
      hint: "در صورت نیاز نتیجه را به کاربر اطلاع دهید.",
      type: "success",
      duration: 5000,
    },
    adminVerificationApproveFailed: {
      title: "تأیید درخواست ناموفق بود",
      message: "در زمان تأیید درخواست خطایی رخ داد.",
      hint: "دوباره تلاش کنید یا موضوع را به تیم فنی گزارش دهید.",
      type: "error",
    },
    adminVerificationRejectSuccess: {
      title: "درخواست رد شد",
      message: "درخواست موردنظر با موفقیت رد شد.",
      hint: "اطمینان حاصل کنید که دلیل رد برای کاربر ارسال شده باشد.",
      type: "success",
      duration: 5000,
    },
    adminVerificationRejectFailed: {
      title: "رد درخواست ناموفق بود",
      message: "در زمان رد درخواست خطایی رخ داد.",
      hint: "لطفاً دوباره تلاش کنید و در صورت تداوم با تیم فنی تماس بگیرید.",
      type: "error",
    },
    adminLoginRequired: {
      title: "ورود به پنل مدیریت الزامی است",
      message: "برای دسترسی به این بخش باید وارد حساب مدیریتی شوید.",
      hint: "در صورت نیاز از مسئول سیستم خود راهنمایی بگیرید.",
      type: "info",
    },
    adminRedirectInfo: {
      title: "هدایت به صفحه جدید",
      message: "برای ادامه به صفحه دیگری هدایت خواهید شد.",
      hint: "لطفاً منتظر بمانید یا در صورت نیاز به صورت دستی اقدام کنید.",
      type: "info",
    },
    ticketTitleRequired: {
      title: "عنوان تیکت خالی است",
      message: "برای ایجاد تیکت جدید باید عنوان مناسبی وارد کنید.",
      hint: "عنوانی کوتاه و واضح برای موضوع خود انتخاب کنید.",
      type: "info",
    },
    ticketMessageRequired: {
      title: "متن پیام خالی است",
      message: "لطفاً شرح مشکل یا درخواست خود را بنویسید.",
      hint: "تا جای ممکن جزئیات را ذکر کنید تا پشتیبانی سریع‌تر پاسخ دهد.",
      type: "info",
    },
    ticketCreateSuccess: {
      title: "تیکت ایجاد شد",
      message: "درخواست پشتیبانی شما با موفقیت ثبت شد.",
      hint: "پاسخ کارشناسان از طریق همین بخش اعلام می‌شود.",
      type: "success",
      duration: 5000,
    },
    ticketCreateFailed: {
      title: "ایجاد تیکت ناموفق بود",
      message: "در زمان ثبت تیکت جدید خطایی رخ داد.",
      hint: "دقایقی بعد دوباره تلاش کنید و در صورت تداوم با پشتیبانی تماس بگیرید.",
      type: "error",
    },
    ticketSelectRequired: {
      title: "تیکتی انتخاب نشده است",
      message: "برای ارسال پیام ابتدا یکی از تیکت‌های خود را انتخاب کنید.",
      hint: "از فهرست سمت راست یک تیکت را برگزینید.",
      type: "info",
    },
    ticketReplyEmpty: {
      title: "پیام وارد نشده است",
      message: "لطفاً متن پیام خود را بنویسید.",
      hint: "برای پاسخ‌دهی، توضیح خود را در کادر مربوطه وارد کنید.",
      type: "info",
    },
    ticketReplyFailed: {
      title: "ارسال پیام ناموفق بود",
      message: "در ارسال پیام شما خطایی رخ داد.",
      hint: "اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.",
      type: "error",
    },
    ticketsRefreshSuccess: {
      title: "فهرست تیکت‌ها به‌روزرسانی شد",
      message: "آخرین وضعیت تیکت‌ها بارگیری شد.",
      hint: "در صورت نیاز فیلترها را تغییر دهید.",
      type: "success",
      duration: 4000,
    },
    filtersReset: {
      title: "فیلترها بازنشانی شدند",
      message: "همه فیلترهای جست‌وجو به حالت اولیه بازگشتند.",
      hint: "اکنون می‌توانید معیارهای جدیدی انتخاب کنید.",
      type: "info",
    },
    reportReady: {
      title: "گزارش آماده شد",
      message: "گزارش وضعیت تیکت‌ها برای دانلود در دسترس قرار گرفت.",
      hint: "برای دریافت گزارش روی دکمه دانلود کلیک کنید.",
      type: "success",
      duration: 5000,
    },
    unauthorizedAccess: {
      title: "دسترسی غیرمجاز",
      message: "برای مشاهده این بخش باید حساب کاربری معتبری داشته باشید.",
      hint: "در صورت نیاز با مدیر سیستم تماس بگیرید.",
      type: "error",
    },
    loadingInProgress: {
      title: "در حال بارگذاری",
      message: "لطفاً تا تکمیل دریافت اطلاعات شکیبا باشید.",
      hint: "این فرایند ممکن است چند ثانیه طول بکشد.",
      type: "info",
    },
    tournamentCountdown: {
      title: "اطلاعات در حال آماده‌سازی است",
      message: "تورنمنت انتخابی در حال همگام‌سازی با سرور است.",
      hint: "لحظاتی دیگر وضعیت به‌روزرسانی می‌شود.",
      type: "info",
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
      const items = config.steps.map((step) => `<li>${step}</li>`).join("");
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

  function ensureStyles() {
    if (typeof document === "undefined") return;
    if (document.querySelector('link[data-app-alert-styles="true"]')) return;
    const head = document.head || document.getElementsByTagName("head")[0];
    if (!head) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/css/alert.css";
    link.dataset.appAlertStyles = "true";
    head.appendChild(link);
  }

  ensureStyles();
  ensureAlertScript();

  const api = {
    showAppNotification: showNotification,
    renderInlineMessage,
    resolveTemplate,
  };

  global.AppNotifier = api;

  function ensureAlertScript() {
    if (typeof document === "undefined" || typeof window === "undefined") return;
    if (typeof window.renderAlert === "function") return;
    if (document.querySelector('script[data-app-alert-script="true"]')) return;
    const head = document.head || document.getElementsByTagName("head")[0];
    if (!head) return;
    const script = document.createElement("script");
    script.src = "/js/alert.js";
    script.dataset.appAlertScript = "true";
    head.appendChild(script);
  }
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : undefined));
