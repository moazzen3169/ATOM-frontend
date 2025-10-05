# راهنمای طراحی صفحه یکپارچه احراز هویت

## آسان‌تر، یک روش طراحی بسیار خوب و کاربرپسند است.

در این حالت، به جای ساختن صفحات جداگانه، یک صفحه اصلی "احراز هویت" طراحی می‌کنیم که وضعیت هر سطح را به کاربر نشان می‌دهد و به او اجازه می‌دهد تا برای ارتقا اقدام کند.

## ساختار کلی صفحه

### عنوان صفحه
- عنوان: "احراز هویت" یا "سطح کاربری"
- نمایش در بالای صفحه به صورت برجسته

### نمایش سطح فعلی
- در بالای صفحه، سطح تأیید شده فعلی کاربر را به وضوح نمایش دهید
- مثال: یک کادر بزرگ با متن "سطح فعلی شما: سطح ۱ - پایه" همراه با یک آیکون تیک سبز
- استفاده از کلاس‌های CSS موجود برای استایل‌بندی (مثل `.card-color` و `.color-primary`)

### طراحی کارتی (Card-based)
- برای هر سطح (سطح ۱، ۲ و ۳) یک "کارت" یا بخش مجزا و عمودی طراحی کنید
- هر کارت باید دارای:
  - پس‌زمینه: `var(--card-color)`
  - حاشیه: `1px solid var(--border-color)`
  - گوشه‌های گرد: `border-radius: 10px`
  - padding: `20px`

---

## طراحی کارت‌های هر سطح

### کارت سطح ۱: حساب کاربری پایه

#### عنوان
- "سطح ۱: پایه"

#### وضعیت
- "تکمیل شده" (همراه با آیکون تیک سبز)
- استفاده از آیکون موجود: `img/icons/check.svg`

#### توضیحات
- مزایای این سطح را بنویسید
- مثال: "دسترسی به امکانات عمومی"

#### استایل‌بندی
```css
.verification-level-card {
  background: var(--card-color);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 20px;
}

.level-title {
  font-size: 18px;
  color: var(--white-color);
  margin-bottom: 10px;
}

.level-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 15px;
}

.status-icon {
  width: 20px;
  height: 20px;
}

.status-completed {
  color: #28a745;
}

.level-description {
  color: var(--gray-color);
  font-size: 14px;
  line-height: 1.5;
}
```

---

### کارت سطح ۲: تایید با عکس (سلفی و کارت ملی)

#### عنوان
- "سطح ۲: تایید هویت با عکس"

#### حالت‌های مختلف کارت

##### حالت پیش‌فرض (آماده برای شروع)
- **وضعیت**: نمایش آیکون ساعت یا آماده
- **توضیحات**: مزایای ارتقا به این سطح را بنویسید
  - مثال: "افزایش سقف برداشت روزانه"
- **دکمه اصلی**: یک دکمه واضح با عنوان "شروع احراز هویت سطح ۲"
- **عملکرد دکمه**: با کلیک روی این دکمه، همین کارت باز شده (Expand می‌شود) و فرم‌های بارگذاری عکس سلفی و کارت ملی در زیر آن نمایان می‌شوند
- **استایل دکمه**:
```css
.start-verification-btn {
  background-color: var(--color-primary);
  color: var(--background-color);
  border: none;
  border-radius: 5px;
  padding: 12px 20px;
  font-weight: bold;
  cursor: pointer;
  width: 100%;
  margin-top: 15px;
}
```

##### حالت در حال بررسی
- **وضعیت**: "در حال بررسی" (با آیکون ساعت)
- **توضیحات**: "مدارک شما در حال بررسی است و نتیجه به زودی اطلاع‌رسانی خواهد شد."
- **استایل**: کارت غیرفعال با opacity کمتر

##### حالت تایید شده
- **وضعیت**: "تکمیل شده" (با آیکون تیک سبز)

##### حالت رد شده
- **وضعیت**: "رد شده" (با آیکون ضربدر قرمز)
- **توضیحات**: دلیل رد شدن را ذکر کنید
  - مثال: "تصویر سلفی واضح نبود"
- **دکمه**: "تلاش مجدد"
- **استایل دکمه تلاش مجدد**:
```css
.retry-btn {
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 5px;
  padding: 10px 15px;
  cursor: pointer;
  margin-top: 10px;
}
```

#### فرم بارگذاری عکس‌ها (پس از کلیک روی دکمه شروع)
```html
<div class="upload-form" style="display: none;">
  <div class="upload-section">
    <label for="selfie-upload">تصویر سلفی</label>
    <input type="file" id="selfie-upload" accept="image/*" required>
    <div class="file-preview" id="selfie-preview"></div>
  </div>

  <div class="upload-section">
    <label for="id-card-upload">تصویر کارت ملی</label>
    <input type="file" id="id-card-upload" accept="image/*" required>
    <div class="file-preview" id="id-preview"></div>
  </div>

  <button type="submit" class="submit-verification-btn">ارسال مدارک</button>
</div>
```

---

### کارت سطح ۳: تایید با ویدیو (ویدیو و کارت ملی)

#### عنوان
- "سطح ۳: تایید هویت ویدیویی"

#### حالت‌های مختلف کارت

##### حالت قفل شده (Locked)
- **وضعیت**: "قفل" (با آیکون قفل)
- **توضیحات**: "برای دسترسی به این سطح، ابتدا باید احراز هویت سطح ۲ را با موفقیت انجام دهید."
- **استایل**: کارت با opacity کمتر و آیکون قفل
- استفاده از آیکون موجود: طراحی آیکون قفل یا استفاده از CSS

##### حالت آماده برای شروع (پس از تایید سطح ۲)
- **توضیحات**: مزایای نهایی را لیست کنید
  - مثال: "دسترسی کامل به تمام امکانات"
- **دکمه اصلی**: "شروع احراز هویت سطح ۳"
- **عملکرد دکمه**: مانند سطح ۲، با کلیک روی این دکمه، همین کارت باز شده و قابلیت ضبط ویدیو و بارگذاری کارت ملی در زیر آن ظاهر می‌شود

##### سایر حالت‌ها (در حال بررسی، تایید شده، رد شده)
- دقیقاً مانند سطح ۲ عمل می‌کنند

#### قابلیت ضبط ویدیو
```html
<div class="video-verification-form" style="display: none;">
  <div class="video-instructions">
    <p>لطفاً ویدیو خود را ضبط کنید:</p>
    <ul>
      <li>صورت خود را واضح نشان دهید</li>
      <li>کارت ملی خود را مقابل دوربین بگیرید</li>
      <li>بگویید: "من [نام] هستم و این کارت ملی من است"</li>
    </ul>
  </div>

  <div class="video-recorder">
    <video id="video-preview" autoplay></video>
    <div class="recorder-controls">
      <button id="start-recording">شروع ضبط</button>
      <button id="stop-recording" disabled>توقف ضبط</button>
    </div>
  </div>

  <div class="upload-section">
    <label for="id-card-video-upload">تصویر کارت ملی</label>
    <input type="file" id="id-card-video-upload" accept="image/*" required>
  </div>

  <button type="submit" class="submit-video-verification-btn">ارسال ویدیو و مدارک</button>
</div>
```

---

## استایل‌های کلی و ریسپانسیو

### CSS Variables مورد استفاده
```css
:root {
  --background-color: #0F172A;
  --card-color: #1E293B;
  --border-color: #334155;
  --color-primary: #3fdfff;
  --white-color: #ffffff;
  --gray-color: #94A3B8;
}
```

### ریسپانسیو
```css
@media (max-width: 768px) {
  .verification-level-card {
    margin-bottom: 15px;
    padding: 15px;
  }

  .level-title {
    font-size: 16px;
  }
}
```

### انیمیشن‌ها
```css
.expand-card {
  animation: expand 0.3s ease-in-out;
}

@keyframes expand {
  from { max-height: 200px; }
  to { max-height: 500px; }
}
```

---

## نکات پیاده‌سازی

1. **JavaScript برای تعاملات**:
   - کلیک روی دکمه‌های شروع برای expand کردن کارت‌ها
   - مدیریت آپلود فایل‌ها و پیش‌نمایش
   - ضبط ویدیو با WebRTC API
   - ارسال داده‌ها به API

2. **API Endpoints مورد نیاز**:
   - `GET /api/user/verification-status` - دریافت وضعیت فعلی
   - `POST /api/user/verification/level2` - آپلود مدارک سطح ۲
   - `POST /api/user/verification/level3` - آپلود ویدیو سطح ۳

3. **مدیریت وضعیت‌ها**:
   - استفاده از کلاس‌های CSS برای نشان دادن وضعیت‌های مختلف
   - بروزرسانی وضعیت پس از ارسال موفق

4. **UX Considerations**:
   - نمایش progress bar برای آپلود فایل‌ها
   - پیام‌های موفقیت/خطا پس از عملیات
   - غیرفعال کردن دکمه‌ها در حال پردازش

با این روش، کاربر به راحتی در یک نگاه وضعیت کلی حساب خود را می‌بیند و فرآیند ارتقا را به صورت مرحله به مرحله در همان صفحه و بدون سردرگمی طی می‌کند.
