


const creatTicketBtn = document.querySelector(".creat_ticket_btn");
const creatTicketmodalContainer = document.querySelector(".creat_ticket_modal_container");

creatTicketmodalContainer.classList.add("hidden");
creatTicketBtn.addEventListener("click" , function(){
    creatTicketmodalContainer.classList.toggle("hidden");
})
creatTicketmodalContainer.addEventListener("click" , function(){
    creatTicketmodalContainer.classList.toggle("hidden");
})



// user-ticket.js

class UserTickets {
    constructor() {
        this.tickets = [];
        this.selectedTicket = null;
        this.currentUser = null;
        this.baseURL = '/api/support/tickets/';
        
        this.init();
    }

    async init() {
        // بررسی لاگین بودن کاربر
        await this.checkAuth();
        
        // بارگذاری تیکت‌ها
        await this.loadTickets();
        
        // تنظیم event listeners
        this.setupEventListeners();
    }

    // بررسی وضعیت احراز هویت کاربر
    async checkAuth() {
        try {
            const token = localStorage.getItem('access_token');
            if (!token) {
                window.location.href = '../register/login.html';
                return;
            }
            
            // در اینجا می‌توانید اطلاعات کاربر را از API بگیرید
            this.currentUser = {
                id: 1, // این مقدار باید از API گرفته شود
                name: 'user name'
            };
            
        } catch (error) {
            console.error('Authentication error:', error);
            window.location.href = '/login.html';
        }
    }

    // بارگذاری لیست تیکت‌ها
    async loadTickets() {
        try {
            const response = await this.apiCall(this.baseURL, 'GET');
            
            if (response && Array.isArray(response)) {
                this.tickets = response;
                this.renderTicketsList();
            } else {
                this.tickets = [];
                this.renderTicketsList();
            }
            
        } catch (error) {
            console.error('Error loading tickets:', error);
            this.showError('خطا در بارگذاری تیکت‌ها');
        }
    }

    // نمایش لیست تیکت‌ها
    renderTicketsList() {
        const container = document.querySelector('.tickets_lists_container');
        
        if (this.tickets.length === 0) {
            container.innerHTML = `
                <div class="no-tickets-message">
                    <p>هنوز هیچ تیکتی ایجاد نکرده‌اید</p>
                    <button class="creat_ticket_btn">ایجاد اولین تیکت</button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.tickets.map(ticket => `
            <div class="ticket_item ${this.getStatusClass(ticket.status)} ${this.selectedTicket && this.selectedTicket.id === ticket.id ? 'selected' : ''}" 
                 data-ticket-id="${ticket.id}">
                <div class="ticket_title">${ticket.title}</div>
                <div class="ticket_status ${ticket.status}">${this.getStatusText(ticket.status)}</div>
                <div class="ticket_last_message">${this.getLastMessagePreview(ticket)}</div>
                <div class="ticket_add_date">${this.formatDate(ticket.created_at)}</div>
            </div>
        `).join('');

        // اضافه کردن event listener برای آیتم‌ها
        this.addTicketItemListeners();
    }

    // دریافت کلاس وضعیت برای استایل‌دهی
    getStatusClass(status) {
        const statusMap = {
            'open': 'open',
            'pending': 'pending',
            'resolved': 'resolved',
            'closed': 'closed',
            'new': 'new'
        };
        return statusMap[status] || 'closed';
    }

    // دریافت متن وضعیت به فارسی
    getStatusText(status) {
        const statusTextMap = {
            'open': 'باز',
            'pending': 'در حال انتظار',
            'resolved': 'پاسخ داده شده',
            'closed': 'بسته شده',
            'new': 'جدید'
        };
        return statusTextMap[status] || 'بسته شده';
    }

    // پیش‌نمایش آخرین پیام
    getLastMessagePreview(ticket) {
        if (!ticket.messages || ticket.messages.length === 0) {
            return 'هنوز پیامی ارسال نشده است...';
        }
        
        const lastMessage = ticket.messages[ticket.messages.length - 1].message;
        return lastMessage.length > 50 ? lastMessage.substring(0, 50) + '...' : lastMessage;
    }

    // فرمت تاریخ
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('fa-IR');
    }

    // اضافه کردن event listener برای آیتم‌های تیکت
    addTicketItemListeners() {
        document.querySelectorAll('.ticket_item').forEach(item => {
            item.addEventListener('click', async (e) => {
                const ticketId = parseInt(item.dataset.ticketId);
                await this.selectTicket(ticketId);
            });
        });
    }

    // انتخاب تیکت و نمایش جزئیات
    async selectTicket(ticketId) {
        try {
            // حذف کلاس selected از همه آیتم‌ها
            document.querySelectorAll('.ticket_item').forEach(item => {
                item.classList.remove('selected');
            });
            
            // اضافه کردن کلاس selected به آیتم انتخاب شده
            const selectedItem = document.querySelector(`[data-ticket-id="${ticketId}"]`);
            if (selectedItem) {
                selectedItem.classList.add('selected');
            }
            
            // بارگذاری اطلاعات کامل تیکت
            const response = await this.apiCall(`${this.baseURL}${ticketId}/`, 'GET');
            this.selectedTicket = response;
            
            // نمایش بخش مکالمه
            this.showConversation();
            
            // بارگذاری پیام‌های تیکت
            await this.loadTicketMessages(ticketId);
            
        } catch (error) {
            console.error('Error selecting ticket:', error);
            this.showError('خطا در بارگذاری اطلاعات تیکت');
        }
    }

    // نمایش بخش مکالمه
    showConversation() {
        const conversationSection = document.querySelector('.tickets_conversation');
        const conversationHead = document.querySelector('.conversation_head span');
        
        conversationSection.classList.add('C-open');
        conversationSection.classList.remove('no-open');
        
        conversationHead.textContent = this.selectedTicket.title;
        
        this.renderMessages();
    }

    // بارگذاری پیام‌های تیکت
    async loadTicketMessages(ticketId) {
        try {
            const response = await this.apiCall(`${this.baseURL}${ticketId}/messages/`, 'GET');
            
            if (this.selectedTicket) {
                this.selectedTicket.messages = response;
                this.renderMessages();
            }
            
        } catch (error) {
            console.error('Error loading messages:', error);
            this.showError('خطا در بارگذاری پیام‌ها');
        }
    }

    // نمایش پیام‌ها
    renderMessages() {
        const messagesContainer = document.querySelector('.show_message');
        
        if (!this.selectedTicket || !this.selectedTicket.messages || this.selectedTicket.messages.length === 0) {
            messagesContainer.innerHTML = '<p class="no-messages">هنوز پیامی ارسال نشده است</p>';
            return;
        }

        messagesContainer.innerHTML = this.selectedTicket.messages.map(message => `
            <div class="message ${message.user === this.currentUser.id ? 'user_message' : 'support_message'}">
                <p>${message.message}</p>
                <span class="message-time">${this.formatTime(message.created_at)}</span>
            </div>
        `).join('');

        // اسکرول به پایین
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // فرمت زمان
    formatTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleTimeString('fa-IR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    // تنظیم event listeners
    setupEventListeners() {
        // دکمه ایجاد تیکت جدید
        document.querySelector('.creat_ticket_btn').addEventListener('click', () => {
            this.showCreateTicketModal();
        });

        // ارسال پاسخ
        document.querySelector('.answer_form form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.sendMessage();
        });

        // بستن مدال با کلیک خارج از آن
        document.querySelector('.creat_ticket_modal_container').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.hideCreateTicketModal();
            }
        });
    }

    // نمایش مدال ایجاد تیکت
    showCreateTicketModal() {
        const modal = document.querySelector('.creat_ticket_modal_container');
        modal.classList.remove('hidden');
        
        // محتوای مدال
        document.querySelector('.creat_ticket_modal').innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>ایجاد تیکت جدید</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <form id="createTicketForm">
                    <div class="form-group">
                        <label for="ticketTitle">عنوان تیکت</label>
                        <input type="text" id="ticketTitle" name="title" required maxlength="255" placeholder="عنوان تیکت را وارد کنید">
                    </div>
                    <div class="form-group">
                        <label for="ticketMessage">پیام اولیه</label>
                        <textarea id="ticketMessage" name="message" required placeholder="مشکل یا سوال خود را شرح دهید"></textarea>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="cancel-btn">انصراف</button>
                        <button type="submit" class="submit-btn">ایجاد تیکت</button>
                    </div>
                </form>
            </div>
        `;

        // event listeners برای مدال
        document.querySelector('.close-modal').addEventListener('click', () => {
            this.hideCreateTicketModal();
        });

        document.querySelector('.cancel-btn').addEventListener('click', () => {
            this.hideCreateTicketModal();
        });

        document.getElementById('createTicketForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.createNewTicket();
        });
    }

    // پنهان کردن مدال ایجاد تیکت
    hideCreateTicketModal() {
        document.querySelector('.creat_ticket_modal_container').classList.add('hidden');
    }

    // ایجاد تیکت جدید
    async createNewTicket() {
        try {
            const formData = new FormData(document.getElementById('createTicketForm'));
            const title = formData.get('title');
            const message = formData.get('message');

            // ایجاد تیکت
            const ticketResponse = await this.apiCall(this.baseURL, 'POST', {
                title: title
            });

            // ارسال پیام اولیه
            await this.apiCall(`${this.baseURL}${ticketResponse.id}/messages/`, 'POST', {
                ticket: ticketResponse.id,
                message: message
            });

            this.hideCreateTicketModal();
            await this.loadTickets(); // بارگذاری مجدد لیست
            
            this.showSuccess('تیکت با موفقیت ایجاد شد');
            
        } catch (error) {
            console.error('Error creating ticket:', error);
            this.showError('خطا در ایجاد تیکت');
        }
    }

    // ارسال پیام
    async sendMessage() {
        if (!this.selectedTicket) {
            this.showError('لطفاً ابتدا یک تیکت انتخاب کنید');
            return;
        }

        const messageInput = document.querySelector('#resporn');
        const message = messageInput.value.trim();

        if (!message) {
            this.showError('لطفاً پیام خود را وارد کنید');
            return;
        }

        try {
            await this.apiCall(`${this.baseURL}${this.selectedTicket.id}/messages/`, 'POST', {
                ticket: this.selectedTicket.id,
                message: message
            });

            // پاک کردن فیلد ورودی
            messageInput.value = '';
            
            // بارگذاری مجدد پیام‌ها
            await this.loadTicketMessages(this.selectedTicket.id);
            
        } catch (error) {
            console.error('Error sending message:', error);
            this.showError('خطا در ارسال پیام');
        }
    }

    // فراخوانی API
    async apiCall(url, method = 'GET', data = null) {
        const token = localStorage.getItem('access_token');
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        const config = {
            method: method,
            headers: headers
        };

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            config.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            if (response.status !== 204) { // برای درخواست‌های DELETE که response body ندارند
                return await response.json();
            }
            
            return null;
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    }

    // نمایش پیام موفقیت
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    // نمایش پیام خطا
    showError(message) {
        this.showNotification(message, 'error');
    }

    // نمایش نوتیفیکیشن
    showNotification(message, type) {
        // ایجاد عنصر نوتیفیکیشن
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // استایل‌دهی
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            z-index: 1000;
            font-family: inherit;
            ${type === 'success' ? 'background: #4CAF50;' : 'background: #f44336;'}
        `;
        
        document.body.appendChild(notification);
        
        // حذف خودکار بعد از 3 ثانیه
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// مقداردهی اولیه وقتی DOM لود شد
document.addEventListener('DOMContentLoaded', () => {
    new UserTickets();
});