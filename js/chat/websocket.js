import { AUTH_TOKEN } from './api.js';
import {
    handleNewMessage,
    handleEditedMessage,
    handleDeletedMessage,
    handleTypingIndicator,
    showToast,
} from './ui.js';

const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const WEBSOCKET_BASE_URL = `${protocol}://${window.location.host}/ws/chat`;
let webSocket = null;

export function connectWebSocket(conversationId) {
    if (webSocket) {
        webSocket.close();
    }

    const tokenQuery = AUTH_TOKEN ? `?token=${encodeURIComponent(AUTH_TOKEN)}` : '';
    const url = `${WEBSOCKET_BASE_URL}/${conversationId}/${tokenQuery}`;
    webSocket = new WebSocket(url);

    webSocket.onopen = () => {
        console.log(`WebSocket connected for conversation ${conversationId}`);
    };

    webSocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("WebSocket message received:", data);

        switch (data.type) {
            case 'chat.message':
                handleNewMessage(data);
                break;
            case 'message.edited':
                handleEditedMessage(data.message);
                break;
            case 'message.deleted':
                handleDeletedMessage(data.message_id);
                break;
            case 'user.typing':
                handleTypingIndicator(data.user, data.is_typing);
                break;
        }
    };

    webSocket.onclose = () => {
        console.log('WebSocket disconnected.');
    };

    webSocket.onerror = error => {
        console.error('WebSocket error:', error);
        showToast('ارتباط زنده پیام‌رسان قطع شد.', 'error');
    };
}

export function sendWebSocketMessage(message, { silent = false } = {}) {
    if (!isConnected()) {
        console.error('WebSocket is not connected.');
        if (!silent) {
            showToast('ارسال پیام از طریق وب‌سوکت ممکن نشد.', 'error');
        }
        return false;
    }

    webSocket.send(JSON.stringify(message));
    return true;
}

export function isConnected() {
    return Boolean(webSocket && webSocket.readyState === WebSocket.OPEN);
}