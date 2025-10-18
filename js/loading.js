// ---------------------- تابع مخفی کردن Preloader ----------------------
function hidePreloader() {
  const preloader = document.getElementById('preloader');
  const content = document.querySelector('.content');
  let opacity = 1;

  const fadeOut = setInterval(() => {
    if (opacity > 0) {
      opacity -= 0.1;
      preloader.style.opacity = opacity;
    } else {
      clearInterval(fadeOut);
      preloader.style.display = 'none';
      content.style.display = 'block';
    }
  }, 50);
}


// ---------------------- صبر برای لود شدن همه تصاویر ----------------------
function waitForImages() {
  const images = Array.from(document.images);
  const promises = images.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => {
      img.onload = img.onerror = resolve;
    });
  });
  return Promise.all(promises);
}

// ---------------------- اجرای اصلی ----------------------
async function loadDataAndRender() {
  try {
    // گرفتن داده‌ها
    const data = await fetchTournaments();

    // رندر کارت‌ها
    data.forEach(tournament => renderTournamentCard(tournament));

    // صبر همزمان برای API + تصاویر
    await Promise.all([
      waitForImages(),
      new Promise(resolve => window.requestAnimationFrame(resolve)) // اطمینان از رندر DOM
    ]);

    // مخفی کردن Preloader
    hidePreloader();

  } catch (err) {
    console.error("loadDataAndRender error:", err);
    hidePreloader(); // در صورت خطا هم لودینگ حذف میشه
  }
}

// ---------------------- شروع برنامه ----------------------
document.addEventListener("DOMContentLoaded", () => {
  loadDataAndRender();
});
