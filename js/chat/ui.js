// مدیریت تمام تغییرات رابط کاربری در صفحه گفتگو
import { openChat, deleteConversationHandler } from './chat.js';

let editMessageHandler;
let deleteMessageHandler;
let loggedInUser = null;
let activeConversationId = null;
let modalConfirmHandler = null;
let toastTimeoutId;

const contactsList = document.getElementById('chat-contact-list');
const contactsEmptyState = document.getElementById('contacts-empty-state');
const messagesContainer = document.getElementById('messages-container');
const chatEmptyState = document.getElementById('chat-empty-state');
const selectedContactName = document.getElementById('selected-contact-name');
const selectedContactStatus = document.getElementById('selected-contact-status');
const selectedContactAvatar = document
    .getElementById('selected-contact-avatar')
    ?.querySelector('img');
const chatContainer = document.querySelector('.chat-layout');
const typingIndicator = document.getElementById('typing-indicator');
const currentUsername = document.getElementById('current-username');
const toastElement = document.getElementById('chat-toast');

const modalElement = document.getElementById('chat-modal');
const modalForm = document.getElementById('chat-modal-form');
const modalContent = document.getElementById('chat-modal-content');
const modalTitle = document.getElementById('chat-modal-title');
const modalDescription = document.getElementById('chat-modal-description');
const modalConfirmButton = modalForm?.querySelector('[data-modal-confirm]');
const modalCancelButton = modalForm?.querySelector('[data-modal-cancel]');
const modalDismissTriggers = modalElement?.querySelectorAll('[data-modal-dismiss]');

const CONFIRM_VARIANTS = {
    primary: 'btn--primary',
    danger: 'btn--danger',
    ghost: 'btn--ghost',
};

function resetConfirmVariants() {
    if (!modalConfirmButton) return;
    Object.values(CONFIRM_VARIANTS).forEach(cls => modalConfirmButton.classList.remove(cls));
}

function setConfirmVariant(variant = 'primary') {
    resetConfirmVariants();
    modalConfirmButton?.classList.add(CONFIRM_VARIANTS[variant] || CONFIRM_VARIANTS.primary);
}

export function registerMessageHandlers(editHandler, deleteHandler) {
    editMessageHandler = editHandler;
    deleteMessageHandler = deleteHandler;
}

export function setCurrentUser(user) {
    loggedInUser = user;
    if (currentUsername && user?.username) {
        currentUsername.textContent = user.username;
    }
}

function renderContact(conversation) {
    if (!contactsList) return;

    const participant = conversation.participants?.find(
        participantItem => participantItem.id !== loggedInUser?.id
    ) || conversation.participants?.[0];

    const contactButton = document.createElement('button');
    contactButton.type = 'button';
    contactButton.className = 'chat-contact';
    contactButton.dataset.id = conversation.id;

    if (conversation.id === activeConversationId) {
        contactButton.classList.add('chat-contact--active');
    }

    const avatar = document.createElement('figure');
    avatar.className = 'chat-avatar chat-avatar--md';
    const avatarImg = document.createElement('img');
    avatarImg.alt = participant?.username ? `نمایه ${participant.username}` : 'نمایه مخاطب';
    avatarImg.src = participant?.profile_picture || '/img/icons/profile.svg';
    avatar.appendChild(avatarImg);

    const body = document.createElement('div');
    body.className = 'chat-contact__body';

    const name = document.createElement('span');
    name.className = 'chat-contact__name';
    name.textContent = participant?.username || 'کاربر ناشناس';

    const preview = document.createElement('div');
    preview.className = 'chat-contact__preview';

    const lastMessage = document.createElement('span');
    lastMessage.textContent = conversation.last_message || 'بدون پیام';

    const metaTime = document.createElement('time');
    metaTime.dateTime = conversation.last_message_time || '';
    metaTime.textContent = formatRelativeTime(conversation.last_message_time);

    preview.appendChild(lastMessage);
    if (metaTime.textContent) {
        preview.appendChild(metaTime);
    }

    body.appendChild(name);
    body.appendChild(preview);

    const actions = document.createElement('div');
    actions.className = 'chat-contact__actions';

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'icon-button icon-button--sm icon-button--muted';
    deleteButton.innerHTML = '<img src="/img/icons/delete.svg" alt="حذف">';
    deleteButton.addEventListener('click', event => {
        event.stopPropagation();
        openDeleteConversationModal(() => deleteConversationHandler(conversation.id));
    });

    actions.appendChild(deleteButton);

    contactButton.appendChild(avatar);
    contactButton.appendChild(body);
    contactButton.appendChild(actions);

    contactButton.addEventListener('click', () => openChat(conversation.id));

    contactsList.appendChild(contactButton);
}

export function renderConversations(conversations = [], currentUser, selectedConversationId = null) {
    if (!contactsList) return;

    loggedInUser = currentUser || loggedInUser;
    activeConversationId = selectedConversationId ?? activeConversationId;

    contactsList.innerHTML = '';

    if (!conversations.length) {
        contactsList.hidden = true;
        if (contactsEmptyState) contactsEmptyState.hidden = false;
        return;
    }

    contactsList.hidden = false;
    if (contactsEmptyState) contactsEmptyState.hidden = true;

    conversations.forEach(conversation => renderContact(conversation));
}

function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';

    return new Intl.DateTimeFormat('fa-IR', {
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

function formatRelativeTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';

    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'همین حالا';
    if (minutes < 60) return `${minutes} دقیقه پیش`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ساعت پیش`;

    return new Intl.DateTimeFormat('fa-IR', {
        month: 'short',
        day: 'numeric'
    }).format(date);
}

function createMessageElement(message, user) {
    const isSent = message.sender?.id === user?.id;

    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${isSent ? 'chat-message--sent' : 'chat-message--received'}`;
    messageElement.dataset.messageId = message.id;

    const content = document.createElement('div');
    content.className = 'chat-message__text';
    content.textContent = message.content;
    messageElement.appendChild(content);

    if (message.attachments?.length) {
        const attachments = document.createElement('div');
        attachments.className = 'chat-message__attachments';
        message.attachments.forEach(attachment => {
            const link = document.createElement('a');
            link.href = attachment.file;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.className = 'chat-attachment';
            link.textContent = attachment.name || 'دانلود فایل';
            attachments.appendChild(link);
        });
        messageElement.appendChild(attachments);
    }

    const meta = document.createElement('div');
    meta.className = 'chat-message__meta';
    meta.textContent = formatTimestamp(message.timestamp);
    messageElement.appendChild(meta);

    if (isSent) {
        const actions = document.createElement('div');
        actions.className = 'chat-message__actions';

        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.textContent = 'ویرایش';
        editButton.addEventListener('click', () => openEditMessageModal(message.content, newContent => {
            editMessageHandler?.(message.id, newContent);
        }));

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.textContent = 'حذف';
        deleteButton.addEventListener('click', () => openDeleteMessageModal(() => {
            deleteMessageHandler?.(message.id);
        }));

        actions.appendChild(editButton);
        actions.appendChild(deleteButton);
        messageElement.appendChild(actions);
    }

    return messageElement;
}

export function renderMessages(messages = [], append = false, user = loggedInUser) {
    if (!messagesContainer) return;

    if (!append) {
        messagesContainer.innerHTML = '';
    }

    if (!messages.length) {
        if (!append && messagesContainer.childElementCount === 0) {
            showChatPlaceholder(true);
        }
        return;
    }

    showChatPlaceholder(false);

    messages.forEach(message => {
        const messageElement = createMessageElement(message, user);
        messagesContainer.appendChild(messageElement);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

export function updateSelectedContact(conversation, user = loggedInUser) {
    if (!conversation) return;

    loggedInUser = user;
    activeConversationId = conversation.id;

    const participant = conversation.participants?.find(
        item => item.id !== user?.id
    ) || conversation.participants?.[0];

    if (selectedContactName) {
        selectedContactName.textContent = participant?.username || 'بدون نام';
    }

    if (selectedContactStatus) {
        selectedContactStatus.textContent = conversation.last_message_time
            ? `آخرین پیام ${formatRelativeTime(conversation.last_message_time)}`
            : 'شروع گفتگو';
    }

    if (selectedContactAvatar) {
        selectedContactAvatar.src = participant?.profile_picture || '/img/icons/profile.svg';
    }

    highlightActiveConversation(conversation.id);
    showChatPlaceholder(false);
}

export function highlightActiveConversation(conversationId) {
    activeConversationId = conversationId;
    if (!contactsList) return;

    contactsList.querySelectorAll('.chat-contact').forEach(contact => {
        contact.classList.toggle('chat-contact--active', contact.dataset.id === String(conversationId));
    });
}

export function clearChatWindow() {
    if (messagesContainer) {
        messagesContainer.innerHTML = '';
    }
    if (selectedContactName) {
        selectedContactName.textContent = 'یک گفتگو انتخاب کنید';
    }
    if (selectedContactStatus) {
        selectedContactStatus.textContent = 'در انتظار انتخاب گفتگو';
    }
    if (selectedContactAvatar) {
        selectedContactAvatar.src = '/img/icons/profile.svg';
    }
    showChatPlaceholder(true);
}

export function handleNewMessage(message) {
    renderMessages([message], true);
    hideTypingIndicator();
}

export function handleEditedMessage(message) {
    if (!messagesContainer) return;
    const messageElement = messagesContainer.querySelector(`[data-message-id="${message.id}"]`);
    if (messageElement) {
        const content = messageElement.querySelector('.chat-message__text');
        if (content) {
            content.textContent = `${message.content} (ویرایش شده)`;
        }
    }
}

export function handleDeletedMessage(messageId) {
    if (!messagesContainer) return;
    const messageElement = messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
        messageElement.remove();
    }

    if (!messagesContainer.childElementCount) {
        showChatPlaceholder(true);
    }
}

export function handleTypingIndicator(username, isTyping) {
    if (!typingIndicator) return;
    if (isTyping) {
        typingIndicator.hidden = false;
        typingIndicator.textContent = `${username || 'کاربر'} در حال نوشتن`;
    } else {
        hideTypingIndicator();
    }
}

function hideTypingIndicator() {
    if (!typingIndicator) return;
    typingIndicator.hidden = true;
    typingIndicator.textContent = '';
}

export function toggleMobileChatView(show) {
    if (!chatContainer) return;
    if (window.innerWidth <= 1000) {
        chatContainer.classList.toggle('mobile-chat-open', show);
    }
}

function showChatPlaceholder(show) {
    if (!chatEmptyState) return;
    chatEmptyState.hidden = !show;
    if (messagesContainer) {
        messagesContainer.style.display = show ? 'none' : 'flex';
    }
}

function openModalBase({
    title,
    description,
    confirmLabel = 'تایید',
    cancelLabel = 'انصراف',
    confirmVariant = 'primary',
    onConfirm,
}) {
    if (!modalElement || !modalForm || !modalConfirmButton || !modalCancelButton) return;

    modalTitle.textContent = title || '';
    modalDescription.textContent = description || '';
    if (modalDescription) {
        modalDescription.hidden = !description;
    }
    modalConfirmButton.textContent = confirmLabel;
    modalCancelButton.textContent = cancelLabel;
    setConfirmVariant(confirmVariant);

    modalElement.hidden = false;
    modalConfirmHandler = onConfirm;
}

export function closeModal() {
    if (!modalElement || !modalForm) return;
    modalElement.hidden = true;
    modalForm.reset();
    modalContent.innerHTML = '';
    modalTitle.textContent = '';
    modalDescription.textContent = '';
    if (modalDescription) {
        modalDescription.hidden = true;
    }
    modalConfirmHandler = null;
    resetConfirmVariants();
}

export function openFormModal({ title, description, fields = [], confirmLabel, cancelLabel, confirmVariant, onSubmit }) {
    if (!modalContent) return;

    modalContent.innerHTML = '';

    fields.forEach(field => {
        const wrapper = document.createElement('div');
        wrapper.className = 'chat-modal__field';

        if (field.label) {
            const label = document.createElement('label');
            label.htmlFor = field.name;
            label.textContent = field.label;
            wrapper.appendChild(label);
        }

        const inputElement = field.type === 'textarea'
            ? document.createElement('textarea')
            : document.createElement('input');

        inputElement.id = field.name;
        inputElement.name = field.name;
        inputElement.required = Boolean(field.required);
        inputElement.placeholder = field.placeholder || '';
        if (field.type !== 'textarea') {
            inputElement.type = field.type || 'text';
        }
        if (field.type === 'number' && typeof field.min !== 'undefined') {
            inputElement.min = field.min;
        }
        if (field.value) {
            inputElement.value = field.value;
        }
        if (field.type === 'textarea' && field.value) {
            inputElement.value = field.value;
        }
        if (field.rows) {
            inputElement.rows = field.rows;
        }

        wrapper.appendChild(inputElement);
        modalContent.appendChild(wrapper);
    });

    openModalBase({
        title,
        description,
        confirmLabel,
        cancelLabel,
        confirmVariant,
        onConfirm: formData => {
            if (!onSubmit) return;
            const values = Object.fromEntries(formData.entries());
            return onSubmit(values);
        },
    });

    const firstField = modalContent.querySelector('input, textarea');
    if (firstField) {
        setTimeout(() => firstField.focus(), 50);
    }
}

export function openConfirmModal({ title, description, confirmLabel, cancelLabel, confirmVariant = 'danger', onConfirm }) {
    if (!modalContent) return;
    modalContent.innerHTML = '';
    const message = document.createElement('p');
    message.textContent = description;
    modalContent.appendChild(message);

    openModalBase({
        title,
        description: '',
        confirmLabel,
        cancelLabel,
        confirmVariant,
        onConfirm: () => onConfirm?.(),
    });
}

export function openCreateConversationModal(onSubmit) {
    openFormModal({
        title: 'شروع گفتگوی جدید',
        description: 'شناسه کاربری مخاطب مورد نظر را وارد کنید.',
        confirmLabel: 'ایجاد گفتگو',
        confirmVariant: 'primary',
        fields: [
            {
                type: 'number',
                name: 'participantId',
                label: 'شناسه کاربر',
                placeholder: 'مثلاً 1024',
                required: true,
                min: 1,
            },
        ],
        onSubmit: values => {
            const id = Number(values.participantId);
            if (!id || Number.isNaN(id) || id < 1) {
                showToast('شناسه کاربر معتبر نیست.', 'error');
                return false;
            }
            return onSubmit?.(id);
        },
    });
}

export function openEditMessageModal(defaultValue, onSubmit) {
    openFormModal({
        title: 'ویرایش پیام',
        description: 'متن جدید پیام را وارد کنید.',
        confirmLabel: 'ذخیره تغییرات',
        confirmVariant: 'primary',
        fields: [
            {
                type: 'textarea',
                name: 'content',
                label: 'متن پیام',
                rows: 4,
                required: true,
                value: defaultValue,
            },
        ],
        onSubmit: values => {
            const content = values.content?.trim();
            if (!content) {
                showToast('متن پیام نمی‌تواند خالی باشد.', 'error');
                return false;
            }
            return onSubmit?.(content);
        },
    });
}

export function openDeleteConversationModal(onConfirm) {
    openConfirmModal({
        title: 'حذف گفتگو',
        description: 'آیا از حذف این گفتگو اطمینان دارید؟ با حذف گفتگو تمام پیام‌ها نیز پاک می‌شوند.',
        confirmLabel: 'حذف گفتگو',
        confirmVariant: 'danger',
        onConfirm,
    });
}

export function openDeleteMessageModal(onConfirm) {
    openConfirmModal({
        title: 'حذف پیام',
        description: 'این پیام برای همیشه حذف می‌شود. ادامه می‌دهید؟',
        confirmLabel: 'حذف پیام',
        confirmVariant: 'danger',
        onConfirm,
    });
}

export function showToast(message, type = 'info') {
    if (!toastElement) return;
    toastElement.textContent = message;
    toastElement.classList.remove('chat-toast--error', 'chat-toast--success');

    if (type === 'error') {
        toastElement.classList.add('chat-toast--error');
    } else if (type === 'success') {
        toastElement.classList.add('chat-toast--success');
    }

    toastElement.hidden = false;

    clearTimeout(toastTimeoutId);
    toastTimeoutId = window.setTimeout(() => {
        toastElement.hidden = true;
        toastElement.classList.remove('chat-toast--error', 'chat-toast--success');
    }, 4000);
}

if (modalForm) {
    modalForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (!modalConfirmHandler) {
            closeModal();
            return;
        }

        const formData = new FormData(modalForm);
        const result = await modalConfirmHandler(formData);
        if (result !== false) {
            closeModal();
        }
    });
}

modalCancelButton?.addEventListener('click', () => closeModal());
modalDismissTriggers?.forEach(trigger => trigger.addEventListener('click', () => closeModal()));

document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modalElement?.hidden) {
        closeModal();
    }
});

export { showChatPlaceholder };
