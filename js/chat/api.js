// ماژول مخصوص فراخوانی‌های API مرتبط با بخش گفتگو
export const API_BASE_URL = '/api/chat';
export const AUTH_TOKEN = localStorage.getItem('jwt_token');

export class ApiError extends Error {
    constructor(message, { status, detail } = {}) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.detail = detail;
    }
}

const JSON_HEADERS = {
    'Accept': 'application/json'
};

function buildHeaders(customHeaders = {}, body) {
    const headers = new Headers({ ...JSON_HEADERS, ...customHeaders });

    if (AUTH_TOKEN) {
        headers.set('Authorization', `Bearer ${AUTH_TOKEN}`);
    } else {
        headers.delete('Authorization');
    }

    if (!(body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    return headers;
}

async function request(path, { method = 'GET', body = null, headers = {} } = {}) {
    let response;

    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            method,
            headers: buildHeaders(headers, body),
            body: body instanceof FormData ? body : body ? JSON.stringify(body) : null,
        });
    } catch (networkError) {
        throw new Error('ارتباط با سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید.');
    }

    if (!response.ok) {
        let detail = response.statusText;
        try {
            const data = await response.json();
            detail = data?.detail || data?.message || detail;
        } catch (error) {
            // بدنه خطا json نبود
        }
        throw new ApiError(
            `خطا در ارتباط با سرور (${response.status}): ${detail}`,
            { status: response.status, detail }
        );
    }

    if (response.status === 204) {
        return null;
    }

    try {
        return await response.json();
    } catch (error) {
        return null;
    }
}

async function requestWithFallback(paths, options) {
    let lastError;

    for (const path of paths) {
        try {
            return await request(path, options);
        } catch (error) {
            if (error instanceof ApiError && [404, 405].includes(error.status)) {
                lastError = error;
                continue;
            }
            throw error;
        }
    }

    if (lastError) {
        throw lastError;
    }

    return null;
}

export async function getConversations() {
    return requestWithFallback(['/conversations/', '/conversations']);
}

export async function getCurrentUser() {
    const cachedProfile = localStorage.getItem('current_user');
    if (cachedProfile) {
        try {
            return JSON.parse(cachedProfile);
        } catch (error) {
            console.warn('Could not parse cached user profile:', error);
        }
    }

    return {
        id: 0,
        username: 'کاربر',
        profile_picture: '/img/profile.jpg'
    };
}

export async function createConversation(participantIds) {
    return requestWithFallback(['/conversations/', '/conversations'], {
        method: 'POST',
        body: { participants: participantIds }
    });
}

export async function deleteConversation(conversationId) {
    await requestWithFallback(
        [`/conversations/${conversationId}/`, `/conversations/${conversationId}`],
        { method: 'DELETE' }
    );
}

export async function getMessages(conversationId) {
    return requestWithFallback(
        [`/conversations/${conversationId}/messages/`, `/conversations/${conversationId}/messages`]
    );
}

export async function sendMessage(conversationId, content) {
    return requestWithFallback(
        [`/conversations/${conversationId}/messages/`, `/conversations/${conversationId}/messages`],
        {
            method: 'POST',
            body: { content }
        }
    );
}

export async function uploadAttachment(conversationId, messageId, formData) {
    return requestWithFallback(
        [
            `/conversations/${conversationId}/messages/${messageId}/attachments/`,
            `/conversations/${conversationId}/messages/${messageId}/attachments`
        ],
        {
            method: 'POST',
            body: formData,
            headers: {
                // در زمان ارسال فرم دیتا نیازی به تعیین type نیست
            }
        }
    );
}
