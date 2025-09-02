window.onload = function() {
    // لودیینگ رو پیدا کن
    const preloader = document.getElementById('preloader');
    const content = document.querySelector('.content');
  
    // انیمیشن محو کردن لودیینگ
    preloader.style.opacity = 1;
    const fadeOut = setInterval(() => {
      if (preloader.style.opacity > 0) {
        preloader.style.opacity -= 0.1;
      } else {
        clearInterval(fadeOut);
        preloader.style.display = 'none';
        content.style.display = 'block';
      }
    }, 50);
  };