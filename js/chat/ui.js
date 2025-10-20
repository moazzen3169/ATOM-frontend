// This module will handle all DOM manipulation and UI updates.
import { openChat, deleteConversationHandler, updateConversationCache } from './chat.js';

let editMessageHandler;
let deleteMessageHandler;
let currentUserRef = null;

export function registerMessageHandlers(editHandler, deleteHandler) {
    editMessageHandler = editHandler;
    deleteMessageHandler = deleteHandler;
}

export function setCurrentUser(user) {
    currentUserRef = user || null;
}

function getCurrentUser() {
    return currentUserRef;
}

// --- DOM ELEMENTS ---
const contactsList = document.querySelector('.contact_list');
const messagesContainer = document.querySelector('.messages_container');
const selectedContactName = document.querySelector('.selected_contact .contact_username');
const selectedContactMeta = document.querySelector('.selected_contact .contact_meta');
const selectedContactAvatar = document.querySelector('.selected_contact .contact_profile img');
const chatContainer = document.querySelector('.chat_container');
const emptyStateTemplate = `
    <div class="chat_empty_state">
        <p>گفتگویی یافت نشد.</p>
    </div>
`;

const editIconSvg = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" />
        <path d="M20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </svg>
`;

const deleteIconSvg = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 3a2 2 0 00-2 2H4a1 1 0 100 2h16a1 1 0 100-2h-3a2 2 0 00-2-2H9zm-3 6v9a3 3 0 003 3h6a3 3 0 003-3V9H6zm5 3a1 1 0 112 0v5a1 1 0 11-2 0v-5z" />
    </svg>
`;

const IMAGE_EXTENSION_PATTERN = /\.(?:gif|jpe?g|png|webp|bmp|svg)$/i;
const VIDEO_EXTENSION_PATTERN = /\.(?:mp4|webm|ogg|ogv|mov|m4v)$/i;

function getAttachmentUrl(attachment) {
    if (!attachment) {
        return '';
    }

    const candidates = [
        attachment.file,
        attachment.url,
        attachment.attachment,
        attachment.path,
        attachment.location,
        attachment.source,
        attachment.download_url,
        attachment.downloadUrl,
    ];

    for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        if (typeof candidate === 'string' && candidate.trim()) {
            return candidate;
        }
    }

    return '';
}

function getAttachmentName(attachment, index = 0) {
    if (!attachment) {
        return `پیوست ${index + 1}`;
    }

    const candidates = [
        attachment.name,
        attachment.original_name,
        attachment.originalName,
        attachment.filename,
        attachment.file_name,
        attachment.title,
        attachment.label,
    ];

    for (let idx = 0; idx < candidates.length; idx += 1) {
        const candidate = candidates[idx];
        if (typeof candidate === 'string' && candidate.trim()) {
            return candidate.trim();
        }
    }

    const url = getAttachmentUrl(attachment);
    if (url) {
        const parts = url.split('/').filter(Boolean);
        if (parts.length > 0) {
            return parts[parts.length - 1];
        }
    }

    return `پیوست ${index + 1}`;
}

function getAttachmentContentType(attachment) {
    if (!attachment || typeof attachment !== 'object') {
        return '';
    }

    const rawType =
        attachment.content_type ?? attachment.mime_type ?? attachment.mimeType ?? attachment.type ?? '';
    return typeof rawType === 'string' ? rawType.toLowerCase() : '';
}

function detectAttachmentKind(attachment) {
    const type = getAttachmentContentType(attachment);
    if (type.startsWith('image/')) {
        return 'image';
    }
    if (type.startsWith('video/')) {
        return 'video';
    }

    const url = getAttachmentUrl(attachment).toLowerCase();
    if (url) {
        if (IMAGE_EXTENSION_PATTERN.test(url)) {
            return 'image';
        }
        if (VIDEO_EXTENSION_PATTERN.test(url)) {
            return 'video';
        }
    }

    return 'file';
}

function createMessageAttachmentElement(attachment, index) {
    const url = getAttachmentUrl(attachment);
    if (!url) {
        return null;
    }

    const label = getAttachmentName(attachment, index);
    const kind = detectAttachmentKind(attachment);

    if (kind === 'image') {
        const figure = document.createElement('figure');
        figure.classList.add('attachment-item', 'attachment-item--image');

        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener';

        const img = document.createElement('img');
        img.src = url;
        img.alt = label || 'پیوست تصویری';
        img.loading = 'lazy';

        link.appendChild(img);
        figure.appendChild(link);

        if (label) {
            const caption = document.createElement('figcaption');
            caption.textContent = label;
            figure.appendChild(caption);
        }

        return figure;
    }

    if (kind === 'video') {
        const figure = document.createElement('figure');
        figure.classList.add('attachment-item', 'attachment-item--video');

        const video = document.createElement('video');
        video.src = url;
        video.controls = true;
        video.preload = 'metadata';
        video.setAttribute('playsinline', '');
        video.setAttribute('aria-label', label || 'پیوست ویدیویی');

        figure.appendChild(video);

        if (label) {
            const caption = document.createElement('figcaption');
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener';
            link.textContent = label;
            caption.appendChild(link);
            figure.appendChild(caption);
        }

        return figure;
    }

    const item = document.createElement('div');
    item.classList.add('attachment-item', 'attachment-item--file');

    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';

    const icon = document.createElement('span');
    icon.classList.add('attachment-item__icon');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '📎';
    link.appendChild(icon);

    const nameEl = document.createElement('span');
    nameEl.textContent = label || 'پیوست';
    link.appendChild(nameEl);

    item.appendChild(link);
    return item;
}

function setElementText(el, value) {
    if (!el) {
        return;
    }
    el.textContent = value;
}

function getParticipant(conversation, currentUser = getCurrentUser()) {
    return conversation?.participants?.find((p) => p.id !== currentUser?.id) || conversation?.participants?.[0] || null;
}

function getLastMessagePreview(conversation) {
    const { last_message: lastMessage } = conversation || {};

    if (!lastMessage) {
        return '';
    }

    if (typeof lastMessage === 'string') {
        return lastMessage;
    }

    if (typeof lastMessage === 'object') {
        if (lastMessage.is_deleted) {
            return 'این پیام حذف شده است.';
        }
        return lastMessage.content || '';
    }

    return '';
}

function formatTimestamp(timestamp) {
    if (!timestamp) {
        return '';
    }

    try {
        return new Date(timestamp).toLocaleTimeString();
    } catch (_error) {
        return '';
    }
}

function setMessageMetadata(messageEl, message = {}) {
    if (!messageEl) {
        return;
    }

    const messageId = message.id ?? message.pk;
    if (messageId !== undefined && messageId !== null) {
        messageEl.dataset.messageId = String(messageId);
    }

    messageEl.dataset.messageContent = message.content || '';
    messageEl.dataset.messageDeleted = message.is_deleted ? 'true' : 'false';
    messageEl.dataset.messageEdited = message.is_edited ? 'true' : 'false';
    if (message.sender) {
        messageEl.dataset.messageSenderId = message.sender.id != null ? String(message.sender.id) : '';
        messageEl.dataset.messageSenderName = message.sender.username || '';
    }
}

function applyDeletedState(messageEl) {
    if (!messageEl) {
        return;
    }

    messageEl.classList.add('message-deleted');

    const contentEl = messageEl.querySelector('.message-content');
    if (contentEl) {
        contentEl.textContent = 'این پیام حذف شده است.';
    } else {
        const newContent = document.createElement('span');
        newContent.classList.add('message-content');
        newContent.textContent = 'این پیام حذف شده است.';
        messageEl.insertBefore(newContent, messageEl.firstChild);
    }

    messageEl.querySelector('.message-status')?.remove();
    messageEl.querySelector('.attachments')?.remove();
    messageEl.querySelector('.message-actions')?.remove();

    setMessageMetadata(messageEl, {
        id: messageEl.dataset.messageId,
        content: '',
        is_deleted: true,
    });
}

function renderMessageContent(container, message, isSent) {
    if (!container || !message) {
        return;
    }

    const isDeleted = Boolean(message.is_deleted);
    const isEdited = Boolean(message.is_edited);
    const timestamp = formatTimestamp(message.timestamp);

    const contentSpan = document.createElement('span');
    contentSpan.classList.add('message-content');
    contentSpan.textContent = isDeleted ? 'این پیام حذف شده است.' : message.content || '';
    container.appendChild(contentSpan);

    if (isEdited && !isDeleted) {
        const status = document.createElement('span');
        status.classList.add('message-status');
        status.textContent = 'ویرایش شده';
        container.appendChild(status);
    }

    if (timestamp) {
        const timeEl = document.createElement('span');
        timeEl.classList.add('timestamp');
        timeEl.textContent = timestamp;
        container.appendChild(timeEl);
    }

    if (!isDeleted && Array.isArray(message.attachments) && message.attachments.length > 0) {
        const attachmentsWrapper = document.createElement('div');
        attachmentsWrapper.classList.add('attachments');
        message.attachments.forEach((attachment, index) => {
            const element = createMessageAttachmentElement(attachment, index);
            if (element) {
                attachmentsWrapper.appendChild(element);
            }
        });
        if (attachmentsWrapper.childNodes.length) {
            container.appendChild(attachmentsWrapper);
        }
    }

    if (isSent && !isDeleted) {
        const messageId = message.id ?? message.pk;
        if (messageId === undefined || messageId === null) {
            return;
        }
        const actions = document.createElement('div');
        actions.classList.add('message-actions');

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.classList.add('message-actions__btn', 'edit_btn');
        editBtn.dataset.messageId = String(messageId);
        editBtn.setAttribute('aria-label', 'ویرایش پیام');
        editBtn.innerHTML = editIconSvg;

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.classList.add('message-actions__btn', 'delete_btn');
        deleteBtn.dataset.messageId = String(messageId);
        deleteBtn.setAttribute('aria-label', 'حذف پیام');
        deleteBtn.innerHTML = deleteIconSvg;

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
        container.appendChild(actions);
    }
}

function resolveConversationId(message) {
    if (!message) {
        return null;
    }

    if (typeof message.conversation === 'number') {
        return message.conversation;
    }

    if (typeof message.conversation === 'string') {
        const parsed = Number(message.conversation);
        return Number.isNaN(parsed) ? null : parsed;
    }

    if (message.conversation && typeof message.conversation === 'object') {
        const id = message.conversation.id ?? message.conversation.pk;
        if (typeof id === 'number') {
            return id;
        }
        if (typeof id === 'string') {
            const parsed = Number(id);
            return Number.isNaN(parsed) ? null : parsed;
        }
        return null;
    }

    if (typeof message.conversation_id === 'number') {
        return message.conversation_id;
    }

    if (typeof message.conversation_id === 'string') {
        const parsed = Number(message.conversation_id);
        return Number.isNaN(parsed) ? null : parsed;
    }

    return null;
}

function getMessagePreviewText(message) {
    if (!message) {
        return '';
    }

    if (message.is_deleted) {
        return 'این پیام حذف شده است.';
    }

    return message.content || '';
}

function updateConversationPreview(conversationId, message) {
    updateConversationCache(conversationId, message);
    if (!contactsList || !conversationId) {
        return;
    }

    const contactEl = contactsList.querySelector(`.contact[data-id="${conversationId}"]`);
    if (!contactEl) {
        return;
    }

    const previewEl = contactEl.querySelector('.last_message span');
    if (!previewEl) {
        return;
    }

    previewEl.textContent = getMessagePreviewText(message);
}

export function renderConversations(conversations, currentUser = getCurrentUser(), activeConversationId = null) {
    if (!contactsList) {
        return;
    }

    contactsList.innerHTML = '';

    if (!conversations || conversations.length === 0) {
        contactsList.insertAdjacentHTML('beforeend', emptyStateTemplate);
        return;
    }

    conversations.forEach((conv) => {
        const participant = getParticipant(conv, currentUser);
        const lastMessagePreview = getLastMessagePreview(conv);
        const div = document.createElement('div');
        div.classList.add('contact');
        div.dataset.id = conv.id;
        if (activeConversationId && Number(activeConversationId) === Number(conv.id)) {
            div.classList.add('open');
        }
        div.innerHTML = `
            <div class="contact_contant_right" data-conv-id="${conv.id}">
                <div class="contact_profile">
                    <img src="${participant?.profile_picture || '/img/icons/profile.svg'}" alt="contact">
                </div>
                <div class="contact_content">
                    <span>${participant?.username || conv.name || 'Unknown User'}</span>
                    <div class="last_message">
                        <span>${lastMessagePreview}</span>
                    </div>
                </div>
            </div>
            <div class="chat_actions">
                <button class="delete_btn" data-conv-id="${conv.id}">
                    <img src="/img/icons/delete.svg" alt="Delete">
                </button>
            </div>
        `;

        div.querySelector('.contact_contant_right').addEventListener('click', (e) => {
            openChat(parseInt(e.currentTarget.dataset.convId, 10));
        });

        div.querySelector('.delete_btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteConversationHandler(parseInt(e.currentTarget.dataset.convId, 10));
        });

        contactsList.appendChild(div);
    });
}

export function renderMessages(messages, append = false, currentUser = getCurrentUser()) {
    if (!messagesContainer) {
        return;
    }

    if (!append) {
        messagesContainer.innerHTML = '';
    }

    const userId = currentUser?.id;

    messages.forEach((msg) => {
        if (!msg || typeof msg !== 'object') {
            return;
        }
        const isSent = userId !== undefined && msg.sender?.id === userId;
        const messageType = isSent ? 'messages_send' : 'messages_receive';

        const messageId = msg.id ?? msg.pk;
        if (messageId === undefined || messageId === null) {
            return;
        }

        const div = document.createElement('div');
        div.classList.add(messageType);
        div.dataset.messageId = String(messageId);
        if (msg.is_deleted) {
            div.classList.add('message-deleted');
        }

        renderMessageContent(div, msg, isSent);
        setMessageMetadata(div, msg);

        if (isSent && !msg.is_deleted) {
            div.querySelector('.edit_btn')?.addEventListener('click', () => editMessageHandler?.(messageId));
            div.querySelector('.delete_btn')?.addEventListener('click', () => deleteMessageHandler?.(messageId));
        }

        messagesContainer.appendChild(div);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

export function updateSelectedContact(conversation, currentUser = getCurrentUser()) {
    if (!selectedContactName) {
        return;
    }

    const participant = getParticipant(conversation, currentUser);
    const username = participant?.username || conversation?.name || 'Chat';
    const displayName = participant?.full_name || participant?.email || '';
    setElementText(selectedContactName, username);

    if (selectedContactMeta) {
        if (displayName && displayName !== username) {
            selectedContactMeta.textContent = displayName;
        } else if (conversation?.participants?.length > 2) {
            selectedContactMeta.textContent = `گروه ${conversation.participants.length} نفره`;
        } else {
            selectedContactMeta.textContent = 'گفتگو خصوصی';
        }
    }

    if (selectedContactAvatar) {
        selectedContactAvatar.src = participant?.profile_picture || '/img/icons/user-icon.svg';
        selectedContactAvatar.alt = username;
    }
}

export function clearChatWindow() {
    if (messagesContainer) {
        messagesContainer.innerHTML = '';
    }
    if (selectedContactName) {
        selectedContactName.textContent = 'Chat';
    }
    if (selectedContactMeta) {
        selectedContactMeta.textContent = 'در انتظار انتخاب مکالمه';
    }
    if (selectedContactAvatar) {
        selectedContactAvatar.src = '/img/icons/user-icon.svg';
        selectedContactAvatar.alt = 'profile';
    }
}

export function handleNewMessage(message) {
    renderMessages([message], true, getCurrentUser());
    document.getElementById('typing-indicator')?.remove();
    const conversationId = resolveConversationId(message);
    if (conversationId) {
        updateConversationPreview(conversationId, message);
    }
}

export function handleEditedMessage(message) {
    if (!messagesContainer || !message) {
        return;
    }
    const targetId = message.id ?? message.pk;
    if (targetId === undefined || targetId === null) {
        return;
    }
    const messageEl = messagesContainer.querySelector(`[data-message-id="${targetId}"]`);
    if (!messageEl) {
        return;
    }

    messageEl.classList.toggle('message-deleted', Boolean(message.is_deleted));
    setMessageMetadata(messageEl, message);

    const hasAttachmentsInfo = Array.isArray(message.attachments);
    const shouldPreserveAttachments = !message.is_deleted && !hasAttachmentsInfo;
    const preservedAttachments = shouldPreserveAttachments
        ? messageEl.querySelector('.attachments')
        : null;

    messageEl.querySelector('.message-actions')?.remove();
    messageEl.querySelector('.message-status')?.remove();
    messageEl.querySelector('.timestamp')?.remove();
    messageEl.querySelector('.message-content')?.remove();
    messageEl.querySelector('.attachments')?.remove();

    renderMessageContent(messageEl, message, messageEl.classList.contains('messages_send'));

    if (preservedAttachments && !message.is_deleted) {
        const actionsEl = messageEl.querySelector('.message-actions');
        if (actionsEl) {
            messageEl.insertBefore(preservedAttachments, actionsEl);
        } else {
            messageEl.appendChild(preservedAttachments);
        }
    }

    if (!message.is_deleted && messageEl.classList.contains('messages_send')) {
        messageEl.querySelector('.edit_btn')?.addEventListener('click', () => editMessageHandler?.(targetId));
        messageEl.querySelector('.delete_btn')?.addEventListener('click', () => deleteMessageHandler?.(targetId));
    }

    const conversationId = resolveConversationId(message);
    if (conversationId) {
        updateConversationPreview(conversationId, message);
    }
}

export function handleDeletedMessage(messageId, conversationId) {
    if (!messagesContainer) {
        return;
    }
    if (messageId === undefined || messageId === null) {
        return;
    }
    const messageEl = messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
    if (messageEl) {
        applyDeletedState(messageEl);
    }

    if (conversationId) {
        updateConversationPreview(conversationId, { id: messageId, is_deleted: true, content: '' });
    }
}

export function handleTypingIndicator(username, isTyping) {
    if (!messagesContainer) {
        return;
    }

    let indicator = document.getElementById('typing-indicator');
    if (isTyping) {
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'typing-indicator';
            indicator.classList.add('typing-indicator');
            messagesContainer.appendChild(indicator);
        }
        indicator.textContent = `${username} در حال نوشتن است...`;
    } else if (indicator) {
        indicator.remove();
    }
}

export function toggleMobileChatView(show) {
    if (!chatContainer) {
        return;
    }
    if (window.innerWidth <= 1000) {
        chatContainer.classList.toggle('mobile-chat-open', Boolean(show));
    }
}

export function getMessageDetails(messageId) {
    if (!messagesContainer || messageId === undefined || messageId === null) {
        return null;
    }

    const messageEl = messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageEl) {
        return null;
    }

    return {
        id: messageId,
        content: messageEl.dataset.messageContent || '',
        is_deleted: messageEl.dataset.messageDeleted === 'true',
        is_edited: messageEl.dataset.messageEdited === 'true',
        sender: {
            id: messageEl.dataset.messageSenderId ? Number(messageEl.dataset.messageSenderId) : undefined,
            username: messageEl.dataset.messageSenderName || '',
        },
    };
}
