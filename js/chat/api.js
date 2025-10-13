// This module will handle all API requests to the server.
export const API_BASE_URL = '/api/chat';
export const AUTH_TOKEN = localStorage.getItem('jwt_token');

/**
 * Fetches all conversations for the current user.
 */
export async function getConversations() {
    const url = `${API_BASE_URL}/conversations/`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
            'Content-Type': 'application/json'
        }
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

// Placeholder for fetching current user info
export async function getCurrentUser() {
    // In a real app, this would fetch from '/api/users/me/' or similar
    return { id: 1, username: 'currentUser' };
}

/**
 * Creates a new conversation with a list of participants.
 * @param {number[]} participantIds Array of participant user IDs.
 */
export async function createConversation(participantIds) {
    const url = `${API_BASE_URL}/conversations/`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ participants: participantIds })
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

/**
 * Deletes a conversation.
 * @param {number} conversationId The ID of the conversation to delete.
 */
export async function deleteConversation(conversationId) {
    const url = `${API_BASE_URL}/conversations/${conversationId}/`;
    const response = await fetch(url, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`
        }
    });
    if (response.status !== 204 && !response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
}

/**
 * Fetches all messages for a specific conversation.
 * @param {number} conversationId The ID of the conversation.
 */
export async function getMessages(conversationId) {
    const url = `${API_BASE_URL}/conversations/${conversationId}/messages/`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
            'Content-Type': 'application/json'
        }
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

/**
 * Sends a new message to a conversation via REST API (fallback).
 * @param {number} conversationId The ID of the conversation.
 * @param {string} content The message content.
 */
export async function sendMessage(conversationId, content) {
    const url = `${API_BASE_URL}/conversations/${conversationId}/messages/`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

/**
 * Uploads a file attachment to a message.
 * @param {number} conversationId
 * @param {number} messageId
 * @param {FormData} formData
 */
export async function uploadAttachment(conversationId, messageId, formData) {
    const url = `${API_BASE_URL}/conversations/${conversationId}/messages/${messageId}/attachments/`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
        },
        body: formData,
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}