const games = [
    { title: "PUBG Mobile", img: "img/1.png", banners: [ { title: "PUBG Mobile Championship", description: "رقابت بزرگ پابجی موبایل با جایزه نقدی!", registerDeadline: "50 : 12", participants: { total: 100, current: 56 }, bannerImage: "img/banner8.jpg", tournamentLink: "#1", allTournamentsLink: "#" } ] },
    { title: "Fortnite", img: "img/2.png", banners: [ { title: "Fortnite Battle Cup", description: "بزرگ‌ترین جام فورتنایت سال 2025", registerDeadline: "20 : 08", participants: { total: 80, current: 42 }, bannerImage: "img/banner3.jpg", tournamentLink: "#2", allTournamentsLink: "#" } ] },
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
        item.className = `game_list_item ${index === 0 ? "active" : ""}`;
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
        el.classList.toggle("active", idx === activeGameIndex);
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
