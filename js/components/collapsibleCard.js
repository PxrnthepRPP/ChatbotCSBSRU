/* ============================================================
   BSRU Student Portal — Collapsible Card Component
   Provides expand/collapse functionality with state persistence
   in localStorage and smooth UI toggle for Admin Dashboard cards.
   ============================================================ */

const STORAGE_PREFIX = 'bsru_admin_card_collapsed_';

export const ADMIN_DASHBOARD_CARDS = [
    'admin-reg-card',
    'admin-reg-log-card',
    'admin-sections-card',
    'admin-grades-card',
    'admin-status-chart-card',
    'admin-career-list-card',
    'admin-overview-card',
    'admin-analytics-card',
];

/**
 * Check if a card is collapsed from localStorage.
 * @param {string} cardId
 * @returns {boolean}
 */
export function isCardCollapsed(cardId) {
    try {
        return localStorage.getItem(STORAGE_PREFIX + cardId) === 'true';
    } catch (e) {
        return false;
    }
}

/**
 * Persist collapsed state to localStorage.
 * @param {string} cardId
 * @param {boolean} collapsed
 */
export function setCardCollapsed(cardId, collapsed) {
    try {
        if (collapsed) {
            localStorage.setItem(STORAGE_PREFIX + cardId, 'true');
        } else {
            localStorage.removeItem(STORAGE_PREFIX + cardId);
        }
    } catch (e) {}
}

/**
 * Generate HTML for the collapse/expand toggle button.
 * @param {string} cardId
 * @returns {string}
 */
export function renderCardCollapseBtn(cardId) {
    const collapsed = isCardCollapsed(cardId);
    return `
        <button type="button" class="card-collapse-btn ${collapsed ? 'is-collapsed' : ''}" 
                data-card-id="${cardId}" 
                aria-expanded="${!collapsed}" 
                title="${collapsed ? 'คลิกเพื่อขยายเนื้อหา (Expand)' : 'คลิกเพื่อย่อเนื้อหา (Collapse)'}">
            <span class="collapse-label">${collapsed ? 'ขยาย' : 'ย่อ'}</span>
            <svg class="collapse-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="6 9 12 15 18 9"/>
            </svg>
        </button>`;
}

/**
 * Toggle collapse state for a given card.
 * @param {string} cardId
 * @param {boolean|null} forceCollapsed
 */
export function toggleCardCollapse(cardId, forceCollapsed = null) {
    const body = document.getElementById(`${cardId}-body`);
    const btn = document.querySelector(`.card-collapse-btn[data-card-id="${cardId}"]`);
    const header = document.querySelector(`[data-collapse-target="${cardId}"]`)?.closest('.collapsible-card-header');
    if (!body) return;

    const currentlyCollapsed = body.classList.contains('collapsed');
    const nextCollapsed = forceCollapsed !== null ? forceCollapsed : !currentlyCollapsed;

    if (nextCollapsed) {
        body.classList.add('collapsed');
        if (btn) {
            btn.classList.add('is-collapsed');
            btn.setAttribute('aria-expanded', 'false');
            btn.title = 'คลิกเพื่อขยายเนื้อหา (Expand)';
            const label = btn.querySelector('.collapse-label');
            if (label) label.textContent = 'ขยาย';
        }
        if (header) header.classList.add('collapsed');
        setCardCollapsed(cardId, true);
    } else {
        body.classList.remove('collapsed');
        if (btn) {
            btn.classList.remove('is-collapsed');
            btn.setAttribute('aria-expanded', 'true');
            btn.title = 'คลิกเพื่อย่อเนื้อหา (Collapse)';
            const label = btn.querySelector('.collapse-label');
            if (label) label.textContent = 'ย่อ';
        }
        if (header) header.classList.remove('collapsed');
        setCardCollapsed(cardId, false);
    }
}

/**
 * Bind click listeners for card collapse toggle button and header title.
 * @param {HTMLElement} root
 * @param {string} cardId
 */
export function bindCardCollapse(root, cardId) {
    if (!root) return;
    const btn = root.querySelector(`.card-collapse-btn[data-card-id="${cardId}"]`);
    const titleLeft = root.querySelector(`[data-collapse-target="${cardId}"]`);

    const handler = (e) => {
        // Do not trigger collapse if clicking on select, input, or interactive buttons
        if (e.target.closest('select, input, button:not(.card-collapse-btn), a')) return;
        toggleCardCollapse(cardId);
    };

    if (btn) {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleCardCollapse(cardId);
        });
    }
    if (titleLeft) {
        titleLeft.addEventListener('click', handler);
    }
}

/**
 * Expand all admin dashboard cards.
 */
export function expandAllAdminCards() {
    ADMIN_DASHBOARD_CARDS.forEach(id => toggleCardCollapse(id, false));
}

/**
 * Collapse all admin dashboard cards.
 */
export function collapseAllAdminCards() {
    ADMIN_DASHBOARD_CARDS.forEach(id => toggleCardCollapse(id, true));
}
