const games = [
    { title: "PUBG Mobile", img: "img/1.png", banners: [ { title: "PUBG Mobile Championship", description: "رقابت بزرگ پابجی موبایل با جایزه نقدی!", registerDeadline: "50 : 12", participants: { total: 100, current: 56 }, bannerImage: "img/banner9.jpg", tournamentLink: "#1", allTournamentsLink: "#" } ] },
    { title: "Fortnite", img: "img/2.png", banners: [ { title: "Fortnite Battle Cup", description: "بزرگ‌ترین جام فورتنایت سال 2025", registerDeadline: "20 : 08", participants: { total: 80, current: 42 }, bannerImage: "img/banner10.jpg", tournamentLink: "#2", allTournamentsLink: "#" } ] },
    { title: "Valorant", img: "img/1.png", banners: [ { title: "Valorant Champions", description: "مسابقات هیجان‌انگیز ولورانت برای گیمرها", registerDeadline: "15 : 30", participants: { total: 64, current: 50 }, bannerImage: "img/banner4.jpg", tournamentLink: "#3", allTournamentsLink: "#" } ] },
    { title: "Call of Duty", img: "img/2.png", banners: [ { title: "Call of Duty Showdown", description: "مبارزات نفس‌گیر کال آو دیوتی", registerDeadline: "05 : 45", participants: { total: 120, current: 90 }, bannerImage: "img/banner5.jpg", tournamentLink: "#4", allTournamentsLink: "#" } ] },
    { title: "League of Legends", img: "img/1.png", banners: [ { title: "League of Legends Cup", description: "لیگ قهرمانان LoL با بهترین تیم‌ها", registerDeadline: "30 : 10", participants: { total: 96, current: 88 }, bannerImage: "img/banner6.jpg", tournamentLink: "#5", allTournamentsLink: "#" } ] },
    { title: "CS:GO", img: "img/2.png", banners: [ { title: "CS:GO Masters", description: "تور جهانی کانتر استرایک 2025", registerDeadline: "40 : 20", participants: { total: 70, current: 65 }, bannerImage: "img/banner7.jpg", tournamentLink: "#6", allTournamentsLink: "#" } ] }
];

let activeGameIndex = 0;
let slideInterval;

function renderBanner(banner) {
    document.querySelector(".game_bg img").src = banner.bannerImage;
    document.querySelector(".game_banner_title span").textContent = banner.title;
    document.querySelector(".game_banner_description span").textContent = banner.description;
    document.querySelector(".game_banner_date_usercount span:nth-child(1)").textContent = "مهلت ثبتنام : " + banner.registerDeadline;
    document.querySelector(".game_banner_date_usercount span:nth-child(4)").textContent = `${banner.participants.total}/${banner.participants.current}`;
    document.querySelector(".watch_tourament").onclick = () => window.location.href = banner.tournamentLink;
    document.querySelector(".all_tournaments_link").href = banner.allTournamentsLink;
}

function renderGameList() {
    const listContainer = document.querySelector(".game_list");
    listContainer.innerHTML = "";
    games.forEach((game, index) => {
        const item = document.createElement("div");
        item.className = `game_list_item ${index === 0 ? "list_item_active" : ""}`;
        item.innerHTML = `
            <div class="game_list_img"><img src="${game.img}" alt="${game.title}"></div>
            <div class="game_list_tilte"><span>${game.title}</span></div>
        `;
        // رویداد کلیک
        item.addEventListener("click", () => {
            clearInterval(slideInterval); // توقف تایمر
            setActiveGame(index); // نمایش بازی کلیک‌شده
            startAutoSlide(index + 1); // ادامه از بازی بعدی
        });
        listContainer.appendChild(item);
    });
}

function setActiveGame(index) {
    activeGameIndex = index % games.length;
    document.querySelectorAll(".game_list_item").forEach((el, idx) => {
        el.classList.toggle("list_item_active", idx === activeGameIndex);
    });
    renderBanner(games[activeGameIndex].banners[0]);
}

function startAutoSlide(startIndex = 0) {
    clearInterval(slideInterval);
    activeGameIndex = startIndex % games.length;
    slideInterval = setInterval(() => {
        setActiveGame(activeGameIndex);
        activeGameIndex = (activeGameIndex + 1) % games.length;
    }, 4000);
}

// شروع
renderGameList();
setActiveGame(0);
startAutoSlide(1); // شروع از آیتم دوم بعد از اول


const mobileSlides = [
    {
        gameName: "PUBG",
        title: "PUBG Mobile Championship",
        description: "در این قسمت توضیحاتی درباره بازی یا تورنومنت ها قرار میگیره توجه داشته باشید که بیــشتر از دوسطر هماننطور  در اینجا مـــیبینــــیدمـتن ",
        bannerImage: "img/banner8.jpg",
        participants: { total: 100, current: 56 },
        joinLink: "#"
    },
    {
        gameName: "Fortnite",
        title: "Fortnite Summer Cup",
        description: "در این قسمت توضیحاتی درباره بازی یا تورنومنت ها قرار میگیره توجه داشته باشید که بیــشتر از دوسطر هماننطور  در اینجا مـــیبینــــیدمـتن ",
        bannerImage: "img/banner10.jpg",
        participants: { total: 80, current: 40 },
        joinLink: "#"
    },
    {
        gameName: "Call of Duty",
        title: "COD Mobile Showdown",
        description: "در این قسمت توضیحاتی درباره بازی یا تورنومنت ها قرار میگیره توجه داشته باشید که بیــشتر از دوسطر هماننطور  در اینجا مـــیبینــــیدمـتن ",
        bannerImage: "img/banner9.jpg",
        participants: { total: 120, current: 90 },
        joinLink: "#"
    }
];





function renderMobileSlider() {
    const mobileContainer = document.querySelector(".mobile_slider_container");
    mobileContainer.innerHTML = ""; // پاک کردن محتوای قبلی

    mobileSlides.forEach((slideData) => {
        const slide = document.createElement("div");
        slide.className = "mobile_slide";

        slide.innerHTML = `
            <div class="mobile_game_banner">
                <img src="${slideData.bannerImage}" alt="${slideData.gameName} banner">
            </div>
            <div class="mobile_banner_content">
                <div class="m_content_top">
                    <div class="mobile_join_link">
                        <a href="${slideData.joinLink}">
                            <button><img src="img/icons/plus.svg" alt="join"></button>
                        </a>
                    </div>
                </div>
                <div class="m_content_bottom">
                    <div class="mobilr_content_title">
                        <span>${slideData.gameName}</span>
                    </div>
                    <div class="mobile_content_description">
                        <span>${slideData.description}</span>
                    </div>
                    <div class="mobile_content_user_count">
                        <span>${slideData.participants.total}/${slideData.participants.current}</span>
                    </div>
                </div>
            </div>
        `;

        mobileContainer.appendChild(slide);
    });
}

renderMobileSlider();



// کد های نیاز برای اسکرول اسلایدر در حالت موبایل


const slider = document.querySelector(".mobile_slider_container");
const slides = document.querySelectorAll(".mobile_slide");

const cardWidth = 290;
const gap = 20;
const slideWidth = cardWidth + gap;
let currentIndex = 1; // کارت وسط شروع

// محاسبه اسکرول طوری که کارت وسط بیفته وسط صفحه
function scrollToCard(index) {
    const offset = (slider.offsetWidth - cardWidth) / 2; // فاصله از وسط
    slider.scrollTo({
        left: index * slideWidth - offset,
        behavior: "smooth"
    });
}

// شروع از کارت وسط
scrollToCard(currentIndex);

// اسکرول خودکار
function autoScroll() {
    currentIndex = (currentIndex + 1) % slides.length;
    scrollToCard(currentIndex);
}

let autoScrollInterval = setInterval(autoScroll, 3000);

// وقتی کاربر اسکرول دستی کرد → نزدیک‌ترین کارت وسط بیفته
let isScrolling;
slider.addEventListener("scroll", () => {
    clearTimeout(isScrolling);
    clearInterval(autoScrollInterval); // توقف موقت اسکرول خودکار

    isScrolling = setTimeout(() => {
        const offset = (slider.offsetWidth - cardWidth) / 2;
        let nearestIndex = Math.round((slider.scrollLeft + offset) / slideWidth);
        currentIndex = nearestIndex;
        scrollToCard(nearestIndex);

        autoScrollInterval = setInterval(autoScroll, 3000); // راه‌اندازی مجدد
    }, 150);
});
