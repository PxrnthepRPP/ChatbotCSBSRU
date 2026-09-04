/* ================================================================
   BSRU Student Portal — REST API Client Utility
   ================================================================
   Handles asynchronous HTTP communication with the Spring Boot backend
   (running on port 8080) with automatic JWT Authorization header attachment,
   JSON serialization, and error handling.
   ================================================================ */

export const API_BASE_URL = 'http://localhost:8080/api';

/**
 * Fetch data from the Spring Boot backend REST API.
 * Automatically injects the JWT Bearer token if present.
 * 
 * @param {string} endpoint - API endpoint (e.g. '/students', '/advisors', '/health')
 * @param {string} [method='GET'] - HTTP Method ('GET', 'POST', 'PUT', 'DELETE', etc.)
 * @param {object|string|null} [body=null] - Request payload for POST/PUT/PATCH requests
 * @returns {Promise<any>} Parsed JSON response
 */
export async function fetchAPI(endpoint, method = 'GET', body = null, timeoutMs = 2500) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${API_BASE_URL}${cleanEndpoint}`;

    const headers = {
        'Accept': 'application/json',
    };

    // Auto-inject JWT Bearer Token if available
    const token = localStorage.getItem('bsru_token') || sessionStorage.getItem('bsru_token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const options = {
        method: method.toUpperCase(),
        headers,
        signal: controller.signal,
    };

    if (body && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method)) {
        headers['Content-Type'] = 'application/json';
        options.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    try {
        const response = await fetch(url, options);
        clearTimeout(timer);
        if (!response.ok) {
            const errorText = await response.text().catch(() => response.statusText);
            throw new Error(`HTTP ${response.status} (${response.statusText}): ${errorText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        clearTimeout(timer);
        console.warn(`[fetchAPI Error] ${method} ${url}:`, error.message);
        throw error;
    }
}

/**
 * Authenticate against the backend and save JWT token.
 * 
 * @param {string} username 
 * @param {string} password 
 * @returns {Promise<object>} Login response with JWT token
 */
export async function loginAPI(username, password) {
    const data = await fetchAPI('/auth/login', 'POST', { username, password });
    if (data && data.token) {
        localStorage.setItem('bsru_token', data.token);
        localStorage.setItem('bsru_user', JSON.stringify(data));
    }
    return data;
}

/**
 * Clear JWT authentication tokens on logout.
 */
export function logoutAPI() {
    localStorage.removeItem('bsru_token');
    localStorage.removeItem('bsru_user');
    sessionStorage.removeItem('bsru_token');
}
