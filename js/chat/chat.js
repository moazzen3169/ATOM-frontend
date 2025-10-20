import * as api from './api.js';
import * as ws from './websocket.js';
import * as ui from './ui.js';

// --- DOM ELEMENTS ---
const chatInput = document.querySelector('.chat_input');
const dataSenderForm = document.getElementById('data_sender_form');
const fileInput = document.getElementById('file_input');
const newConversationBtn = document.getElementById('new-conversation-btn');
const backBtn = document.querySelector('.back');

const newConversationModal = document.getElementById('new-conversation-modal');
const modalForm = document.getElementById('chat-new-conversation-form');
const modalCloseButtons = document.querySelectorAll('[data-close-modal]');
const modalSearchInput = document.getElementById('chat-user-search-input');
const modalResultsContainer = document.getElementById('chat-user-search-results');
const modalErrorEl = document.getElementById('chat-modal-error');
const modalSubmitBtn = document.getElementById('chat-modal-submit');

const editModalElement = document.getElementById('chat-edit-modal');
const editForm = document.getElementById('chat-edit-form');
const editInput = document.getElementById('chat-edit-input');
const editErrorEl = document.getElementById('chat-edit-error');

const deleteModalElement = document.getElementById('chat-delete-modal');
const deleteConfirmBtn = document.getElementById('chat-delete-confirm');
const deleteModalDescription = deleteModalElement?.querySelector('.chat-modal__description') || null;
const deleteModalDefaultDescription = deleteModalDescription?.textContent || '';

// --- STATE ---
let conversations = [];
let selectedConversationId = null;
let currentUser = null;
let isSearchingUsers = false;
let pendingEditMessageId = null;
let pendingDeleteMessageId = null;

// --- HELPERS ---

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return '';
    }
    return String(value).replace(/[&<>"']/g, (char) => {
        switch (char) {
            case '&':
                return '&amp;';
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            case '"':
                return '&quot;';
            case '\'':
                return '&#39;';
            default:
                return char;
        }
    });
}

function escapeRegExp(value) {
    return value.replace(/[-\^$*+?.()|[\]{}]/g, '\$&');
}

function highlightMatch(text, query) {
    if (!text) {
        return '';
    }
    if (!query) {
        return escapeHtml(text);
    }

    try {
        const pattern = new RegExp(escapeRegExp(query), 'gi');
        let result = '';
        let lastIndex = 0;
        let match;
        while ((match = pattern.exec(text)) !== null) {
            result += escapeHtml(text.slice(lastIndex, match.index));
            result += `<mark>${escapeHtml(match[0])}</mark>`;
            lastIndex = pattern.lastIndex;
        }
        result += escapeHtml(text.slice(lastIndex));
        return result;
    } catch (error) {
        console.error('Failed to highlight match:', error);
        return escapeHtml(text);
    }
}

function openModal(modal) {
    modal?.classList.add('open');
}

function closeModal(modal) {
    modal?.classList.remove('open');
}

function showNewConversationModal() {
    if (!newConversationModal) {
        return;
    }
    resetNewConversationModal();
    openModal(newConversationModal);
    modalSearchInput?.focus();
}

function hideNewConversationModal() {
    if (!newConversationModal) {
        return;
    }
    closeModal(newConversationModal);
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
    if (newConversationModal) {
        newConversationModal.classList.toggle('loading', isLoading);
    }
}

function computeUserScore(user, normalizedQuery) {
    const username = user?.username?.toLowerCase?.() || '';
    const fullName = user?.full_name?.toLowerCase?.() || '';
    const idString = user?.id != null ? String(user.id).toLowerCase() : '';

    if (normalizedQuery && idString === normalizedQuery) {
        return -1000;
    }

    const usernameIndex = normalizedQuery ? username.indexOf(normalizedQuery) : -1;
    const fullNameIndex = normalizedQuery ? fullName.indexOf(normalizedQuery) : -1;

    const usernameScore = usernameIndex !== -1 ? usernameIndex : Number.MAX_SAFE_INTEGER;
    const fullNameScore = fullNameIndex !== -1 ? fullNameIndex + 50 : Number.MAX_SAFE_INTEGER;

    const baseScore = Math.min(usernameScore, fullNameScore);
    const reference = username || fullName || idString;
    const lengthPenalty = reference ? Math.abs(reference.length - (normalizedQuery?.length || 0)) : 100;

    return baseScore * 100 + lengthPenalty;
}

function renderUserSearchResults(users, query) {
    if (!modalResultsContainer) {
        return;
    }

    modalResultsContainer.innerHTML = '';

    if (!users || users.length === 0) {
        modalResultsContainer.innerHTML = '<p class="chat-modal-empty">کاربری یافت نشد.</p>';
        return;
    }

    const normalizedQuery = query?.trim?.().toLowerCase() || '';
    const sortedUsers = [...users].sort((a, b) => computeUserScore(a, normalizedQuery) - computeUserScore(b, normalizedQuery));

    const list = document.createElement('ul');
    list.classList.add('chat-modal-results');

    sortedUsers.forEach((user) => {
        if (!user || user.id === currentUser?.id) {
            return;
        }

        const usernameValue = user.username || 'کاربر';
        const usernameHtml = highlightMatch(usernameValue, query);
        const fullNameHtml = user.full_name ? highlightMatch(user.full_name, query) : '';
        const idHtml = user.id != null ? highlightMatch(`#${user.id}`, query) : '';

        const metaParts = [];
        if (fullNameHtml && fullNameHtml !== usernameHtml) {
            metaParts.push(`<span class="chat-modal-result-meta">${fullNameHtml}</span>`);
        }
        if (idHtml) {
            metaParts.push(`<span class="chat-modal-result-meta">${idHtml}</span>`);
        }

        const item = document.createElement('li');
        item.classList.add('chat-modal-result-item');
        item.innerHTML = `
            <button type="button" class="chat-modal-result" data-user-id="${user.id}">
                <div class="chat-modal-result-avatar">
                    <img src="${user.profile_picture || '/img/icons/profile.svg'}" alt="${escapeHtml(usernameValue)}">
                </div>
                <div class="chat-modal-result-body">
                    <span class="chat-modal-result-name">${usernameHtml}</span>
                    ${metaParts.join('')}
                </div>
            </button>
        `;

        const button = item.querySelector('button');
        button.addEventListener('click', () => {
            list.querySelectorAll('.chat-modal-result').forEach((resultButton) => {
                resultButton.classList.toggle('is-selected', resultButton === button);
            });
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
        renderUserSearchResults(users, query);
    } catch (error) {
        console.error('Failed to search users:', error);
        setModalError('جستجوی کاربر با خطا مواجه شد.');
    } finally {
        setModalLoading(false);
    }
}

function resetEditModal() {
    pendingEditMessageId = null;
    if (editInput) {
        editInput.value = '';
    }
    if (editErrorEl) {
        editErrorEl.textContent = '';
        editErrorEl.classList.add('hidden');
    }
}

function setEditModalError(message) {
    if (!editErrorEl) {
        return;
    }
    editErrorEl.textContent = message || '';
    editErrorEl.classList.toggle('hidden', !message);
}

function showEditModal(messageId) {
    if (!editModalElement) {
        return;
    }

    const details = ui.getMessageDetails(messageId);
    if (!details) {
        alert('پیام مورد نظر یافت نشد.');
        return;
    }

    if (details.is_deleted) {
        alert('این پیام حذف شده است و قابل ویرایش نیست.');
        return;
    }

    pendingEditMessageId = messageId;
    if (editInput) {
        editInput.value = details.content || '';
        editInput.focus();
        editInput.setSelectionRange(editInput.value.length, editInput.value.length);
    }
    setEditModalError('');
    openModal(editModalElement);
}

function hideEditModal() {
    if (!editModalElement) {
        return;
    }
    closeModal(editModalElement);
    resetEditModal();
}

function getMessagePreview(content) {
    if (!content) {
        return 'بدون متن';
    }
    const trimmed = content.trim();
    if (!trimmed) {
        return 'بدون متن';
    }
    return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
}

function resetDeleteModal() {
    pendingDeleteMessageId = null;
    if (deleteModalDescription) {
        deleteModalDescription.innerHTML = escapeHtml(deleteModalDefaultDescription);
    }
}

function showDeleteModal(messageId) {
    if (!deleteModalElement) {
        return;
    }

    const details = ui.getMessageDetails(messageId);
    if (!details) {
        alert('پیام مورد نظر یافت نشد.');
        return;
    }

    pendingDeleteMessageId = messageId;
    if (deleteModalDescription) {
        const preview = details.is_deleted ? 'این پیام پیش‌تر حذف شده است.' : getMessagePreview(details.content);
        deleteModalDescription.innerHTML = `${escapeHtml(deleteModalDefaultDescription)}<br><span class="chat-modal-result-meta">${escapeHtml(preview)}</span>`;
    }

    openModal(deleteModalElement);
}

function hideDeleteModal() {
    if (!deleteModalElement) {
        return;
    }
    closeModal(deleteModalElement);
    resetDeleteModal();
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

async function handleFormSubmit(event) {
    event.preventDefault();

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
    showEditModal(messageId);
}

function deleteMessageHandler(messageId) {
    showDeleteModal(messageId);
}

async function loadConversations() {
    try {
        conversations = await api.getConversations();
        ui.renderConversations(conversations, currentUser, selectedConversationId);
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
        btn.addEventListener('click', (event) => {
            const modal = event.currentTarget.closest('.chat-modal');
            if (!modal) {
                return;
            }
            if (modal === newConversationModal) {
                hideNewConversationModal();
            } else if (modal === editModalElement) {
                hideEditModal();
            } else if (modal === deleteModalElement) {
                hideDeleteModal();
            }
        });
    });

    if (newConversationModal) {
        newConversationModal.addEventListener('click', (event) => {
            if (event.target === newConversationModal) {
                hideNewConversationModal();
            }
        });
    }

    if (editModalElement) {
        editModalElement.addEventListener('click', (event) => {
            if (event.target === editModalElement) {
                hideEditModal();
            }
        });
    }

    if (deleteModalElement) {
        deleteModalElement.addEventListener('click', (event) => {
            if (event.target === deleteModalElement) {
                hideDeleteModal();
            }
        });
    }

    if (modalForm) {
        modalForm.addEventListener('submit', handleUserSearch);
    }

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') {
            return;
        }
        if (deleteModalElement?.classList.contains('open')) {
            hideDeleteModal();
            return;
        }
        if (editModalElement?.classList.contains('open')) {
            hideEditModal();
            return;
        }
        if (newConversationModal?.classList.contains('open')) {
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

        chatInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
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
            if (window.innerWidth <= 1000) {
                ui.toggleMobileChatView(false);
                return;
            }
            window.location.href = './index.html';
        });
    }

    if (editForm) {
        editForm.addEventListener('submit', (event) => {
            event.preventDefault();
            if (!pendingEditMessageId) {
                hideEditModal();
                return;
            }

            const content = editInput?.value?.trim();
            if (!content) {
                setEditModalError('متن پیام نمی‌تواند خالی باشد.');
                return;
            }

            setEditModalError('');
            ws.sendWebSocketMessage({
                type: 'edit_message',
                message_id: pendingEditMessageId,
                content,
            });
            hideEditModal();
        });
    }

    if (deleteConfirmBtn) {
        deleteConfirmBtn.addEventListener('click', () => {
            if (!pendingDeleteMessageId) {
                hideDeleteModal();
                return;
            }

            ws.sendWebSocketMessage({
                type: 'delete_message',
                message_id: pendingDeleteMessageId,
            });
            hideDeleteModal();
        });
    }
}

document.addEventListener('DOMContentLoaded', initialize);
