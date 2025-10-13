// This module will handle all DOM manipulation and UI updates.
import { openChat, deleteConversationHandler } from './chat.js';

let editMessageHandler;
let deleteMessageHandler;

export function registerMessageHandlers(editHandler, deleteHandler) {
    editMessageHandler = editHandler;
    deleteMessageHandler = deleteHandler;
}

// --- DOM ELEMENTS ---
const contactsList = document.querySelector(".contact_list");
const messagesContainer = document.querySelector(".messages_container");
const selectedContactName = document.querySelector(".selected_contact .contact_content span");
const chatContainer = document.querySelector(".chat_container");

export function renderConversations(conversations, currentUser) {
    contactsList.innerHTML = ''; // Clear existing list
    conversations.forEach(conv => {
        const participant = conv.participants.find(p => p.id !== currentUser.id);
        const div = document.createElement("div");
        div.classList.add("contact");
        div.dataset.id = conv.id;
        div.innerHTML = `
            <div class="contact_contant_right" data-conv-id="${conv.id}">
                <div class="contact_profile">
                    <img src="${participant?.profile_picture || '/img/icons/profile.svg'}" alt="contact">
                </div>
                <div class="contact_content">
                    <span>${participant?.username || 'Unknown User'}</span>
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
        div.querySelector('.contact_contant_right').addEventListener("click", (e) => {
             openChat(parseInt(e.currentTarget.dataset.convId));
        });
        div.querySelector('.delete_btn').addEventListener("click", (e) => {
            e.stopPropagation(); // prevent opening the chat
            deleteConversationHandler(parseInt(e.currentTarget.dataset.convId));
        });
        contactsList.appendChild(div);
    });
}

export function renderMessages(messages, append = false, currentUser) {
    if (!append) {
        messagesContainer.innerHTML = '';
    }
    messages.forEach(msg => {
        const isSent = msg.sender.id === currentUser.id;
        const messageType = isSent ? 'messages_send' : 'messages_receive';

        const div = document.createElement("div");
        div.classList.add(messageType);
        div.dataset.messageId = msg.id;

        let messageHTML = `
            <span class="message-content">${msg.content}</span>
            <span class="timestamp">${new Date(msg.timestamp).toLocaleTimeString()}</span>`;

        if (msg.attachments && msg.attachments.length > 0) {
            messageHTML += '<div class="attachments">';
            msg.attachments.forEach(att => {
                messageHTML += `<a href="${att.file}" target="_blank">Attachment</a>`;
            });
            messageHTML += '</div>';
        }

        if (isSent) {
            messageHTML += `
                <div class="message-actions">
                    <button class="edit_btn" data-message-id="${msg.id}">Edit</button>
                    <button class="delete_btn" data-message-id="${msg.id}">Delete</button>
                </div>`;
        }

        div.innerHTML = messageHTML;

        if (isSent) {
            div.querySelector('.edit_btn').addEventListener('click', () => editMessageHandler(msg.id));
            div.querySelector('.delete_btn').addEventListener('click', () => deleteMessageHandler(msg.id));
        }

        messagesContainer.appendChild(div);
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

export function updateSelectedContact(conversation, currentUser) {
    const participant = conversation.participants.find(p => p.id !== currentUser.id);
    selectedContactName.textContent = participant?.username || 'Chat';
}

export function clearChatWindow() {
    messagesContainer.innerHTML = '';
    selectedContactName.textContent = 'Chat';
}

export function handleNewMessage(message) {
    renderMessages([message], true);
}

export function handleEditedMessage(message) {
    const messageEl = messagesContainer.querySelector(`[data-message-id="${message.id}"]`);
    if (messageEl) {
        messageEl.querySelector('span:first-child').textContent = `${message.content} (Edited)`;
    }
}

export function handleDeletedMessage(messageId) {
    const messageEl = messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
    if (messageEl) {
        messageEl.remove();
    }
}

export function handleTypingIndicator(username, isTyping) {
    let indicator = document.getElementById('typing-indicator');
    if (isTyping) {
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'typing-indicator';
            messagesContainer.appendChild(indicator);
        }
        indicator.textContent = `${username} is typing...`;
    } else {
        if (indicator) {
            indicator.remove();
        }
    }
}

export function toggleMobileChatView(show) {
    if (window.innerWidth <= 1000) {
        chatContainer.classList.toggle("mobile-chat-open", show);
    }
}