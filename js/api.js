/* ================================================================
   BSRU Student Portal — REST API Client Utility
   ================================================================
   Handles asynchronous HTTP communication with the Spring Boot backend
   with automatic JWT Authorization header attachment, JSON serialization,
   dynamic base URL resolution, and error handling.
   ================================================================ */

/**
 * Automatically resolve API base URL based on runtime environment.
 * 
 * Logic:
 * 1. Explicit global override: window.__API_BASE_URL__ or window.API_BASE_URL
 * 2. Non-browser / Node.js test environment: process.env.API_BASE_URL || 'http://localhost:8080/api'
 * 3. Browser environment:
 *    - Port 3000 (Docker Nginx reverse proxy) -> '/api'
 *    - HTTPS protocol (production reverse proxy / TLS) -> '/api'
 *    - Direct backend port 8080 -> '/api'
 *    - Port 80 (XAMPP / default HTTP) or custom LAN IP / hostname -> `${protocol}//${hostname}:8080/api`
 * 
 * @returns {string} The resolved base URL for API requests.
 */
export function resolveApiBaseUrl() {
    // 1. Manual override via global variable (for testing or custom deployments)
    if (typeof window !== 'undefined') {
        if (window.__API_BASE_URL__) {
            return window.__API_BASE_URL__;
        }
        if (typeof window.API_BASE_URL === 'string' && window.API_BASE_URL) {
            return window.API_BASE_URL;
        }
    }

    // 2. Non-browser / Node.js runtime fallback
    if (typeof window === 'undefined') {
        if (typeof process !== 'undefined' && process.env && process.env.API_BASE_URL) {
            return process.env.API_BASE_URL;
        }
        return 'http://localhost:8080/api';
    }

    const { protocol, hostname, port } = window.location;

    // 3. Docker Nginx reverse proxy (port 3000) or Production HTTPS or direct backend port (8080)
    if (port === '3000' || protocol === 'https:' || port === '8080') {
        return '/api';
    }

    // 4. XAMPP (port 80 / empty) or LAN IP access -> backend port 8080
    return `${protocol}//${hostname}:8080/api`;
}

export const API_BASE_URL = resolveApiBaseUrl();

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
        // 204 No Content (e.g. DELETE) has no JSON body
        if (response.status === 204) return null;
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

/**
 * Upload a multipart file (e.g. PDF petition attachment) to the REST API.
 * Automatically injects the JWT Bearer token and omits manual Content-Type header
 * so the browser generates the correct multipart boundary.
 * 
 * @param {string} endpoint 
 * @param {FormData} formData 
 * @param {number} [timeoutMs=30000] 
 * @returns {Promise<any>}
 */
export async function uploadFileAPI(endpoint, formData, timeoutMs = 30000) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${API_BASE_URL}${cleanEndpoint}`;

    const headers = {};
    const token = localStorage.getItem('bsru_token') || sessionStorage.getItem('bsru_token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: formData,
            signal: controller.signal,
        });
        clearTimeout(timer);
        if (!response.ok) {
            const errorText = await response.text().catch(() => response.statusText);
            throw new Error(`HTTP ${response.status} (${response.statusText}): ${errorText}`);
        }
        return await response.json();
    } catch (error) {
        clearTimeout(timer);
        console.warn(`[uploadFileAPI Error] POST ${url}:`, error.message);
        throw error;
    }
}

/**
 * Open or download an authenticated PDF attachment in a new browser tab.
 * Uses JWT Bearer token and Blob URL to bypass browser authentication limits.
 * 
 * @param {string} petitionId 
 */
export async function viewPdfAttachmentAPI(petitionId) {
    const cleanId = encodeURIComponent(petitionId);
    const url = `${API_BASE_URL}/petitions/${cleanId}/attachment`;
    const headers = {};
    const token = localStorage.getItem('bsru_token') || sessionStorage.getItem('bsru_token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText);
        throw new Error(`HTTP ${response.status}: ${errText}`);
    }
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
}

