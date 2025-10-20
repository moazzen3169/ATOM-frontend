import { getAuthToken } from './api.js';
import { handleNewMessage, handleEditedMessage, handleDeletedMessage, handleTypingIndicator } from './ui.js';

const SOCKET_PATH = '/ws/chat';
let webSocket = null;

function buildWebSocketUrl(conversationId) {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const token = getAuthToken();
    const base = `${protocol}://${window.location.host}${SOCKET_PATH}/${encodeURIComponent(String(conversationId))}/`;

    if (!token) {
        return base;
    }

    const params = new URLSearchParams({ token });
    return `${base}?${params.toString()}`;
}

export function connectWebSocket(conversationId) {
    if (webSocket) {
        try {
            webSocket.close();
        } catch (error) {
            console.warn('Failed to close existing WebSocket connection', error);
        }
    }

    const url = buildWebSocketUrl(conversationId);
    webSocket = new WebSocket(url);

    webSocket.onopen = () => {
        console.log(`WebSocket connected for conversation ${conversationId}`);
    };

    webSocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('WebSocket message received:', data);

            switch (data.type) {
                case 'chat.message':
                    handleNewMessage(data.message || data);
                    break;
                case 'message.edited':
                    handleEditedMessage(data.message);
                    break;
                case 'message.deleted':
                    handleDeletedMessage(
                        data.message_id,
                        data.conversation ?? data.conversation_id ?? data.conversationId ?? null,
                    );
                    break;
                case 'user.typing':
                    handleTypingIndicator(data.user, data.is_typing);
                    break;
                default:
                    console.warn('Unhandled WebSocket message type:', data.type);
            }
        } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
        }
    };

    webSocket.onclose = () => {
        console.log('WebSocket disconnected.');
    };

    webSocket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

export function sendWebSocketMessage(message) {
    if (webSocket && webSocket.readyState === WebSocket.OPEN) {
        webSocket.send(JSON.stringify(message));
        return true;
    }

    console.error('WebSocket is not connected.');
    return false;
}

export function disconnectWebSocket() {
    if (webSocket) {
        try {
            webSocket.close();
        } finally {
            webSocket = null;
        }
    }
}
