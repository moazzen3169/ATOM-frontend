






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
  