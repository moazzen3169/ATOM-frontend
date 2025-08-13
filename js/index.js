
// کد های مورد نیاز برای لودیینگ

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

// 
// 
// 
// 





// برای تایین رنگ سایه آیتم ها

document.querySelectorAll('.cart_container').forEach(container => {
    const img = container.querySelector('.cart_image img');
    if (!img) return; // اگه عکسی نبود رد شو
  
    img.addEventListener('load', () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
  
      const pixel = ctx.getImageData(0, 0, 1, 1).data;
      const topColor = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
      container.style.setProperty('--top-color', topColor);
    });
  });
  





  const goTOp = document.querySelector(".go-top");

  goTOp.addEventListener("click", function() {
    window.scrollTo({
      top: 0,
      behavior: "smooth" // اسکرول نرم
    });
  });
  
