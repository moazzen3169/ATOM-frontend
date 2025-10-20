import * as api from './api.js';
import * as ws from './websocket.js';
import * as ui from './ui.js';

// --- DOM ELEMENTS ---
const chatInput = document.querySelector('.chat_input');
const dataSenderForm = document.getElementById('data_sender_form');
const fileInput = document.getElementById('file_input');
const newConversationBtn = document.getElementById('new-conversation-btn');
const backBtn = document.querySelector('.back');
const modalElement = document.getElementById('new-conversation-modal');
const modalForm = document.getElementById('chat-new-conversation-form');
const modalCloseButtons = document.querySelectorAll('[data-close-modal]');
const modalSearchInput = document.getElementById('chat-user-search-input');
const modalResultsContainer = document.getElementById('chat-user-search-results');
const modalErrorEl = document.getElementById('chat-modal-error');
const modalSubmitBtn = document.getElementById('chat-modal-submit');

// --- STATE ---
let conversations = [];
let selectedConversationId = null;
let currentUser = null;
let isSearchingUsers = false;

// --- HELPERS ---

function showNewConversationModal() {
    if (!modalElement) {
        return;
    }
    resetNewConversationModal();
    modalElement.classList.add('open');
    modalSearchInput?.focus();
}

function hideNewConversationModal() {
    if (!modalElement) {
        return;
    }
    modalElement.classList.remove('open');
    setModalLoading(false);
    resetNewConversationModal();
}

function resetNewConversationModal() {
    if (modalSearchInput) {
        modalSearchInput.value = '';
    }
    if (modalResultsContainer) {
        modalResultsContainer.innerHTML = '';
    }
    if (modalErrorEl) {
        modalErrorEl.textContent = '';
        modalErrorEl.classList.add('hidden');
    }
}

function setModalError(message) {
    if (!modalErrorEl) {
        return;
    }
    modalErrorEl.textContent = message || '';
    modalErrorEl.classList.toggle('hidden', !message);
}

function setModalLoading(isLoading) {
    isSearchingUsers = isLoading;
    if (modalSubmitBtn) {
        modalSubmitBtn.disabled = isLoading;
    }
    if (modalElement) {
        modalElement.classList.toggle('loading', isLoading);
    }
}

function renderUserSearchResults(users) {
    if (!modalResultsContainer) {
        return;
    }

    modalResultsContainer.innerHTML = '';

    if (!users || users.length === 0) {
        modalResultsContainer.innerHTML = '<p class="chat-modal-empty">کاربری یافت نشد.</p>';
        return;
    }

    const list = document.createElement('ul');
    list.classList.add('chat-modal-results');

    users.forEach((user) => {
        if (!user || user.id === currentUser?.id) {
            return;
        }
        const item = document.createElement('li');
        item.classList.add('chat-modal-result-item');
        item.innerHTML = `
            <button type="button" class="chat-modal-result" data-user-id="${user.id}">
                <div class="chat-modal-result-avatar">
                    <img src="${user.profile_picture || '/img/icons/profile.svg'}" alt="${user.username}">
                </div>
                <div class="chat-modal-result-body">
                    <span class="chat-modal-result-name">${user.username}</span>
                    ${user.full_name ? `<span class="chat-modal-result-meta">${user.full_name}</span>` : ''}
                </div>
            </button>
        `;

        item.querySelector('button').addEventListener('click', () => {
            handleCreateConversation(user);
        });

        list.appendChild(item);
    });

    if (!list.children.length) {
        modalResultsContainer.innerHTML = '<p class="chat-modal-empty">کاربری یافت نشد.</p>';
        return;
    }

    modalResultsContainer.appendChild(list);
}

async function handleCreateConversation(user) {
    if (!user || user.id === currentUser?.id) {
        setModalError('امکان ایجاد گفتگو با حساب کاربری خودتان وجود ندارد.');
        return;
    }

    try {
        setModalError('');
        setModalLoading(true);
        const response = await api.createConversation([user.id]);
        hideNewConversationModal();

        const newConversationId = response?.id || null;
        const updatedConversations = await loadConversations();

        if (newConversationId) {
            openChat(newConversationId);
            return;
        }

        const createdConv = updatedConversations?.find((conv) => conv.participants?.some((p) => p.id === user.id));
        if (createdConv) {
            openChat(createdConv.id);
        }
    } catch (error) {
        console.error('Could not create conversation:', error);
        setModalError('ایجاد گفتگو با خطا مواجه شد. دوباره تلاش کنید.');
    } finally {
        setModalLoading(false);
    }
}

async function handleUserSearch(event) {
    event.preventDefault();
    if (isSearchingUsers) {
        return;
    }

    const query = modalSearchInput?.value?.trim();
    if (!query) {
        setModalError('لطفا نام کاربری مورد نظر را وارد کنید.');
        return;
    }

    try {
        setModalError('');
        setModalLoading(true);
        const users = await api.searchUsers(query);
        renderUserSearchResults(users);
    } catch (error) {
        console.error('Failed to search users:', error);
        setModalError('جستجوی کاربر با خطا مواجه شد.');
    } finally {
        setModalLoading(false);
    }
}

// --- HANDLERS ---

export async function openChat(conversationId) {
    if (!conversationId) {
        return;
    }

    selectedConversationId = conversationId;

    document.querySelectorAll('.contact').forEach((el) => {
        el.classList.toggle('open', el.dataset.id == conversationId);
    });

    const conversation = conversations.find((c) => c.id === conversationId);
    if (conversation) {
        ui.updateSelectedContact(conversation, currentUser);
    }

    try {
        const messages = await api.getMessages(conversationId);
        ui.renderMessages(messages, false, currentUser);
        ws.connectWebSocket(conversationId);
        ui.toggleMobileChatView(true);
    } catch (error) {
        console.error(`Could not open chat for conversation ${conversationId}:`, error);
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();

    if (!selectedConversationId) {
        alert('ابتدا یک گفتگو را انتخاب کنید.');
        return;
    }

    const content = chatInput?.value?.trim() || '';
    const file = fileInput?.files?.[0];

    if (!content && !file) {
        return;
    }

    if (content && !file) {
        const payload = { type: 'chat_message', message: content };
        const sent = ws.sendWebSocketMessage(payload);
        if (!sent) {
            try {
                await api.sendMessage(selectedConversationId, content);
                await openChat(selectedConversationId);
                await loadConversations();
            } catch (error) {
                console.error('Error sending text message via REST API:', error);
            }
        }
        if (chatInput) {
            chatInput.value = '';
        }
        return;
    }

    try {
        const messageText = content || (file ? `File: ${file.name}` : '');
        const newMessage = await api.sendMessage(selectedConversationId, messageText);

        if (file) {
            const formData = new FormData();
            formData.append('file', file);
            await api.uploadAttachment(selectedConversationId, newMessage.id, formData);
        }

        if (chatInput) {
            chatInput.value = '';
        }
        if (fileInput) {
            fileInput.value = '';
        }

        await openChat(selectedConversationId);
        await loadConversations();
    } catch (error) {
        console.error('Could not send message with attachment:', error);
    }
}

export async function deleteConversationHandler(conversationId) {
    if (!confirm('آیا از حذف این گفتگو مطمئن هستید؟')) {
        return;
    }

    try {
        await api.deleteConversation(conversationId);
        if (selectedConversationId === conversationId) {
            ui.clearChatWindow();
            selectedConversationId = null;
        }
        await loadConversations();
    } catch (error) {
        console.error(`Could not delete conversation ${conversationId}:`, error);
    }
}

function editMessageHandler(messageId) {
    const newContent = prompt('متن جدید پیام را وارد کنید:');
    if (newContent) {
        ws.sendWebSocketMessage({
            type: 'edit_message',
            message_id: messageId,
            content: newContent,
        });
    }
}

function deleteMessageHandler(messageId) {
    if (confirm('آیا از حذف این پیام مطمئن هستید؟')) {
        ws.sendWebSocketMessage({
            type: 'delete_message',
            message_id: messageId,
        });
    }
}

async function loadConversations() {
    try {
        conversations = await api.getConversations();
        ui.renderConversations(conversations, currentUser);
        return conversations;
    } catch (error) {
        console.error('Could not load conversations:', error);
        return [];
    }
}

export function updateConversationCache(conversationId, lastMessage) {
    if (!conversationId) {
        return;
    }

    const normalizedId = typeof conversationId === 'string' ? Number(conversationId) : conversationId;
    if (Number.isNaN(normalizedId)) {
        return;
    }

    const index = conversations.findIndex((conv) => conv.id === normalizedId);
    if (index === -1) {
        return;
    }

    const conversation = { ...conversations[index] };
    if (lastMessage === null) {
        conversation.last_message = null;
    } else if (lastMessage && typeof lastMessage === 'object') {
        conversation.last_message = { ...conversation.last_message, ...lastMessage };
    } else if (lastMessage !== undefined) {
        conversation.last_message = { ...(conversation.last_message || {}), content: String(lastMessage) };
    }

    conversations[index] = conversation;
}

// --- INITIALIZATION ---

async function initialize() {
    const token = api.getAuthToken();
    if (!token) {
        console.error('Authentication token not found. Please log in.');
        return;
    }

    try {
        currentUser = await api.getCurrentUser();
        ui.setCurrentUser(currentUser);
        ui.registerMessageHandlers(editMessageHandler, deleteMessageHandler);
        await loadConversations();
    } catch (error) {
        console.error('Failed to initialize chat application:', error);
        return;
    }

    if (newConversationBtn) {
        newConversationBtn.addEventListener('click', showNewConversationModal);
    }

    modalCloseButtons.forEach((btn) => {
        btn.addEventListener('click', hideNewConversationModal);
    });

    if (modalElement) {
        modalElement.addEventListener('click', (event) => {
            if (event.target === modalElement) {
                hideNewConversationModal();
            }
        });
    }

    if (modalForm) {
        modalForm.addEventListener('submit', handleUserSearch);
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modalElement?.classList.contains('open')) {
            hideNewConversationModal();
        }
    });

    if (dataSenderForm) {
        dataSenderForm.addEventListener('submit', handleFormSubmit);
    }

    let typingTimeout;
    if (chatInput) {
        chatInput.addEventListener('input', () => {
            if (!selectedConversationId) {
                return;
            }
            clearTimeout(typingTimeout);

            ws.sendWebSocketMessage({
                type: 'typing',
                is_typing: true,
            });

            typingTimeout = setTimeout(() => {
                if (!selectedConversationId) {
                    return;
                }
                ws.sendWebSocketMessage({
                    type: 'typing',
                    is_typing: false,
                });
            }, 1000);
        });

        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                dataSenderForm?.dispatchEvent(new Event('submit', { cancelable: true }));
                clearTimeout(typingTimeout);
                if (!selectedConversationId) {
                    return;
                }
                ws.sendWebSocketMessage({
                    type: 'typing',
                    is_typing: false,
                });
            }
        });
    }

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            ui.toggleMobileChatView(false);
        });
    }
}

document.addEventListener('DOMContentLoaded', initialize);
