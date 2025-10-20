// This module handles all API requests to the server for the chat feature.
import { createAuthApiClient, API_ENDPOINTS } from '../services/api-client.js';

const CHAT_API_ENDPOINTS = {
    conversations: '/api/conversations/',
    messages: (conversationId) => `/api/conversations/${encodeURIComponent(String(conversationId))}/messages/`,
    attachments: (conversationId, messageId) => `/api/conversations/${encodeURIComponent(String(conversationId))}/messages/${encodeURIComponent(String(messageId))}/attachments/`,
};

const apiClient = createAuthApiClient();

export function getAuthToken() {
    return apiClient.getAccessToken?.() || null;
}

/**
 * Fetches all conversations for the current user.
 */
export async function getConversations() {
    const response = await apiClient.fetchJson(CHAT_API_ENDPOINTS.conversations, {
        method: 'GET',
    });

    if (Array.isArray(response)) {
        return response;
    }

    if (response && Array.isArray(response.results)) {
        return response.results;
    }

    return [];
}

export async function getCurrentUser() {
    return await apiClient.fetchJson(API_ENDPOINTS.users.me, {
        method: 'GET',
    });
}

/**
 * Creates a new conversation with a list of participants.
 * @param {number[]} participantIds Array of participant user IDs.
 */
export async function createConversation(participantIds) {
    return await apiClient.fetchJson(CHAT_API_ENDPOINTS.conversations, {
        method: 'POST',
        body: { participants: participantIds },
    });
}

/**
 * Deletes a conversation.
 * @param {number} conversationId The ID of the conversation to delete.
 */
export async function deleteConversation(conversationId) {
    const response = await apiClient.fetch(`${CHAT_API_ENDPOINTS.conversations}${encodeURIComponent(String(conversationId))}/`, {
        method: 'DELETE',
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
    const response = await apiClient.fetchJson(CHAT_API_ENDPOINTS.messages(conversationId), {
        method: 'GET',
    });

    if (Array.isArray(response)) {
        return response;
    }

    if (response && Array.isArray(response.results)) {
        return response.results;
    }

    return [];
}

/**
 * Sends a new message to a conversation via REST API (fallback).
 * @param {number} conversationId The ID of the conversation.
 * @param {string} content The message content.
 */
export async function sendMessage(conversationId, content) {
    return await apiClient.fetchJson(CHAT_API_ENDPOINTS.messages(conversationId), {
        method: 'POST',
        body: { content },
    });
}

/**
 * Uploads a file attachment to a message.
 * @param {number} conversationId
 * @param {number} messageId
 * @param {FormData} formData
 */
export async function uploadAttachment(conversationId, messageId, formData) {
    const response = await apiClient.fetch(CHAT_API_ENDPOINTS.attachments(conversationId, messageId), {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const text = await response.text();
    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch (_error) {
        return text;
    }
}

export async function searchUsers(query) {
    const trimmedQuery = query?.trim();
    if (!trimmedQuery) {
        return [];
    }

    const response = await apiClient.fetchJson(API_ENDPOINTS.users.search, {
        method: 'GET',
        query: { search: trimmedQuery, limit: 10 },
    });

    if (!response) {
        return [];
    }

    if (Array.isArray(response)) {
        return response;
    }

    if (Array.isArray(response.results)) {
        return response.results;
    }

    return [];
}
