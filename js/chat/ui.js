// This module will handle all DOM manipulation and UI updates.
import { openChat, deleteConversationHandler } from './chat.js';

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
const selectedContactName = document.querySelector('.selected_contact .contact_content span');
const chatContainer = document.querySelector('.chat_container');
const emptyStateTemplate = `
    <div class="chat_empty_state">
        <p>گفتگویی یافت نشد.</p>
    </div>
`;

export function renderConversations(conversations, currentUser = getCurrentUser()) {
    if (!contactsList) {
        return;
    }

    contactsList.innerHTML = '';

    if (!conversations || conversations.length === 0) {
        contactsList.insertAdjacentHTML('beforeend', emptyStateTemplate);
        return;
    }

    conversations.forEach((conv) => {
        const participant = conv.participants?.find((p) => p.id !== currentUser?.id) || conv.participants?.[0];
        const div = document.createElement('div');
        div.classList.add('contact');
        div.dataset.id = conv.id;
        div.innerHTML = `
            <div class="contact_contant_right" data-conv-id="${conv.id}">
                <div class="contact_profile">
                    <img src="${participant?.profile_picture || '/img/icons/profile.svg'}" alt="contact">
                </div>
                <div class="contact_content">
                    <span>${participant?.username || conv.name || 'Unknown User'}</span>
                    <div class="last_message">
                        <span>${conv.last_message || ''}</span>
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
        const isSent = userId !== undefined && msg.sender?.id === userId;
        const messageType = isSent ? 'messages_send' : 'messages_receive';

        const div = document.createElement('div');
        div.classList.add(messageType);
        div.dataset.messageId = msg.id;

        const timestamp = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : '';

        let messageHTML = `
            <span class="message-content">${msg.content}</span>
            <span class="timestamp">${timestamp}</span>`;

        if (Array.isArray(msg.attachments) && msg.attachments.length > 0) {
            messageHTML += '<div class="attachments">';
            msg.attachments.forEach((att, index) => {
                const label = att.name || att.file || `Attachment ${index + 1}`;
                messageHTML += `<a href="${att.file}" target="_blank" rel="noopener">${label}</a>`;
            });
            messageHTML += '</div>';
        }

        if (isSent) {
            messageHTML += `
                <div class="message-actions">
                    <button class="edit_btn" data-message-id="${msg.id}">ویرایش</button>
                    <button class="delete_btn" data-message-id="${msg.id}">حذف</button>
                </div>`;
        }

        div.innerHTML = messageHTML;

        if (isSent) {
            div.querySelector('.edit_btn').addEventListener('click', () => editMessageHandler?.(msg.id));
            div.querySelector('.delete_btn').addEventListener('click', () => deleteMessageHandler?.(msg.id));
        }

        messagesContainer.appendChild(div);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

export function updateSelectedContact(conversation, currentUser = getCurrentUser()) {
    if (!selectedContactName) {
        return;
    }

    const participant = conversation?.participants?.find((p) => p.id !== currentUser?.id) || conversation?.participants?.[0];
    selectedContactName.textContent = participant?.username || conversation?.name || 'Chat';
}

export function clearChatWindow() {
    if (messagesContainer) {
        messagesContainer.innerHTML = '';
    }
    if (selectedContactName) {
        selectedContactName.textContent = 'Chat';
    }
}

export function handleNewMessage(message) {
    renderMessages([message], true, getCurrentUser());
}

export function handleEditedMessage(message) {
    if (!messagesContainer) {
        return;
    }
    const messageEl = messagesContainer.querySelector(`[data-message-id="${message.id}"]`);
    if (messageEl) {
        const contentEl = messageEl.querySelector('.message-content');
        if (contentEl) {
            contentEl.textContent = `${message.content} (Edited)`;
        }
    }
}

export function handleDeletedMessage(messageId) {
    if (!messagesContainer) {
        return;
    }
    const messageEl = messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
    if (messageEl) {
        messageEl.remove();
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
