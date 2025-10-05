const overlay = document.querySelector(".overlay");
const leveL2Modal = document.querySelector(".level_2_modal");
const leveL3Modal = document.querySelector(".level_3_modal");
const level2btn = document.querySelector("#level-2-btn");
const level3btn = document.querySelector("#level-3-btn");
const nemuneh =document.querySelector(".nemuneh");
const nemunehModal =document.querySelector(".nemuneh_modal");

overlay.classList.add("hidden");
leveL2Modal.classList.add("hidden");
leveL3Modal.classList.add("hidden");
nemunehModal.classList.add("hidden");

level2btn.addEventListener("click" , function(){
    overlay.classList.remove("hidden");
    leveL2Modal.classList.remove("hidden");
});
level3btn.addEventListener("click" , function(){
    overlay.classList.remove("hidden");
    leveL3Modal.classList.remove("hidden");
});

overlay.addEventListener("click" , function(){
    leveL3Modal.classList.add("hidden");
    leveL2Modal.classList.add("hidden");
    overlay.classList.add("hidden");
    nemunehModal.classList.add("hidden");

})

nemuneh.addEventListener("click" , function(){
    overlay.classList.remove("hidden");
    nemunehModal.classList.remove("hidden");
    
})


    document.addEventListener('DOMContentLoaded', function() {
        // تنظیم رویداد برای فایل سلفی
        const selfyInput = document.getElementById('selfy_picturse');
        const selfyInfo = document.getElementById('selfy_info');
        const selfyWarning = document.getElementById('selfy_warning');
        
        selfyInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const file = this.files[0];
                const fileSize = (file.size / (1024 * 1024)).toFixed(2); // تبدیل به مگابایت
                
                if (fileSize > 5) {
                    selfyWarning.style.display = 'block';
                    selfyInfo.textContent = '';
                } else {
                    selfyWarning.style.display = 'none';
                    selfyInfo.textContent = `فایل: ${file.name} (${fileSize} MB)`;
                }
            }
        });
        
        // تنظیم رویداد برای فایل کارت ملی
        const idCardInput = document.getElementById('id_card');
        const idCardInfo = document.getElementById('id_card_info');
        const idCardWarning = document.getElementById('id_card_warning');
        
        idCardInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const file = this.files[0];
                const fileSize = (file.size / (1024 * 1024)).toFixed(2); // تبدیل به مگابایت
                
                if (fileSize > 5) {
                    idCardWarning.style.display = 'block';
                    idCardInfo.textContent = '';
                } else {
                    idCardWarning.style.display = 'none';
                    idCardInfo.textContent = `فایل: ${file.name} (${fileSize} MB)`;
                }
            }
        });
        
        // جلوگیری از ارسال فرم برای نمایش
        document.querySelector('form').addEventListener('submit', function(e) {
            e.preventDefault();
            alert('فرم با موفقیت ارسال شد! (این فقط یک نمونه است)');
        });
    });