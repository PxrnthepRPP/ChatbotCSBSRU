/* ================================================================
   BSRU Student Portal — Utilities
   ================================================================ */

import { viewPdfAttachmentAPI } from './api.js';
if (typeof window !== 'undefined') {
    window.viewPdfAttachment = viewPdfAttachmentAPI;
}

export function esc(str) { 
    const d = document.createElement('div'); 
    d.textContent = str; 
    return d.innerHTML; 
}

export function fmt(n) { 
    return (n || 0).toLocaleString('th-TH'); 
}

export function gradeClass(g) {
    if (!g) return '';
    if (g === 'A' || g === 'A-') return 'grade-a';
    if (g.startsWith('B')) return 'grade-b';
    if (g.startsWith('C')) return 'grade-c';
    return g.startsWith('D') || g === 'F' ? 'grade-d' : '';
}

export function statusBadge(s) {
    if (s === 'ผ่าน' || s === 'ชำระแล้ว' || s === 'กำลังศึกษา' || s === 'อนุมัติ') return 'badge-green';
    if (s === 'รอตรวจสอบ' || s === 'ลงทะเบียนแล้ว' || s === 'รอดำเนินการ' || s === 'รออาจารย์ที่ปรึกษาพิจารณา') return 'badge-amber';
    if (s === 'รอผู้ดูแลระบบอนุมัติ' || s === 'จบการศึกษา') return 'badge-blue';
    if (s === 'ค้างชำระ' || s === 'พักการศึกษา' || s === 'ปฏิเสธ' || s === 'ไม่อนุมัติ' || s === 'พ้นสภาพ') return 'badge-red';
    return 'badge-purple';
}

export function getBatch(studentId) { 
    return studentId ? studentId.substring(0, 2) : ''; 
}

/**
 * Creates a debounced function that delays invoking `func` until after `delay` milliseconds
 * have elapsed since the last time the debounced function was invoked.
 * 
 * @param {Function} func The function to debounce.
 * @param {number} delay The number of milliseconds to delay.
 * @returns {Function} Returns the new debounced function.
 */
export function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

/**
 * Display a floating Toast notification across any view/role.
 * 
 * @param {'success'|'error'|'info'} type 
 * @param {string} message 
 */
export function showToast(type, message) {
    const existing = document.querySelector('.petition-toast');
    if (existing) existing.remove();

    const icons = {
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };

    const toast = document.createElement('div');
    toast.className = `petition-toast petition-toast-${type}`;
    toast.innerHTML = `
        <div class="petition-toast-icon">${icons[type] || icons.info}</div>
        <span class="petition-toast-msg">${message}</span>
        <button class="petition-toast-close" aria-label="ปิด">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
    `;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('visible'));

    toast.querySelector('.petition-toast-close').addEventListener('click', () => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    });

    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }
    }, 4500);
}

export { fetchAPI, uploadFileAPI, viewPdfAttachmentAPI, API_BASE_URL, loginAPI, logoutAPI } from './api.js';

