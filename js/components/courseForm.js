/* ============================================================
   BSRU Student Portal — shared pieces of the course form
   (student self-registration and the admin's section editor)
   Day = a list Monday–Sunday, time = a start–end range with minutes,
   teacher = pick from the advisors in the system or type a name.
   ============================================================ */

import { esc } from '../utils.js';
import { fetchAPI } from '../api.js';

export const DAY_NAMES_TH = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
const OTHER = '__other';

export function formField(label, control, extraClass = '') {
    return `
        <div class="app-form-group ${extraClass}">
            <label class="app-form-label">${label}</label>
            ${control}
        </div>`;
}

export function dayOptionsHTML(selected = 0) {
    return DAY_NAMES_TH.map((d, i) => `<option value="${i}" ${Number(selected) === i ? 'selected' : ''}>${d}</option>`).join('');
}

/** "09:00 น. ถึง 11:30 น." — two time inputs; step 60 = minutes can be anything */
export function timeRangeHTML(idPrefix, start = '', end = '') {
    return `
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <input type="time" step="60" id="${idPrefix}Start" class="app-input" style="flex:1;min-width:110px" value="${esc(start)}" aria-label="เวลาเริ่ม">
            <span style="color:var(--text-muted)">ถึง</span>
            <input type="time" step="60" id="${idPrefix}End" class="app-input" style="flex:1;min-width:110px" value="${esc(end)}" aria-label="เวลาสิ้นสุด">
        </div>`;
}

/** Course codes: English letters and digits only, stored upper-case (same rule as the backend) */
export const COURSE_CODE_MAX = 20;
export const isValidCourseCode = (code) => /^[A-Z0-9]{1,20}$/.test(code || '');

/**
 * Keep a course-code box to A-Z / 0-9 while typing: lower case becomes upper case, anything else
 * (Thai letters, spaces, symbols) is removed and a short warning shows under the box.
 */
export function bindCourseCodeInput(input) {
    if (!input) return;
    input.setAttribute('maxlength', String(COURSE_CODE_MAX));
    input.setAttribute('inputmode', 'latin');
    input.setAttribute('autocapitalize', 'characters');
    const hint = document.createElement('div');
    hint.className = 'app-field-error';
    hint.textContent = 'รหัสวิชาใส่ได้เฉพาะภาษาอังกฤษ (A-Z) และตัวเลข (0-9) เท่านั้น';
    input.insertAdjacentElement('afterend', hint);
    let hideTimer = null;
    const clean = () => {
        const upper = input.value.toUpperCase();
        const cleaned = upper.replace(/[^A-Z0-9]/g, '').slice(0, COURSE_CODE_MAX);
        if (cleaned !== upper) {
            hint.classList.add('visible');
            clearTimeout(hideTimer);
            hideTimer = setTimeout(() => hint.classList.remove('visible'), 3000);
        }
        if (cleaned !== input.value) input.value = cleaned;
    };
    input.addEventListener('input', (e) => { if (!e.isComposing) clean(); });
    input.addEventListener('compositionend', clean);
}

let advisorsPromise = null;

/** Advisors in the system, fetched once per page load (empty list when the backend is offline) */
export function loadAdvisors() {
    if (!advisorsPromise) {
        advisorsPromise = fetchAPI('/advisors', 'GET', null, 8000)
            .then(list => (Array.isArray(list) ? list : []).sort((a, b) => (a.nameTh || '').localeCompare(b.nameTh || '', 'th')))
            .catch(() => { advisorsPromise = null; return []; });
    }
    return advisorsPromise;
}

/** A select of advisors plus "other, type the name", and the text box for that name */
export function instructorPickerHTML(idPrefix, advisors, { instructorId = '', instructorName = '' } = {}) {
    const typed = !instructorId && !!instructorName;
    const options = advisors.map(a =>
        `<option value="${esc(a.id)}" ${a.id === instructorId ? 'selected' : ''}>${esc(a.nameTh || a.id)}</option>`).join('');
    return `
        <select id="${idPrefix}Teacher" class="app-select">
            <option value="" ${!instructorId && !typed ? 'selected' : ''}>— เลือกอาจารย์ผู้สอน —</option>
            ${options}
            <option value="${OTHER}" ${typed ? 'selected' : ''}>อื่น ๆ (พิมพ์ชื่อเอง)</option>
        </select>
        <input type="text" id="${idPrefix}TeacherName" class="app-input" placeholder="พิมพ์ชื่ออาจารย์ผู้สอน"
               style="margin-top:6px;display:${typed ? 'block' : 'none'}" value="${esc(typed ? instructorName : '')}">`;
}

export function bindInstructorPicker(root, idPrefix) {
    const select = root.querySelector(`#${idPrefix}Teacher`);
    const name = root.querySelector(`#${idPrefix}TeacherName`);
    select?.addEventListener('change', () => {
        name.style.display = select.value === OTHER ? 'block' : 'none';
        if (select.value === OTHER) name.focus();
    });
}

/** Pick an advisor by id, or fall back to typing the name */
export function setInstructor(root, idPrefix, { instructorId, instructorName }) {
    const select = root.querySelector(`#${idPrefix}Teacher`);
    const name = root.querySelector(`#${idPrefix}TeacherName`);
    if (!select) return;
    const known = instructorId && [...select.options].some(o => o.value === instructorId);
    select.value = known ? instructorId : (instructorName ? OTHER : '');
    name.value = known ? '' : (instructorName || '');
    name.style.display = select.value === OTHER ? 'block' : 'none';
}

/** { instructorId, instructorName } — exactly one is filled, or both empty when nothing was chosen */
export function readInstructor(root, idPrefix) {
    const value = root.querySelector(`#${idPrefix}Teacher`)?.value || '';
    if (value === OTHER) {
        return { instructorId: '', instructorName: root.querySelector(`#${idPrefix}TeacherName`).value.trim() };
    }
    return { instructorId: value, instructorName: '' };
}
