import * as api from './api.js';
import * as ws from './websocket.js';
import * as ui from './ui.js';

const chatInput = document.getElementById('chat-input');
const dataSenderForm = document.getElementById('data_sender_form');
const fileInput = document.getElementById('file_input');
const newConversationBtn = document.getElementById('new-conversation-btn');
const backBtn = document.querySelector('.chat-thread__back');

let conversations = [];
let selectedConversationId = null;
let currentUser = null;

export async function openChat(conversationId) {
    selectedConversationId = conversationId;
    ui.highlightActiveConversation(conversationId);
    ui.handleTypingIndicator('', false);

    const conversation = conversations.find(c => c.id === conversationId);
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
        ui.showToast(error.message || 'بارگذاری پیام‌ها انجام نشد.', 'error');
    }
}

async function handleFormSubmit(event) {
    event.preventDefault();

    if (!selectedConversationId) {
        ui.showToast('ابتدا یک گفتگو را انتخاب کنید.', 'error');
        return;
    }

    const content = chatInput.value.trim();
    const file = fileInput.files[0];

    if (!content && !file) {
        return;
    }

    if (content && !file) {
        const sent = ws.sendWebSocketMessage({ type: 'chat_message', message: content });
        if (!sent) {
            try {
                await api.sendMessage(selectedConversationId, content);
                ui.showToast('پیام ارسال شد.', 'success');
                openChat(selectedConversationId);
            } catch (error) {
                console.error('Error sending text message via API:', error);
                ui.showToast(error.message || 'ارسال پیام ناموفق بود.', 'error');
                return;
            }
        }
        chatInput.value = '';
        return;
    }

    try {
        const messageText = content || (file ? `فایل: ${file.name}` : 'پیوست جدید');
        const newMessage = await api.sendMessage(selectedConversationId, messageText);

        if (file) {
            if (!newMessage?.id) {
                throw new Error('شناسه پیام برای بارگذاری فایل یافت نشد.');
            }
            const formData = new FormData();
            formData.append('file', file);
            await api.uploadAttachment(selectedConversationId, newMessage.id, formData);
        }

        chatInput.value = '';
        fileInput.value = '';
        ui.showToast('پیام ارسال شد.', 'success');
        openChat(selectedConversationId);
    } catch (error) {
        console.error('Could not send message with attachment:', error);
        ui.showToast(error.message || 'ارسال پیام ناموفق بود.', 'error');
    }
}

function createConversationHandler() {
    ui.openCreateConversationModal(async participantId => {
        try {
            const newConversation = await api.createConversation([participantId]);
            ui.showToast('گفتگو با موفقیت ایجاد شد.', 'success');
            await loadConversations();
            if (newConversation?.id) {
                openChat(newConversation.id);
            }
        } catch (error) {
            console.error('Could not create conversation:', error);
            ui.showToast(error.message || 'ایجاد گفتگو امکان‌پذیر نبود.', 'error');
            return false;
        }
    });
}

export async function deleteConversationHandler(conversationId) {
    try {
        await api.deleteConversation(conversationId);
        if (selectedConversationId === conversationId) {
            ui.clearChatWindow();
            selectedConversationId = null;
        }
        await loadConversations();
        ui.showToast('گفتگو حذف شد.', 'success');
    } catch (error) {
        console.error(`Could not delete conversation ${conversationId}:`, error);
        ui.showToast(error.message || 'حذف گفتگو انجام نشد.', 'error');
        return false;
    }
}

function editMessageHandler(messageId, newContent) {
    if (!newContent) {
        return false;
    }

    const sent = ws.sendWebSocketMessage({
        type: 'edit_message',
        message_id: messageId,
        content: newContent,
    });

    if (!sent) {
        ui.showToast('امکان ویرایش پیام وجود ندارد.', 'error');
        return false;
    }

    ui.showToast('پیام ویرایش شد.', 'success');
    return true;
}

function deleteMessageHandler(messageId) {
    const sent = ws.sendWebSocketMessage({
        type: 'delete_message',
        message_id: messageId,
    });

    if (!sent) {
        ui.showToast('امکان حذف پیام وجود ندارد.', 'error');
        return false;
    }

    ui.showToast('پیام حذف شد.', 'success');
    return true;
}

async function loadConversations() {
    try {
        conversations = (await api.getConversations()) || [];
        ui.renderConversations(conversations, currentUser, selectedConversationId);
    } catch (error) {
        console.error('Could not load conversations:', error);
        ui.showToast(error.message || 'بارگذاری گفتگوها انجام نشد.', 'error');
    }
}

async function initialize() {
    if (!dataSenderForm || !chatInput) {
        console.error('Chat form or input not found on the page.');
        return;
    }

    if (!api.AUTH_TOKEN) {
        ui.showToast('برای استفاده از گفتگو ابتدا وارد حساب کاربری خود شوید.', 'error');
    }

    try {
        currentUser = await api.getCurrentUser();
        ui.setCurrentUser(currentUser);
        ui.registerMessageHandlers(editMessageHandler, deleteMessageHandler);
        await loadConversations();
    } catch (error) {
        console.error('Failed to initialize chat application:', error);
        ui.showToast('راه‌اندازی گفت‌وگو با مشکل مواجه شد.', 'error');
    }

    if (newConversationBtn) {
        newConversationBtn.addEventListener('click', createConversationHandler);
    }

    dataSenderForm.addEventListener('submit', handleFormSubmit);

    let typingTimeout;
    chatInput.addEventListener('input', () => {
        clearTimeout(typingTimeout);

        ws.sendWebSocketMessage(
            {
                type: 'typing',
                is_typing: true,
            },
            { silent: true }
        );

        typingTimeout = setTimeout(() => {
            ws.sendWebSocketMessage(
                {
                    type: 'typing',
                    is_typing: false,
                },
                { silent: true }
            );
        }, 1000);
    });

    chatInput.addEventListener('keypress', event => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            dataSenderForm.dispatchEvent(new Event('submit', { cancelable: true }));
            ws.sendWebSocketMessage(
                {
                    type: 'typing',
                    is_typing: false,
                },
                { silent: true }
            );
            clearTimeout(typingTimeout);
        }
    });

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            ui.toggleMobileChatView(false);
        });
    }
}

document.addEventListener('DOMContentLoaded', initialize);
