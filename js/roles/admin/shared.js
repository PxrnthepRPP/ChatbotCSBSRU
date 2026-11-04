/* ============================================================
   BSRU Student Portal — Admin shared helpers
   (batch ranges, pagination, API error text)
   ============================================================ */

import { getBatch } from '../../utils.js';
import { fetchAPI } from '../../api.js';
import { MOCK_STUDENTS_POOL } from './mockData.js';

/**
 * Compute active batches for preset ranges (all, last4, active, or single).
 * @param {string} mode
 * @param {string[]} allBatches
 * @param {Array} [pool]
 * @returns {string[]}
 */
export function resolveBatchRange(mode, allBatches, pool = MOCK_STUDENTS_POOL) {
    if (mode === 'all') return allBatches;
    if (mode === 'last4' || mode === 'last3') return allBatches.slice(0, 4);
    if (mode === 'active') {
        return allBatches.filter(b => pool.some(s => getBatch(s.studentId) === b && s.status === 'กำลังศึกษา'));
    }
    return [mode];
}

/**
 * Render pagination page buttons HTML with ellipsis for large page ranges.
 * @param {number} currentPage
 * @param {number} totalPages
 * @param {string} btnClass
 * @returns {string}
 */
export function renderPaginationPagesHtml(currentPage, totalPages, btnClass = 'pagination-page-btn') {
    if (totalPages <= 1) return `<button class="${btnClass} active" data-page="1">1</button>`;
    const pages = [];
    pages.push(1);
    let start = Math.max(2, currentPage - 1);
    let end = Math.min(totalPages - 1, currentPage + 1);

    if (start > 2) pages.push('...');
    for (let i = start; i <= end; i++) {
        pages.push(i);
    }
    if (end < totalPages - 1) pages.push('...');
    if (totalPages > 1 && !pages.includes(totalPages)) pages.push(totalPages);

    return pages.map(p => {
        if (p === '...') return `<span class="pagination-ellipsis">…</span>`;
        const isActive = p === currentPage;
        return `<button class="${btnClass} ${isActive ? 'active' : ''}" data-page="${p}">${p}</button>`;
    }).join('');
}

/** Pull the backend message out of a fetchAPI error ('HTTP 400 (...): {"error":"..."}') */
export function apiErrorText(err) {
    const match = /\{.*\}$/s.exec(err.message || '');
    if (match) {
        try { return JSON.parse(match[0]).error || err.message; } catch (e) { /* not JSON */ }
    }
    return err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
}

/* ── Short-lived GET cache for dashboard cards ──
   renderAdminDashboard() runs again on every filter change and after edits, and each run
   re-rendered three cards that re-fetched data unrelated to the filter. Cards opened from the
   dashboard read through this (same request in flight = same promise, reused for maxAgeMs);
   a card that just changed data calls fetchFresh() so the cache never shows stale rows. */
const getCache = new Map();   // path -> { at, promise }

export function fetchCached(path, maxAgeMs = 30000) {
    const hit = getCache.get(path);
    if (hit && Date.now() - hit.at < maxAgeMs) return hit.promise;
    return fetchFresh(path);
}

export function fetchFresh(path) {
    const promise = fetchAPI(path);
    getCache.set(path, { at: Date.now(), promise });
    promise.catch(() => getCache.delete(path));   // never cache a failure
    return promise;
}
