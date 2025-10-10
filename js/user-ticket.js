// user-ticket.js

class UserTickets {
    constructor() {
        this.tickets = [];
        this.selectedTicket = null;
        this.currentUser = null;
        const apiBaseMeta = document.querySelector('meta[name="api-base-url"]');
        this.apiBaseUrl = apiBaseMeta ? apiBaseMeta.content : '';
        this.ticketsEndpoint = '/api/support/tickets/';
        this.userEndpoint = '/api/auth/users/me/';

        this.ticketsListContainer = document.querySelector('.tickets_lists_container');
        this.modalContainer = document.querySelector('.creat_ticket_modal_container');
        this.modalContent = document.querySelector('.creat_ticket_modal');
        this.conversationSection = document.querySelector('.tickets_conversation');
        this.conversationTitle = document.querySelector('.conversation_ticket_title');
        this.conversationStatus = document.querySelector('.conversation_ticket_status');
        this.conversationCode = document.querySelector('.conversation_ticket_code');
        this.conversationDate = document.querySelector('.conversation_ticket_date');
        this.messagesContainer = document.querySelector('.show_message');
        this.answerForm = document.querySelector('.answer_form form');
        this.answerNotice = this.answerForm ? this.answerForm.querySelector('.answer_notice') : null;
        this.answerTextarea = this.answerForm ? this.answerForm.querySelector('#resporn') : null;
        this.sendButton = this.answerForm ? this.answerForm.querySelector('.send_button') : null;
        this.fileInput = this.answerForm ? this.answerForm.querySelector('#file') : null;

        this.handleDocumentClick = this.handleDocumentClick.bind(this);
        this.handleModalOutsideClick = this.handleModalOutsideClick.bind(this);
        this.handleAnswerFormSubmit = this.handleAnswerFormSubmit.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);

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
            const user = await this.apiCall(this.userEndpoint, 'GET');
            if (user && user.id) {
                this.currentUser = user;
            } else {
                this.currentUser = { id: null };
            }
        } catch (error) {
            if (this.handleUnauthorized(error)) {
                throw error;
            }

            console.error('Authentication error:', error);
            this.currentUser = { id: null };
            this.showError('خطا در دریافت اطلاعات کاربر');
        }
    }

    async loadTickets() {
        const previousSelectedId = this.selectedTicket ? this.selectedTicket.id : null;

        try {
            const response = await this.apiCall(this.ticketsEndpoint, 'GET');
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
            if (this.handleUnauthorized(error)) {
                return;
            }

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
            const statusClass = this.getStatusClass(normalizedStatus);
            const isSelected = this.selectedTicket && this.selectedTicket.id === ticket.id;
            return `
            <div class="ticket_item ${statusClass} ${isSelected ? 'selected' : ''}" role="listitem" data-ticket-id="${ticket.id}">
                <div class="ticket_title" title="${this.escapeHtml(ticket.title || '')}">${this.escapeHtml(ticket.title || 'بدون عنوان')}</div>
                <div class="ticket_status ${statusClass}">${this.getStatusText(normalizedStatus)}</div>
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

            const response = await this.apiCall(`${this.ticketsEndpoint}${ticketId}/`, 'GET');
            this.selectedTicket = response;

            this.showConversation();
            await this.loadTicketMessages(ticketId);
        } catch (error) {
            if (this.handleUnauthorized(error)) {
                return;
            }

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

        if (this.conversationCode) {
            const ticketCode = this.selectedTicket.ticket_number || this.selectedTicket.reference_code || `شناسه: #${this.selectedTicket.id}`;
            this.conversationCode.textContent = typeof ticketCode === 'string' && ticketCode.includes('شناسه')
                ? ticketCode
                : `شناسه: ${ticketCode}`;
        }

        if (this.conversationDate) {
            this.conversationDate.textContent = this.formatDateTime(this.selectedTicket.created_at);
        }

        this.setAnswerFormAvailability();
    }

    async loadTicketMessages(ticketId) {
        try {
            const response = await this.apiCall(`${this.ticketsEndpoint}${ticketId}/messages/`, 'GET');
            if (this.selectedTicket) {
                this.selectedTicket.messages = Array.isArray(response) ? response : [];
                this.renderMessages();
            }
        } catch (error) {
            if (this.handleUnauthorized(error)) {
                return;
            }

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
            this.messagesContainer.dataset.empty = 'true';
            this.messagesContainer.innerHTML = '<p class="no-messages">هنوز پیامی ارسال نشده است</p>';
            return;
        }

        this.messagesContainer.dataset.empty = 'false';
        const currentUserId = this.currentUser ? this.currentUser.id : null;

        this.messagesContainer.innerHTML = messages.map(message => `
            <div class="message ${message.user === currentUserId ? 'user_message' : 'support_message'}">
                <p>${this.formatMessageBody(message.message)}</p>
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

        const lastMessage = ticket.messages[ticket.messages.length - 1].message || '';
        const preview = lastMessage.length > 50 ? `${lastMessage.substring(0, 50)}...` : lastMessage;
        return this.escapeHtml(preview);
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
        document.body.classList.add('modal-open');
        document.addEventListener('keydown', this.handleKeyDown);

        this.modalContent.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="createTicketTitle">ایجاد تیکت جدید</h3>
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
        const titleInput = this.modalContent.querySelector('#ticketTitle');

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

        if (titleInput) {
            setTimeout(() => titleInput.focus(), 0);
        }
    }

    hideCreateTicketModal() {
        if (this.modalContainer) {
            this.modalContainer.classList.add('hidden');
        }

        if (this.modalContent) {
            this.modalContent.innerHTML = '';
        }

        document.body.classList.remove('modal-open');
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    async createNewTicket(formElement) {
        this.setFormSubmitting(formElement, true);
        try {
            const formData = new FormData(formElement);
            const title = formData.get('title') ? formData.get('title').toString().trim() : '';
            const message = formData.get('message') ? formData.get('message').toString().trim() : '';

            if (!title) {
                this.showError('عنوان تیکت را وارد کنید');
                this.setFormSubmitting(formElement, false);
                return;
            }

            if (!message) {
                this.showError('متن پیام را وارد کنید');
                this.setFormSubmitting(formElement, false);
                return;
            }

            const ticketResponse = await this.apiCall(this.ticketsEndpoint, 'POST', { title });

            if (!ticketResponse || !ticketResponse.id) {
                throw new Error('Invalid ticket response');
            }

            await this.apiCall(`${this.ticketsEndpoint}${ticketResponse.id}/messages/`, 'POST', {
                ticket: ticketResponse.id,
                message: message
            });

            this.hideCreateTicketModal();
            await this.loadTickets();
            await this.selectTicket(ticketResponse.id);
            this.showSuccess('تیکت با موفقیت ایجاد شد');
        } catch (error) {
            if (this.handleUnauthorized(error)) {
                return;
            }

            console.error('Error creating ticket:', error);
            this.showError('خطا در ایجاد تیکت');
        } finally {
            this.setFormSubmitting(formElement, false);
        }
    }

    async sendMessage() {
        if (!this.selectedTicket) {
            this.showError('لطفاً ابتدا یک تیکت انتخاب کنید');
            return;
        }

        if (!this.answerTextarea) {
            return;
        }

        const message = this.answerTextarea.value.trim();
        if (!message) {
            this.showError('لطفاً پیام خود را وارد کنید');
            return;
        }

        try {
            if (this.sendButton) {
                this.sendButton.disabled = true;
            }

            await this.apiCall(`${this.ticketsEndpoint}${this.selectedTicket.id}/messages/`, 'POST', {
                ticket: this.selectedTicket.id,
                message: message
            });

            this.answerTextarea.value = '';
            await this.loadTicketMessages(this.selectedTicket.id);
            await this.loadTickets();
        } catch (error) {
            if (this.handleUnauthorized(error)) {
                return;
            }

            console.error('Error sending message:', error);
            this.showError('خطا در ارسال پیام');
        } finally {
            if (this.sendButton) {
                this.sendButton.disabled = false;
            }
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

        const finalUrl = this.buildApiUrl(url);
        const response = await fetch(finalUrl, config);

        if (!response.ok) {
            let errorDetail = null;
            const error = new Error(`HTTP error! status: ${response.status}`);
            error.status = response.status;

            try {
                const contentType = response.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    errorDetail = await response.json();
                } else {
                    errorDetail = await response.text();
                }
            } catch (parseError) {
                errorDetail = null;
            }

            if (errorDetail) {
                error.detail = errorDetail;
            }

            throw error;
        }

        if (response.status === 204) {
            return null;
        }

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            return await response.json();
        }

        return await response.text();
    }

    buildApiUrl(url) {
        if (!url) {
            return '';
        }

        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }

        const base = (this.apiBaseUrl || '').replace(/\/$/, '');
        const path = url.startsWith('/') ? url : `/${url}`;
        return base ? `${base}${path}` : path;
    }

    clearAuthTokens() {
        try {
            localStorage.removeItem('access_token');
            localStorage.removeItem('token');
        } catch (error) {
            console.error('Error clearing auth tokens:', error);
        }
    }

    handleUnauthorized(error) {
        if (error && error.status === 401) {
            this.clearAuthTokens();
            this.redirectToLogin();
            return true;
        }
        return false;
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

        if (this.conversationCode) {
            this.conversationCode.textContent = 'شناسه: -';
        }

        if (this.conversationDate) {
            this.conversationDate.textContent = '-';
        }

        if (this.messagesContainer) {
            this.messagesContainer.innerHTML = '<p class="no-messages">برای مشاهده گفتگو، یکی از تیکت‌های خود را انتخاب کنید.</p>';
            this.messagesContainer.dataset.empty = 'true';
        }

        this.setAnswerFormAvailability();
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

    setFormSubmitting(formElement, isSubmitting) {
        if (!formElement) {
            return;
        }

        const submitButton = formElement.querySelector('[type="submit"]');
        if (submitButton) {
            submitButton.disabled = isSubmitting;
        }
    }

    setAnswerFormAvailability() {
        if (!this.answerForm) {
            return;
        }

        const normalizedStatus = this.normalizeStatus(this.selectedTicket ? this.selectedTicket.status : null);
        const isLocked = !this.selectedTicket || this.isTicketLocked(normalizedStatus);

        const formWrapper = this.answerForm.parentElement;
        if (formWrapper) {
            formWrapper.classList.toggle('disabled', isLocked);
        }

        if (this.answerTextarea) {
            this.answerTextarea.disabled = isLocked;
        }

        if (this.sendButton) {
            this.sendButton.disabled = isLocked;
        }

        if (this.answerNotice) {
            this.answerNotice.hidden = !isLocked || !this.selectedTicket;
        }
    }

    isTicketLocked(status) {
        return ['closed', 'resolved'].includes(status);
    }

    formatMessageBody(message) {
        if (!message) {
            return '';
        }
        return this.escapeHtml(message).replace(/\n/g, '<br>');
    }

    escapeHtml(text) {
        if (typeof text !== 'string') {
            return '';
        }
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return text.replace(/[&<>"']/g, (char) => map[char] || char);
    }

    handleKeyDown(event) {
        if (event.key === 'Escape') {
            this.hideCreateTicketModal();
        }
    }
}

// مقداردهی اولیه وقتی DOM لود شد
document.addEventListener('DOMContentLoaded', () => {
    new UserTickets();
});
