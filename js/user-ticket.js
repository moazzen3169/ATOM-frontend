// user-ticket.js

class UserTickets {
    constructor() {
        this.tickets = [];
        this.selectedTicket = null;
        this.currentUser = null;
        this.baseURL = '/api/support/tickets/';

        this.ticketsListContainer = document.querySelector('.tickets_lists_container');
        this.modalContainer = document.querySelector('.creat_ticket_modal_container');
        this.modalContent = document.querySelector('.creat_ticket_modal');
        this.conversationSection = document.querySelector('.tickets_conversation');
        this.conversationTitle = document.querySelector('.conversation_ticket_title');
        this.conversationStatus = document.querySelector('.conversation_ticket_status');
        this.conversationDate = document.querySelector('.conversation_ticket_date');
        this.messagesContainer = document.querySelector('.show_message');
        this.answerForm = document.querySelector('.answer_form form');

        this.handleDocumentClick = this.handleDocumentClick.bind(this);
        this.handleModalOutsideClick = this.handleModalOutsideClick.bind(this);
        this.handleAnswerFormSubmit = this.handleAnswerFormSubmit.bind(this);

        this.init();
    }

    async init() {
        try {
            await this.checkAuth();
            await this.loadTickets();
            this.setupEventListeners();
        } catch (error) {
            console.error('Initialization error:', error);
        }
    }

    getAuthToken() {
        return localStorage.getItem('access_token') || localStorage.getItem('token');
    }

    redirectToLogin() {
        window.location.href = '../register/login.html';
    }

    async checkAuth() {
        const token = this.getAuthToken();
        if (!token) {
            this.redirectToLogin();
            throw new Error('No authentication token found');
        }

        try {
            const user = await this.apiCall('/api/auth/users/me/', 'GET');
            if (user && user.id) {
                this.currentUser = user;
            } else {
                this.currentUser = { id: null };
            }
        } catch (error) {
            console.error('Authentication error:', error);
            this.redirectToLogin();
            throw error;
        }
    }

    async loadTickets() {
        const previousSelectedId = this.selectedTicket ? this.selectedTicket.id : null;

        try {
            const response = await this.apiCall(this.baseURL, 'GET');
            this.tickets = Array.isArray(response) ? response : [];

            if (previousSelectedId && !this.tickets.some(ticket => ticket.id === previousSelectedId)) {
                this.selectedTicket = null;
            } else if (this.selectedTicket) {
                const updated = this.tickets.find(ticket => ticket.id === this.selectedTicket.id);
                if (updated) {
                    this.selectedTicket = { ...updated, messages: this.selectedTicket.messages || [] };
                }
            }

            this.renderTicketsList();

            if (!this.selectedTicket) {
                this.resetConversation();
            } else {
                this.updateConversationHeader();
            }
        } catch (error) {
            console.error('Error loading tickets:', error);
            this.tickets = [];
            this.renderTicketsList();
            this.selectedTicket = null;
            this.resetConversation();
            this.showError('خطا در بارگذاری تیکت‌ها');
        }
    }

    setupEventListeners() {
        document.addEventListener('click', this.handleDocumentClick);

        if (this.modalContainer) {
            this.modalContainer.addEventListener('click', this.handleModalOutsideClick);
        }

        if (this.answerForm) {
            this.answerForm.addEventListener('submit', this.handleAnswerFormSubmit);
        }
    }

    handleDocumentClick(event) {
        const createBtn = event.target.closest('.creat_ticket_btn');
        if (createBtn) {
            event.preventDefault();
            this.showCreateTicketModal();
            return;
        }
    }

    handleModalOutsideClick(event) {
        if (event.target === this.modalContainer) {
            this.hideCreateTicketModal();
        }
    }

    handleAnswerFormSubmit(event) {
        event.preventDefault();
        this.sendMessage();
    }

    renderTicketsList() {
        if (!this.ticketsListContainer) {
            return;
        }

        if (!this.tickets.length) {
            this.ticketsListContainer.innerHTML = `
                <div class="no-tickets-message">
                    <p>هنوز هیچ تیکتی ایجاد نکرده‌اید</p>
                    <button class="creat_ticket_btn">ایجاد اولین تیکت</button>
                </div>
            `;
            return;
        }

        this.ticketsListContainer.innerHTML = this.tickets.map(ticket => {
            const normalizedStatus = this.normalizeStatus(ticket.status);
            return `
            <div class="ticket_item ${this.getStatusClass(normalizedStatus)} ${this.selectedTicket && this.selectedTicket.id === ticket.id ? 'selected' : ''}"
                 data-ticket-id="${ticket.id}">
                <div class="ticket_title">${ticket.title}</div>
                <div class="ticket_status ${this.getStatusClass(normalizedStatus)}">${this.getStatusText(normalizedStatus)}</div>
                <div class="ticket_last_message">${this.getLastMessagePreview(ticket)}</div>
                <div class="ticket_add_date">${this.formatDate(ticket.created_at)}</div>
            </div>
            `;
        }).join('');

        this.addTicketItemListeners();
    }

    addTicketItemListeners() {
        if (!this.ticketsListContainer) {
            return;
        }

        this.ticketsListContainer.querySelectorAll('.ticket_item').forEach(item => {
            item.addEventListener('click', async () => {
                const ticketId = parseInt(item.dataset.ticketId, 10);
                await this.selectTicket(ticketId);
            });
        });
    }

    async selectTicket(ticketId) {
        try {
            if (this.ticketsListContainer) {
                this.ticketsListContainer.querySelectorAll('.ticket_item').forEach(item => {
                    item.classList.remove('selected');
                });

                const selectedItem = this.ticketsListContainer.querySelector(`[data-ticket-id="${ticketId}"]`);
                if (selectedItem) {
                    selectedItem.classList.add('selected');
                }
            }

            const response = await this.apiCall(`${this.baseURL}${ticketId}/`, 'GET');
            this.selectedTicket = response;

            this.showConversation();
            await this.loadTicketMessages(ticketId);
        } catch (error) {
            console.error('Error selecting ticket:', error);
            this.showError('خطا در بارگذاری اطلاعات تیکت');
        }
    }

    showConversation() {
        if (!this.conversationSection) {
            return;
        }

        this.conversationSection.classList.add('C-open');
        this.conversationSection.classList.remove('no-open');

        this.updateConversationHeader();
        this.renderMessages();
    }

    updateConversationHeader() {
        if (!this.selectedTicket) {
            this.resetConversation();
            return;
        }

        if (this.conversationTitle) {
            this.conversationTitle.textContent = this.selectedTicket.title || '-';
        }

        if (this.conversationStatus) {
            const normalizedStatus = this.normalizeStatus(this.selectedTicket.status);
            this.conversationStatus.textContent = this.getStatusText(normalizedStatus);
            this.conversationStatus.className = `conversation_ticket_status badge ${this.getStatusClass(normalizedStatus)}`;
        }

        if (this.conversationDate) {
            this.conversationDate.textContent = this.formatDateTime(this.selectedTicket.created_at);
        }
    }

    async loadTicketMessages(ticketId) {
        try {
            const response = await this.apiCall(`${this.baseURL}${ticketId}/messages/`, 'GET');
            if (this.selectedTicket) {
                this.selectedTicket.messages = Array.isArray(response) ? response : [];
                this.renderMessages();
            }
        } catch (error) {
            console.error('Error loading messages:', error);
            this.showError('خطا در بارگذاری پیام‌ها');
        }
    }

    renderMessages() {
        if (!this.messagesContainer) {
            return;
        }

        const messages = this.selectedTicket && Array.isArray(this.selectedTicket.messages)
            ? this.selectedTicket.messages
            : [];

        if (!messages.length) {
            this.messagesContainer.innerHTML = '<p class="no-messages">هنوز پیامی ارسال نشده است</p>';
            return;
        }

        const currentUserId = this.currentUser ? this.currentUser.id : null;

        this.messagesContainer.innerHTML = messages.map(message => `
            <div class="message ${message.user === currentUserId ? 'user_message' : 'support_message'}">
                <p>${message.message}</p>
                <span class="message-time">${this.formatTime(message.created_at)}</span>
            </div>
        `).join('');

        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    normalizeStatus(status) {
        return (status || '').toString().toLowerCase();
    }

    getStatusClass(status) {
        const statusMap = {
            'open': 'open',
            'pending': 'pending',
            'resolved': 'Resolved',
            'closed': 'Closed',
            'new': 'new'
        };
        return statusMap[status] || 'Closed';
    }

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

    getLastMessagePreview(ticket) {
        if (!ticket.messages || !ticket.messages.length) {
            return 'هنوز پیامی ارسال نشده است...';
        }

        const lastMessage = ticket.messages[ticket.messages.length - 1].message;
        return lastMessage.length > 50 ? `${lastMessage.substring(0, 50)}...` : lastMessage;
    }

    formatDate(dateString) {
        if (!dateString) {
            return '-';
        }

        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('fa-IR');
        } catch (error) {
            console.error('Date format error:', error);
            return dateString;
        }
    }

    formatDateTime(dateString) {
        if (!dateString) {
            return '-';
        }

        try {
            const date = new Date(dateString);
            const faDate = date.toLocaleDateString('fa-IR');
            const faTime = date.toLocaleTimeString('fa-IR', {
                hour: '2-digit',
                minute: '2-digit'
            });
            return `${faDate}، ${faTime}`;
        } catch (error) {
            console.error('DateTime format error:', error);
            return dateString;
        }
    }

    formatTime(dateString) {
        if (!dateString) {
            return '-';
        }

        try {
            const date = new Date(dateString);
            return date.toLocaleTimeString('fa-IR', {
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            console.error('Time format error:', error);
            return dateString;
        }
    }

    showCreateTicketModal() {
        if (!this.modalContainer || !this.modalContent) {
            return;
        }

        this.modalContainer.classList.remove('hidden');

        this.modalContent.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>ایجاد تیکت جدید</h3>
                    <button type="button" class="close-modal">&times;</button>
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

        const form = this.modalContent.querySelector('#createTicketForm');
        const closeBtn = this.modalContent.querySelector('.close-modal');
        const cancelBtn = this.modalContent.querySelector('.cancel-btn');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideCreateTicketModal());
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hideCreateTicketModal());
        }

        if (form) {
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                await this.createNewTicket(form);
            });
        }
    }

    hideCreateTicketModal() {
        if (this.modalContainer) {
            this.modalContainer.classList.add('hidden');
        }

        if (this.modalContent) {
            this.modalContent.innerHTML = '';
        }
    }

    async createNewTicket(formElement) {
        try {
            const formData = new FormData(formElement);
            const title = formData.get('title') ? formData.get('title').toString().trim() : '';
            const message = formData.get('message') ? formData.get('message').toString().trim() : '';

            if (!title) {
                this.showError('عنوان تیکت را وارد کنید');
                return;
            }

            if (!message) {
                this.showError('متن پیام را وارد کنید');
                return;
            }

            const ticketResponse = await this.apiCall(this.baseURL, 'POST', { title });

            if (!ticketResponse || !ticketResponse.id) {
                throw new Error('Invalid ticket response');
            }

            await this.apiCall(`${this.baseURL}${ticketResponse.id}/messages/`, 'POST', {
                ticket: ticketResponse.id,
                message: message
            });

            this.hideCreateTicketModal();
            await this.loadTickets();
            await this.selectTicket(ticketResponse.id);
            this.showSuccess('تیکت با موفقیت ایجاد شد');
        } catch (error) {
            console.error('Error creating ticket:', error);
            this.showError('خطا در ایجاد تیکت');
        }
    }

    async sendMessage() {
        if (!this.selectedTicket) {
            this.showError('لطفاً ابتدا یک تیکت انتخاب کنید');
            return;
        }

        const messageInput = document.querySelector('#resporn');
        if (!messageInput) {
            return;
        }

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

            messageInput.value = '';
            await this.loadTicketMessages(this.selectedTicket.id);
        } catch (error) {
            console.error('Error sending message:', error);
            this.showError('خطا در ارسال پیام');
        }
    }

    async apiCall(url, method = 'GET', data = null) {
        const token = this.getAuthToken();
        const headers = {
            'Accept': 'application/json'
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            method,
            headers
        };

        const upperMethod = method.toUpperCase();
        if (data && ['POST', 'PUT', 'PATCH'].includes(upperMethod)) {
            headers['Content-Type'] = 'application/json';
            config.body = JSON.stringify(data);
        }

        const response = await fetch(url, config);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (response.status === 204) {
            return null;
        }

        return await response.json();
    }

    resetConversation() {
        if (!this.conversationSection) {
            return;
        }

        this.conversationSection.classList.remove('C-open');
        this.conversationSection.classList.add('no-open');

        if (this.conversationTitle) {
            this.conversationTitle.textContent = 'یک تیکت را انتخاب کنید';
        }

        if (this.conversationStatus) {
            this.conversationStatus.textContent = '-';
            this.conversationStatus.className = 'conversation_ticket_status badge';
        }

        if (this.conversationDate) {
            this.conversationDate.textContent = '-';
        }

        if (this.messagesContainer) {
            this.messagesContainer.innerHTML = '<p class="no-messages">برای مشاهده گفتگو، یکی از تیکت‌های خود را انتخاب کنید.</p>';
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

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

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// مقداردهی اولیه وقتی DOM لود شد
document.addEventListener('DOMContentLoaded', () => {
    new UserTickets();
});
