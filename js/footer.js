document.addEventListener("DOMContentLoaded", function () {
    fetch("../footer.html")
        .then(response => response.text())
        .then(data => {
            document.getElementById("footer").innerHTML = data;

            // بعد از لود شدن هدر، بقیه کدها رو اجرا کن
            initHeaderAndSidebar();

            // اسکرول به بالای صفحه
            window.scrollTo(0, 0);
        })
        .catch(error => console.error("خطا در بارگذاری هدر:", error));
});