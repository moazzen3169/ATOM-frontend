const newTicketBtn = document.getElementById('new-ticket-btn');
const newTicketModal = document.getElementById('new-ticket-modal');
const cancelNewTicketBtn = document.getElementById('cancel-new-ticket');
const newTicketForm = document.getElementById('new-ticket-form');

newTicketBtn.addEventListener('click', () => {
  newTicketModal.style.display = 'flex';
});

cancelNewTicketBtn.addEventListener('click', () => {
  newTicketModal.style.display = 'none';
});

newTicketForm.addEventListener('submit', (e) => {
  e.preventDefault();
  alert('تیکت جدید ارسال شد!');
  newTicketModal.style.display = 'none';
  newTicketForm.reset();
});
