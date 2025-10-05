const overlay = document.querySelector(".overlay");
const leveL2Modal = document.querySelector(".level_2_modal");
const leveL3Modal = document.querySelector(".level_3_modal");
const level2btn = document.querySelector("#level-2-btn");
const level3btn = document.querySelector("#level-3-btn");

overlay.classList.add("hidden");
leveL2Modal.classList.add("hidden");
leveL3Modal.classList.add("hidden");

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



})