          
          
          
          
document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.games_container');
  
    fetch('https://atom-game.ir/api/tournaments/games/')
      .then(res => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then(games => {
        container.innerHTML = ''; // پاک کردن محتوای دستی قبلی
  
        games.forEach(game => {
          const heroBanner = game.images.find(img => img.image_type === 'hero_banner')?.image || '';
          const gameImg = game.images.find(img => img.image_type === 'game_image')?.image || '';
          // در صورت نیاز به slider، میتوانید مشابه آن را اضافه کنید
  
          const gameItem = document.createElement('div');
          gameItem.classList.add('game_item');
  
          gameItem.innerHTML = `
            <div class="game_image">
              <img src="${heroBanner}" alt="hero_banner">
            </div>
            <div class="game_content">
              <div class="game_cover">
                <img src="${gameImg}" alt="game_cover">
              </div>
              <div class="game_title"><span>${game.name}</span></div>
              <div class="game_description"><span>${game.description}</span></div>
              <a href="game-touranments.html?id=${game.id}" class="show_tournaments">مشاهده تورنومنت ها</a>
            </div>
          `;
  
          container.appendChild(gameItem);
        });
      })
      .catch(err => {
        console.error('Fetch error:', err);
        container.innerHTML = '<p>خطا در بارگذاری بازی‌ها. لطفاً بعداً تلاش کنید.</p>';
      });
  });
  








  document.addEventListener("DOMContentLoaded", () => {
    let currentPage = 0;
    let isScrolling = false;
  
    const footer = document.querySelector("#footer");
    const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
    const getPages = () => Array.from(document.querySelectorAll(".game_item"));
  
    const scrollToPage = () => {
      const pages = getPages();
      if (footer && currentPage === pages.length) {
        window.scrollTo({ top: footer.offsetTop, behavior: "smooth" });
      } else {
        window.scrollTo({ top: currentPage * window.innerHeight, behavior: "smooth" });
      }
    };
  
    // دسکتاپ (چرخ موس)
    window.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (isScrolling) return;
      isScrolling = true;
  
      const dir = e.deltaY > 0 ? 1 : -1;
      const pages = getPages();
      const maxPage = pages.length + (footer ? 1 : 0) - 1;
      currentPage = clamp(currentPage + dir, 0, maxPage);
  
      scrollToPage();
  
      setTimeout(() => { isScrolling = false; }, 300);
    }, { passive: false });
  
    // موبایل (لمس / swipe)
    let touchStartY = 0;
    window.addEventListener("touchstart", (e) => {
      touchStartY = e.touches[0].clientY;
    });
  
    window.addEventListener("touchend", (e) => {
      if (isScrolling) return;
      let touchEndY = e.changedTouches[0].clientY;
      let deltaY = touchStartY - touchEndY;
  
      if (Math.abs(deltaY) < 30) return; // جلوگیری از اسکرول ناچیز
  
      isScrolling = true;
  
      const dir = deltaY > 0 ? 1 : -1;
      const pages = getPages();
      const maxPage = pages.length + (footer ? 1 : 0) - 1;
      currentPage = clamp(currentPage + dir, 0, maxPage);
  
      scrollToPage();
  
      setTimeout(() => { isScrolling = false; }, 300);
    });
  
    window.addEventListener("resize", () => {
      scrollToPage();
    });
  });
  
  