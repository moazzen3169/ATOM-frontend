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

// نمونه با fetch
async function loadDataAndRender() {
  const data = await fetch("api/tournaments")
      .then(res => res.json())
      .catch(err => {
          console.error(err);
          return [];
      });

  // اینجا کارت‌ها را رندر می‌کنیم
  data.forEach(tournament => renderTournamentCard(tournament));

  // بعد از اینکه داده‌ها رندر شدند، لودینگ را مخفی می‌کنیم
  hidePreloader();
}

// شروع برنامه
document.addEventListener('DOMContentLoaded', () => {
  loadDataAndRender();
});
