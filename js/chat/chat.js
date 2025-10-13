import * as api from './api.js';
import * as ws from './websocket.js';
import * as ui from './ui.js';

// --- DOM ELEMENTS ---
const chatInput = document.querySelector(".chat_input");
const dataSenderForm = document.getElementById("data_sender_form");
const fileInput = document.getElementById("file_input");
const newConversationBtn = document.getElementById("new-conversation-btn");
const backBtn = document.querySelector(".back");

// --- STATE ---
let conversations = [];
let selectedConversationId = null;
let currentUser = null;

// --- HANDLERS ---

export async function openChat(conversationId) {
    selectedConversationId = conversationId;

    document.querySelectorAll(".contact").forEach(el => {
        el.classList.toggle("open", el.dataset.id == conversationId);
    });

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
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const content = chatInput.value.trim();
    const file = fileInput.files[0];

    if (!content && !file) {
        return; // Nothing to send
    }

    if (content && !file) { // Text message only
        try {
            ws.sendWebSocketMessage({ type: 'chat_message', message: content });
            chatInput.value = '';
        } catch (error) {
            console.error("Error sending text message via WebSocket:", error);
        }
    } else { // File and/or text message
        try {
            // 1. Send a text message first to get a message object
            const messageText = content || `File: ${file.name}`;
            const newMessage = await api.sendMessage(selectedConversationId, messageText);

            // 2. If a file is attached, upload it
            if (file) {
                const formData = new FormData();
                formData.append('file', file);
                await api.uploadAttachment(selectedConversationId, newMessage.id, formData);
            }

            // The websocket should ideally send a message update with the attachment.
            // For now, we'll just clear the inputs.
            chatInput.value = '';
            fileInput.value = ''; // Reset file input

            // Manually refresh messages to see the attachment link (temporary)
            openChat(selectedConversationId);

        } catch (error) {
            console.error("Could not send message with attachment:", error);
        }
    }
}

async function createConversationHandler() {
    const participantId = prompt("Enter the user ID of the person you want to chat with:");
    if (!participantId || isNaN(participantId)) {
        alert("Invalid User ID.");
        return;
    }

    try {
        await api.createConversation([parseInt(participantId)]);
        loadConversations(); // Refresh the list
    } catch (error) {
        console.error("Could not create conversation:", error);
    }
}

export async function deleteConversationHandler(conversationId) {
    if (!confirm("Are you sure you want to delete this conversation?")) {
        return;
    }

    try {
        await api.deleteConversation(conversationId);
        if (selectedConversationId === conversationId) {
            ui.clearChatWindow();
            selectedConversationId = null;
        }
        loadConversations(); // Refresh the list
    } catch (error) {
        console.error(`Could not delete conversation ${conversationId}:`, error);
    }
}

function editMessageHandler(messageId) {
    const newContent = prompt("Enter the new message content:");
    if (newContent) {
        ws.sendWebSocketMessage({
            type: 'edit_message',
            message_id: messageId,
            content: newContent
        });
    }
}

function deleteMessageHandler(messageId) {
    if (confirm("Are you sure you want to delete this message?")) {
        ws.sendWebSocketMessage({
            type: 'delete_message',
            message_id: messageId
        });
    }
}

async function loadConversations() {
    try {
        conversations = await api.getConversations();
        ui.renderConversations(conversations, currentUser);
    } catch (error) {
        console.error("Could not load conversations:", error);
    }
}


// --- INITIALIZATION ---

async function initialize() {
    if (!api.AUTH_TOKEN) {
        console.error("Authentication token not found. Please log in.");
        // Optionally, redirect to login page
        // window.location.href = '/login.html';
        return;
    }

    try {
        currentUser = await api.getCurrentUser();
        ui.registerMessageHandlers(editMessageHandler, deleteMessageHandler);
        loadConversations();
    } catch (error) {
        console.error("Failed to initialize chat application:", error);
    }

    // Event Listeners
    if (newConversationBtn) {
        newConversationBtn.addEventListener("click", createConversationHandler);
    }

    dataSenderForm.addEventListener("submit", handleFormSubmit);

    let typingTimeout;
    chatInput.addEventListener("input", () => {
        // Clear the previous timeout
        clearTimeout(typingTimeout);

        // Send is_typing: true
        ws.sendWebSocketMessage({
            type: 'typing',
            is_typing: true
        });

        // Set a timeout to send is_typing: false after 1 second of inactivity
        typingTimeout = setTimeout(() => {
            ws.sendWebSocketMessage({
                type: 'typing',
                is_typing: false
            });
        }, 1000);
    });

    chatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !e.shiftKey) { // Send on Enter, but not Shift+Enter
            e.preventDefault();
            dataSenderForm.dispatchEvent(new Event('submit', {cancelable: true}));
            clearTimeout(typingTimeout); // also clear timeout on send
             ws.sendWebSocketMessage({
                type: 'typing',
                is_typing: false
            });
        }
    });

    if (backBtn) {
        backBtn.addEventListener("click", () => {
            ui.toggleMobileChatView(false);
        });
    }
}

document.addEventListener("DOMContentLoaded", initialize);