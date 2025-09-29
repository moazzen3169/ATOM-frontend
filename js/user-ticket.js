


const creatTicketBtn = document.querySelector(".creat_ticket_btn");
const creatTicketmodalContainer = document.querySelector(".creat_ticket_modal_container");

creatTicketmodalContainer.classList.add("hidden");
creatTicketBtn.addEventListener("click" , function(){
    creatTicketmodalContainer.classList.toggle("hidden");
})
creatTicketmodalContainer.addEventListener("click" , function(){
    creatTicketmodalContainer.classList.toggle("hidden");
})
