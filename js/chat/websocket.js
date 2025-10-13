import { AUTH_TOKEN } from './api.js';
import { handleNewMessage, handleEditedMessage, handleDeletedMessage, handleTypingIndicator } from './ui.js';

const WEBSOCKET_BASE_URL = `ws://${window.location.host}/ws/chat`;
let webSocket = null;

export function connectWebSocket(conversationId) {
    if (webSocket) {
        webSocket.close();
    }

    const url = `${WEBSOCKET_BASE_URL}/${conversationId}/?token=${AUTH_TOKEN}`;
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
        console.log("WebSocket disconnected.");
    };

    webSocket.onerror = (error) => {
        console.error("WebSocket error:", error);
    };
}

export function sendWebSocketMessage(message) {
    if (webSocket && webSocket.readyState === WebSocket.OPEN) {
        webSocket.send(JSON.stringify(message));
    } else {
        console.error("WebSocket is not connected.");
    }
}