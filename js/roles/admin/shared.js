/* ============================================================
   BSRU Student Portal — Admin shared helpers
   (batch ranges, pagination, API error text)
   ============================================================ */

import { getBatch } from '../../utils.js';
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
