/* ================================================================
   BSRU Student Portal — Notification Center Component (WP-5)
   ================================================================
   Provides real-time bell badge, dropdown notifications,
   visibility-aware 60-second polling, read status management,
   and dynamic module navigation.
   ================================================================ */

import { fetchAPI } from '../api.js';
import { getState, setState } from '../state.js';
import { esc } from '../utils.js';

let _notifications = [];
let _unreadCount = 0;
let _pollingTimer = null;
let _isOpen = false;
let _isInitialized = false;

const POLLING_INTERVAL_MS = 60000; // 60 seconds

/**
 * Format timestamp into relative Thai time representation.
 * @param {string|number|Date} dateVal 
 * @returns {string}
 */
export function formatRelativeTime(dateVal) {
    if (!dateVal) return '';
    const date = new Date(dateVal);
    if (isNaN(date.getTime())) return String(dateVal);

    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'เมื่อสักครู่';
    if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
    if (diffHr < 24) return `${diffHr} ชั่วโมงที่แล้ว`;
    if (diffDay < 7) return `${diffDay} วันที่แล้ว`;

    const day = date.getDate().toString().padStart(2, '0');
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const month = months[date.getMonth()];
    const yearBE = date.getFullYear() + 543;
    const hours = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');
    return `${day} ${month} ${yearBE} ${hours}:${mins}`;
}

/**
 * Get icon SVG template based on notification type.
 * @param {string} type 
 * @returns {string}
 */
function getNotificationIcon(type) {
    const norm = (type || 'SYSTEM').toUpperCase();
    switch (norm) {
        case 'PETITION':
            return `
                <div class="notif-item-icon-wrap notif-icon-petition">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                </div>`;
        case 'REGISTRATION':
            return `
                <div class="notif-item-icon-wrap notif-icon-registration">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                        <polyline points="9 16 12 19 16 14"></polyline>
                    </svg>
                </div>`;
        case 'ADVISING':
            return `
                <div class="notif-item-icon-wrap notif-icon-advising">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                </div>`;
        case 'GRADE':
            return `
                <div class="notif-item-icon-wrap notif-icon-grade">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="8" r="7"></circle>
                        <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
                    </svg>
                </div>`;
        default:
            return `
                <div class="notif-item-icon-wrap notif-icon-system">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                </div>`;
    }
}

/**
 * Fetch latest notifications from backend and update UI.
 * Alias: fetchNotifications(silent)
 * @param {boolean} silent 
 */
export async function fetchNotifications(silent = false) {
    const auth = getState();
    if (!auth?.user && !localStorage.getItem('bsru_token') && !sessionStorage.getItem('bsru_token')) {
        return;
    }

    try {
        const data = await fetchAPI('/notifications', 'GET', null, 5000);
        const list = Array.isArray(data) ? data : (data?.notifications || []);
        const unread = typeof data?.unreadCount === 'number'
            ? data.unreadCount
            : list.filter(n => !n.isRead).length;

        _notifications = list;
        _unreadCount = unread;
        renderNotifications();
    } catch (err) {
        if (!silent) {
            console.warn('[Notifications] Fetch warning:', err.message);
        }
    }
}

export const refreshNotifications = fetchNotifications;

/**
 * Render notification badge and dropdown UI.
 */
export function renderNotifications() {
    renderBadge();
    renderDropdownList();
}

/**
 * Render red counter badge on the topbar bell icon.
 */
function renderBadge() {
    const badge = document.getElementById('notifBadge');
    const headerCount = document.getElementById('notifHeaderUnreadCount');
    const markAllBtn = document.getElementById('notifMarkAllBtn') || document.getElementById('notifReadAllBtn');

    if (badge) {
        if (_unreadCount > 0) {
            badge.textContent = _unreadCount > 99 ? '99+' : String(_unreadCount);
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    }

    if (headerCount) {
        headerCount.textContent = _unreadCount > 0 ? `(${_unreadCount})` : '';
    }

    if (markAllBtn) {
        markAllBtn.disabled = _unreadCount === 0;
    }
}

/**
 * Render notification items inside the dropdown list.
 */
function renderDropdownList() {
    const listEl = document.getElementById('notifList');
    if (!listEl) return;

    if (!_notifications || _notifications.length === 0) {
        listEl.innerHTML = `
            <div class="notif-empty">
                <svg class="notif-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <div class="notif-empty-text">ไม่มีการแจ้งเตือนในขณะนี้</div>
            </div>`;
        return;
    }

    listEl.innerHTML = _notifications.map(item => {
        const isRead = Boolean(item.isRead);
        const timeStr = formatRelativeTime(item.createdAt);
        const iconSvg = getNotificationIcon(item.type);
        const targetMod = esc(item.targetModule || '');

        return `
            <div class="notif-item ${isRead ? 'read' : 'unread'}"
                 data-id="${item.id}"
                 data-target="${targetMod}"
                 role="listitem"
                 tabindex="0">
                ${!isRead ? '<span class="notif-unread-dot"></span>' : ''}
                ${iconSvg}
                <div class="notif-item-content">
                    <div class="notif-item-title">${esc(item.title || 'การแจ้งเตือน')}</div>
                    <div class="notif-item-msg">${esc(item.message || '')}</div>
                    <div class="notif-item-time">${timeStr}</div>
                </div>
            </div>`;
    }).join('');

    // Attach click listeners to notification rows
    listEl.querySelectorAll('.notif-item').forEach(el => {
        el.addEventListener('click', () => handleItemClick(el));
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleItemClick(el);
            }
        });
    });
}

/**
 * Mark a single notification as read by ID.
 * @param {string|number} id 
 */
export async function markAsRead(id) {
    const item = _notifications.find(n => String(n.id) === String(id));
    if (item && !item.isRead) {
        item.isRead = true;
        if (_unreadCount > 0) _unreadCount--;
        renderNotifications();
    }
    try {
        await fetchAPI(`/notifications/${encodeURIComponent(id)}/read`, 'PATCH');
    } catch (err) {
        console.warn('[Notifications] Failed to mark read on server:', err.message);
    }
}

/**
 * Handle notification item click: mark read and navigate.
 * @param {HTMLElement} el 
 */
async function handleItemClick(el) {
    const id = el.dataset.id;
    const targetModule = el.dataset.target;

    // Mark as read if currently unread
    if (el.classList.contains('unread')) {
        el.classList.remove('unread');
        el.classList.add('read');
        const dot = el.querySelector('.notif-unread-dot');
        if (dot) dot.remove();

        const item = _notifications.find(n => String(n.id) === String(id));
        if (item) item.isRead = true;
        if (_unreadCount > 0) _unreadCount--;
        renderBadge();

        try {
            await fetchAPI(`/notifications/${encodeURIComponent(id)}/read`, 'PATCH');
        } catch (err) {
            console.warn('[Notifications] Failed to mark read on server:', err.message);
        }
    }

    closeDropdown();

    // Navigate to target module if specified
    if (targetModule) {
        const resolvedModule = targetModule === 'advisor-petitions' ? 'my-advisees' : targetModule;
        setState({ activeModule: resolvedModule });
        if (typeof window.closeMobileSidebar === 'function') {
            window.closeMobileSidebar();
        }
    }
}

/**
 * Mark all notifications as read.
 */
export async function markAllAsRead() {
    if (_unreadCount === 0) return;

    _notifications.forEach(n => { n.isRead = true; });
    _unreadCount = 0;
    renderNotifications();

    try {
        await fetchAPI('/notifications/read-all', 'POST');
    } catch (err) {
        console.warn('[Notifications] Failed to mark all read on server:', err.message);
        await fetchNotifications(true);
    }
}

/**
 * Toggle notification dropdown visibility.
 */
export function toggleDropdown() {
    _isOpen ? closeDropdown() : openDropdown();
}

export function openDropdown() {
    const dropdown = document.getElementById('notifDropdown');
    const bellBtn = document.getElementById('notifBellBtn');
    if (!dropdown || !bellBtn) return;

    _isOpen = true;
    dropdown.style.display = 'block';
    bellBtn.setAttribute('aria-expanded', 'true');
    renderDropdownList();
}

export function closeDropdown() {
    const dropdown = document.getElementById('notifDropdown');
    const bellBtn = document.getElementById('notifBellBtn');
    if (!dropdown || !bellBtn) return;

    _isOpen = false;
    dropdown.style.display = 'none';
    bellBtn.setAttribute('aria-expanded', 'false');
}

/**
 * Document click handler to dismiss dropdown when clicking outside.
 */
function handleDocumentClick(e) {
    if (!_isOpen) return;
    const container = document.getElementById('notifContainer');
    if (container && !container.contains(e.target)) {
        closeDropdown();
    }
}

/**
 * Visibility change handler for tab refocus.
 */
function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
        fetchNotifications(true);
    }
}

/**
 * Initialize the Notification Center component.
 */
export function initNotifications() {
    const bellBtn = document.getElementById('notifBellBtn');
    const markAllBtn = document.getElementById('notifMarkAllBtn') || document.getElementById('notifReadAllBtn');

    if (!bellBtn) return;

    if (!_isInitialized) {
        bellBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDropdown();
        });

        if (markAllBtn) {
            markAllBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                markAllAsRead();
            });
        }

        document.addEventListener('click', handleDocumentClick);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && _isOpen) closeDropdown();
        });

        _isInitialized = true;
    }

    // Immediate initial fetch
    fetchNotifications(true);

    // Setup 60s visibility-aware polling
    if (_pollingTimer) clearInterval(_pollingTimer);
    _pollingTimer = setInterval(() => {
        if (document.visibilityState === 'visible') {
            fetchNotifications(true);
        }
    }, POLLING_INTERVAL_MS);
}

/**
 * Stop polling and clear notification state (on logout).
 */
export function clearNotifications() {
    if (_pollingTimer) {
        clearInterval(_pollingTimer);
        _pollingTimer = null;
    }
    _notifications = [];
    _unreadCount = 0;
    _isOpen = false;
    closeDropdown();
    renderBadge();
    const listEl = document.getElementById('notifList');
    if (listEl) listEl.innerHTML = '';
}

/**
 * Expose unread count query for external consumers.
 */
export function getUnreadCount() {
    return _unreadCount;
}
