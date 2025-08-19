// داده‌ها
const chatsData = {
    support: {
      name: "پشتیبانی",
      profile: "img/icons/support.svg",
      messages: [
        { type: "receive", text: "سلام! چطور می‌توانم کمک کنم؟", time: "09:10" },
        { type: "send", text: "سلام، مشکل ورود دارم", time: "09:12" },
        { type: "receive", text: "رمز عبور خود را تغییر دادید؟", time: "09:15" },
        { type: "send", text: "بله، اما باز هم خطا میده", time: "09:16" },
        { type: "receive", text: "بسیار خب، برای بررسی بیشتر شماره کاربری‌تان را ارسال کنید", time: "09:20" },
      ]
    },
    users: [
      {
        id: 1,
        name: "کاربر ۱",
        profile: "img/icons/profile.svg",
        messages: [
            { type: "send", text: "سلام! حالت چطوره؟", time: "12:54" },
            { type: "receive", text: "خوبم، ممنون 🌹", time: "12:55" },
            { type: "send", text: "امروز جلسه طراحی داریم، یادت نره", time: "13:00" },
            { type: "send", text: "سلام! حالت چطوره؟", time: "12:54" },
            { type: "receive", text: "خوبم، ممنون 🌹", time: "12:55" },
            { type: "send", text: "امروز جلسه طراحی داریم، یادت نرهطراحی داریم، یادت نرهطراحی داریم، یادت نرهطراحی داریم، یادت نرهطراحی داریم، یادت نرهطراحی داریم، یادت نرهطراحی داریم، یادت نرهطراحی داریم، یادت نرهطراحی داریم، یادت نرهطراحی داریم، یادت نرهطراحی داریم، یادت نرهطراحی داریم، یادت نرهطراحی داریم، یادت نرهطراحی داریم، یادت نرهطراحی داریم، یادت نرهطراحی داریم، یادت نرهطراحی داریم، یادت نره", time: "13:00" },
            { type: "send", text: "سلام! حالت چطوره؟", time: "12:54" },
            { type: "receive", text: "خوبم، ممنون 🌹", time: "12:55" },
            { type: "send", text: "امروز جلسه طراحی داریم، یادت نره", time: "13:00" },
            { type: "send", text: "سلام! حالت چطوره؟", time: "12:54" },
            { type: "receive", text: "خوبم، ممنون 🌹", time: "12:55" },
            { type: "send", text: "امروز جلسه طراحی داریم، یادت نره", time: "13:00" },
          { type: "receive", text: "آره، حتما ✔️", time: "13:02" }
        ]
      },
      {
        id: 2,
        name: "کاربر ۲",
        profile: "img/icons/profile.svg",
        messages: [
          { type: "receive", text: "فایل‌ها رو برات فرستادم", time: "13:10" },
          { type: "send", text: "مرسی، دریافت شد 🙏", time: "13:11" },
          { type: "receive", text: "اگه چیزی ناقص بود بهم بگو", time: "13:12" },
          { type: "send", text: "حتما، الان بررسی می‌کنم", time: "13:13" }
        ]
      },
      {
        id: 3,
        name: "کاربر ۳",
        profile: "img/icons/profile.svg",
        messages: [
          { type: "send", text: "سلام، فردا میای بیرون؟", time: "15:20" },
          { type: "receive", text: "سلام ✋، نه متاسفانه سرم شلوغه", time: "15:22" },
          { type: "send", text: "باشه، پس بذار برای هفته بعد", time: "15:25" },
          { type: "receive", text: "اوکی، هماهنگ می‌کنیم", time: "15:30" }
        ]
      },
      {
        id: 4,
        name: "کاربر ۴",
        profile: "img/icons/profile.svg",
        messages: [
          { type: "receive", text: "یادته قول دادی پروژه رو تا شنبه تحویل بدی؟", time: "18:00" },
          { type: "send", text: "آره، دارم روش کار می‌کنم", time: "18:05" },
          { type: "receive", text: "خیلی خوبه، چون جلسه داریم", time: "18:07" },
          { type: "send", text: "نگران نباش، آماده میشه 👍", time: "18:10" }
        ]
      },
      {
        id: 5,
        name: "کاربر ۵",
        profile: "img/icons/profile.svg",
        messages: [
          { type: "send", text: "سلام دوست قدیمی! دلتنگت شدم", time: "20:00" },
          { type: "receive", text: "وای سلام 😍 منم خیلی دلم برات تنگ شده بود", time: "20:02" },
          { type: "send", text: "بریم یه قرار بذاریم، فردا وقت داری؟", time: "20:05" },
          { type: "receive", text: "آره چرا که نه، عالیه!", time: "20:07" }
        ]
      },
      {
        id: 6,
        name: "کاربر ۴",
        profile: "img/icons/profile.svg",
        messages: [
          { type: "receive", text: "یادته قول دادی پروژه رو تا شنبه تحویل بدی؟", time: "18:00" },
          { type: "send", text: "آره، دارم روش کار می‌کنم", time: "18:05" },
          { type: "receive", text: "خیلی خوبه، چون جلسه داریم", time: "18:07" },
          { type: "send", text: "نگران نباش، آماده میشه 👍", time: "18:10" }
        ]
      },

      {
        id: 7,
        name: "کاربر ۴",
        profile: "img/icons/profile.svg",
        messages: [
          { type: "receive", text: "یادته قول دادی پروژه رو تا شنبه تحویل بدی؟", time: "18:00" },
          { type: "send", text: "آره، دارم روش کار می‌کنم", time: "18:05" },
          { type: "receive", text: "خیلی خوبه، چون جلسه داریم", time: "18:07" },
          { type: "send", text: "نگران نباش، آماده میشه 👍", time: "18:10" }
        ]
      },

      {
        id: 8,
        name: "کاربر ۴",
        profile: "img/icons/profile.svg",
        messages: [
          { type: "receive", text: "یادته قول دادی پروژه رو تا شنبه تحویل بدی؟", time: "18:00" },
          { type: "send", text: "آره، دارم روش کار می‌کنم", time: "18:05" },
          { type: "receive", text: "خیلی خوبه، چون جلسه داریم", time: "18:07" },
          { type: "send", text: "نگران نباش، آماده میشه 👍", time: "18:10" }
        ]
      },

      {
        id:9,
        name: "کاربر ۴",
        profile: "img/icons/profile.svg",
        messages: [
          { type: "receive", text: "یادته قول دادی پروژه رو تا شنبه تحویل بدی؟", time: "18:00" },
          { type: "send", text: "آره، دارم روش کار می‌کنم", time: "18:05" },
          { type: "receive", text: "خیلی خوبه، چون جلسه داریم", time: "18:07" },
          { type: "send", text: "نگران نباش، آماده میشه 👍", time: "18:10" }
        ]
      },
      {
        id:10,
        name: "کاربر ۴",
        profile: "img/icons/profile.svg",
        messages: [
          { type: "receive", text: "یادته قول دادی پروژه رو تا شنبه تحویل بدی؟", time: "18:00" },
          { type: "send", text: "آره، دارم روش کار می‌کنم", time: "18:05" },
          { type: "receive", text: "خیلی خوبه، چون جلسه داریم", time: "18:07" },
          { type: "send", text: "نگران نباش، آماده میشه 👍", time: "18:10" }
        ]
      },
    ]
  };
  
  // المنت‌ها
  const contactsList = document.querySelector(".contact_list");
  const messagesContainer = document.querySelector(".messages_container");
  const chatContainer = document.querySelector(".chat_container");
  const backBtn = document.querySelector(".back");
  
  // ✅ ساخت لیست مخاطبین
  function renderContacts() {
    // پاک کردن قبلی‌ها
    const oldContacts = contactsList.querySelectorAll(".contact");
    oldContacts.forEach(c => c.remove());
  
    // پشتیبانی
    const supportEl = contactsList.querySelector(".supports_chat_pin");
    supportEl.addEventListener("click", () => openChat("support"));
  
    // کاربران
    chatsData.users.forEach(user => {
      const div = document.createElement("div");
      div.classList.add("contact");
      div.dataset.id = user.id;
      div.innerHTML = `
        <div class="contact_contant_right">
          <div class="contact_profile">
            <img src="${user.profile}" alt="contact">
          </div>
          <div class="contact_content">
            <span>${user.name}</span>
            <div class="last_message">
              <span>${user.messages[user.messages.length-1].text}</span>
            </div>
          </div>
        </div>
        <div class="chat_status"><div class="none_message"></div></div>
      `;
      div.addEventListener("click", () => openChat(user.id));
      contactsList.appendChild(div);
    });
  }
  
  // ✅ نمایش پیام‌ها
  function renderMessages(messages) {
    messagesContainer.innerHTML = "";
    messages.forEach(msg => {
      const div = document.createElement("div");
      div.classList.add(msg.type === "send" ? "messages_send" : "messages_receive");
      div.innerHTML = `
        <span>${msg.text}</span>
        <span>${msg.time}</span>
      `;
      messagesContainer.appendChild(div);
    });
  }
  
  // ✅ باز کردن چت
  function openChat(id) {
    // پاک کردن کلاس open از همه
    document.querySelectorAll(".contact, .supports_chat_pin").forEach(el => {
      el.classList.remove("open");
    });
  
    let data;
    if (id === "support") {
      data = chatsData.support;
      contactsList.querySelector(".supports_chat_pin").classList.add("open");
    } else {
      data = chatsData.users.find(u => u.id == id);
      const contactEl = contactsList.querySelector(`.contact[data-id="${id}"]`);
      if (contactEl) contactEl.classList.add("open");
    }
  
    renderMessages(data.messages);
  
    // ✅ در موبایل/تبلت (<=1000px) → فقط بخش چت نشون داده بشه
    if (window.innerWidth <= 1000) {
      chatContainer.classList.add("mobile-chat-open");
    }
  }
  
  // ✅ دکمه برگشت
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      chatContainer.classList.remove("mobile-chat-open");
    });
  }
  
  // ✅ اجرای اولیه
  renderContacts();
  openChat("support"); // پیش‌فرض پشتیبانی باز باشه
  