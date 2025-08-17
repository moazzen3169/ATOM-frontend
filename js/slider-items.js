
async function fetchGames() {
  const access = localStorage.getItem("access"); // گرفتن توکن از localStorage
  if (!access) {
    document.getElementById("output").innerText = "❌ توکن access در localStorage پیدا نشد.";
    return;
  } 

  try {   
    // استفاده از proxy برای دور زدن CORS
    const url = "https://atom-game.ir/api/tournaments/games";
    const proxyUrl = "https://api.allorigins.win/get?url=" + encodeURIComponent(url);

    const response = await fetch(proxyUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${access}`,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    // پاسخ allorigins در فیلد contents هست
    const wrapped = await response.json();
    const data = JSON.parse(wrapped.contents);

    document.getElementById("output").innerHTML =
      `<pre>${JSON.stringify(data, null, 2)}</pre>`;

  } catch (error) {
    document.getElementById("output").innerText =
      "⚠️ خطا در دریافت داده‌ها: " + error.message;
  }
}

fetchGames();













// // رویداد کلیک روی آیتم‌های لیست
// document.querySelectorAll(".game_list_item").forEach((item, index) => {
//     item.addEventListener("click", () => {
//         // تغییر استایل آیتم فعال
//         document.querySelectorAll(".game_list_item").forEach(el => {
//             el.classList.remove("list_item_active");
//         });
//         item.classList.add("list_item_active");

//         // تغییر بنر با توجه به آیتم کلیک‌شده
//         renderBanner(games[index].banners[0]);
//     });
// });






// // کد های نیاز برای اسکرول اسلایدر در حالت موبایل


// const slider = document.querySelector(".mobile_slider_container");
// const slides = document.querySelectorAll(".mobile_slide");

// const cardWidth = 290;
// const gap = 20;
// const slideWidth = cardWidth + gap;
// let currentIndex = 1; // کارت وسط شروع

// // محاسبه اسکرول طوری که کارت وسط بیفته وسط صفحه
// function scrollToCard(index) {
//     const offset = (slider.offsetWidth - cardWidth) / 2; // فاصله از وسط
//     slider.scrollTo({
//         left: index * slideWidth - offset,
//         behavior: "smooth"
//     });
// }

// // شروع از کارت وسط
// scrollToCard(currentIndex);

// // اسکرول خودکار
// function autoScroll() {
//     currentIndex = (currentIndex + 1) % slides.length;
//     scrollToCard(currentIndex);
// }

// let autoScrollInterval = setInterval(autoScroll, 3000);

// // وقتی کاربر اسکرول دستی کرد → نزدیک‌ترین کارت وسط بیفته
// let isScrolling;
// slider.addEventListener("scroll", () => {
//     clearTimeout(isScrolling);
//     clearInterval(autoScrollInterval); // توقف موقت اسکرول خودکار

//     isScrolling = setTimeout(() => {
//         const offset = (slider.offsetWidth - cardWidth) / 2;
//         let nearestIndex = Math.round((slider.scrollLeft + offset) / slideWidth);
//         currentIndex = nearestIndex;
//         scrollToCard(nearestIndex);

//         autoScrollInterval = setInterval(autoScroll, 3000); // راه‌اندازی مجدد
//     }, 150);
// });
