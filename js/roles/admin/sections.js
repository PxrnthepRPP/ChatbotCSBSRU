import { confirmDialog } from '../../components/confirmDialog.js';
import { esc, showToast } from '../../utils.js';
import { fetchAPI } from '../../api.js';
import { apiErrorText, fetchCached, fetchFresh } from './shared.js';
import { attachFormDraft } from '../../components/formDraft.js';
import {
    bindCourseCodeInput, bindInstructorPicker, dayOptionsHTML, isValidCourseCode, formField, instructorPickerHTML, loadAdvisors, readInstructor, timeRangeHTML,
} from '../../components/courseForm.js';

/* ============================================================
   COURSES IN THE SYSTEM — every class section recorded by students,
   teachers or the admin. Nothing waits for approval; the admin keeps
   the data correct: edit a section (the change shows in the timetable
   of every student in it and in the suggestions for later students)
   or delete it.
   ============================================================ */
const SECTION_STATUS = {
    PENDING: { label: 'รอตรวจสอบ', badge: 'badge-amber' },
    APPROVED: { label: 'ใช้งานได้', badge: 'badge-green' },
    REJECTED: { label: 'ปิดใช้งาน', badge: 'badge-red' },
};

/** Status badge of a section (shared with the advisor page) */
export function sectionStatusBadge(section) {
    const st = SECTION_STATUS[section.approvalStatus] || SECTION_STATUS.APPROVED;
    const note = section.reviewNote ? ` title="${esc(section.reviewNote)}"` : '';
    return `<span class="badge ${st.badge}"${note}>${st.label}</span>`;
}

let adminSectionTermFilter = 'all';
let adminSectionSearch = '';
let editingSectionId = null;

export async function renderAdminSectionsCard({ cached = false } = {}) {
    const container = document.getElementById('adminSectionsCard');
    if (!container) return;

    let sections;
    let advisors;
    try {
        [sections, advisors] = await Promise.all([(cached ? fetchCached : fetchFresh)('/sections/mine'), loadAdvisors()]);
    } catch (err) {
        container.innerHTML = `<div class="card"><div class="card-title">📚 รายวิชาในระบบ</div><p style="color:var(--text-muted)">เชื่อมต่อ backend ไม่ได้ จึงยังจัดการรายวิชาไม่ได้</p></div>`;
        return;
    }
    // The dashboard may have re-rendered while waiting for the API
    if (!container.isConnected) return;

    const terms = [...new Set(sections.map(s => `${s.term}/${s.academicYear}`))];
    const q = adminSectionSearch.trim().toLowerCase();
    const shown = sections.filter(s =>
        (adminSectionTermFilter === 'all' || `${s.term}/${s.academicYear}` === adminSectionTermFilter) &&
        (!q || s.courseCode.toLowerCase().includes(q) || (s.courseName || '').toLowerCase().includes(q)
            || (s.instructorName || '').toLowerCase().includes(q)));
    const editing = sections.find(s => s.sectionId === editingSectionId) || null;

    const rows = shown.map(s => `
        <tr data-section-id="${s.sectionId}" ${s.sectionId === editingSectionId ? 'style="background:var(--g-50)"' : ''}>
            <td><span class="badge badge-blue">${esc(s.courseCode)}</span><div style="font-size:0.82rem">${esc(s.courseName)} (${s.credits} หน่วยกิต)</div></td>
            <td>${s.term}/${s.academicYear}</td>
            <td class="hide-mobile">${esc(s.sectionNo)}</td>
            <td>${esc(s.dayName)} ${esc(s.startTime)}–${esc(s.endTime)}</td>
            <td class="hide-mobile">${esc(s.room || '-')}</td>
            <td class="hide-mobile">${esc(s.instructorName || '-')}</td>
            <td>${s.enrolledCount}${s.capacity ? ' / ' + s.capacity : ''}</td>
            <td class="hide-mobile" style="font-size:0.8rem">${esc(s.recordedBy || '-')}</td>
            <td style="white-space:nowrap">
                <div class="action-btns" style="display:inline-flex;align-items:center;gap:6px">
                    <button type="button" class="btn btn-sm btn-ghost sec-edit" title="แก้ไขรายวิชา">✏️ แก้ไข</button>
                    <button type="button" class="btn btn-sm btn-ghost btn-icon sec-delete" title="ลบรายวิชา" aria-label="ลบรายวิชา">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </td>
        </tr>`).join('');

    const option = (value, label, selected) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`;

    const editForm = !editing ? '' : `
        <div class="app-form-panel" id="secEditPanel" style="margin-bottom:16px">
            <div class="app-form-header">
                <div>
                    <div class="app-form-title">แก้ไขรายวิชา ${esc(editing.courseCode)} Sec ${esc(editing.sectionNo)} (${editing.term}/${editing.academicYear})</div>
                    <div class="app-form-subtitle">การแก้ไขจะเปลี่ยนในตารางเรียนของนักศึกษาที่ลงวิชานี้ไว้ ${editing.enrolledCount} คนทันที และใช้เป็นข้อมูลแนะนำให้นักศึกษารุ่นต่อไป</div>
                </div>
                <button type="button" class="btn btn-sm btn-ghost" id="secEditClose" style="padding:4px 10px;font-size:0.8rem">✕ ปิด</button>
            </div>
            <div class="app-form-grid app-form-grid-3col" id="secEditForm">
                ${formField('รหัสวิชา <span class="req">*</span>', `<input type="text" id="secEditCode" class="app-input" value="${esc(editing.courseCode)}">`)}
                ${formField('ชื่อวิชา <span class="req">*</span>', `<input type="text" id="secEditName" class="app-input" value="${esc(editing.courseName)}">`)}
                ${formField('หน่วยกิต <span class="req">*</span>', `<input type="number" id="secEditCredits" class="app-input" min="1" value="${editing.credits}">`)}
                ${formField('Sec <span class="req">*</span>', `<select id="secEditSec" class="app-select">${['D1', 'D2'].map(g => option(g, g, editing.sectionNo)).join('')}</select>`)}
                ${formField('อาจารย์ผู้สอน', instructorPickerHTML('secEdit', advisors, {
                    instructorId: editing.instructorId || '', instructorName: editing.instructorId ? '' : (editing.instructorName || ''),
                }))}
                ${formField('ห้องเรียน', `<input type="text" id="secEditRoom" class="app-input" value="${esc(editing.room || '')}">`)}
                ${formField('วันที่เรียน <span class="req">*</span>', `<select id="secEditDay" class="app-select">${dayOptionsHTML(editing.dayOfWeek)}</select>`)}
                ${formField('เวลาเรียน <span class="req">*</span>', timeRangeHTML('secEdit', editing.startTime, editing.endTime), 'app-form-span-2')}
                ${formField('จำนวนที่นั่ง', `<input type="number" id="secEditCap" class="app-input" min="1" placeholder="เว้นว่าง = ไม่จำกัด" value="${editing.capacity ?? ''}">`)}
            </div>
            <div class="app-form-actions">
                <button class="app-btn-primary" id="secEditSave">บันทึกการแก้ไข</button>
                <button class="app-btn-ghost" id="secEditCancel">ยกเลิก</button>
            </div>
        </div>`;

    container.innerHTML = `
        <div class="card">
            <div class="card-title">📚 รายวิชาในระบบ <span class="badge badge-blue" style="font-size:0.75rem">${sections.length} กลุ่มเรียน</span></div>
            <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px">
                รายวิชาที่นักศึกษา อาจารย์ หรือผู้ดูแลระบบบันทึกไว้ ใช้ได้ทันทีโดยไม่ต้องอนุมัติ ·
                ผู้ดูแลระบบแก้ไขข้อมูลให้ถูกต้องได้ (วัน เวลา ห้อง อาจารย์ จะเปลี่ยนในตารางเรียนของนักศึกษาทุกคนในกลุ่มนั้น) ·
                นักศึกษารุ่นต่อไปจะเห็นวิชาเหล่านี้เป็นตัวเลือกแนะนำตอนลงทะเบียน
            </p>
            ${editForm}
            <div class="batch-filter-bar" style="flex-wrap:wrap;gap:8px;margin-bottom:12px">
                <label>ภาคเรียน</label>
                <select class="batch-select" id="secTermFilter" aria-label="กรองตามภาคเรียน">
                    ${option('all', 'ทุกภาคเรียน', adminSectionTermFilter)}
                    ${terms.map(t => option(t, t, adminSectionTermFilter)).join('')}
                </select>
                <input type="search" class="app-input" id="secSearch" placeholder="ค้นหารหัส/ชื่อวิชา/อาจารย์" value="${esc(adminSectionSearch)}" style="max-width:260px">
                <span class="filter-result-count">แสดง ${shown.length} รายการ</span>
            </div>
            <div class="table-wrap">
                <table class="data-table" id="adminSectionsTable">
                    <thead><tr><th>วิชา</th><th>ภาค</th><th class="hide-mobile">Sec</th><th>วัน-เวลา</th><th class="hide-mobile">ห้อง</th><th class="hide-mobile">อาจารย์</th><th>นักศึกษา</th><th class="hide-mobile">บันทึกโดย</th><th></th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="9" style="text-align:center;color:var(--text-muted)">ไม่มีรายวิชาตามเงื่อนไขที่เลือก</td></tr>'}</tbody>
                </table>
            </div>
        </div>`;

    container.querySelector('#secTermFilter').addEventListener('change', e => {
        adminSectionTermFilter = e.target.value;
        renderAdminSectionsCard({ cached: true });
    });
    let searchTimer = null;
    container.querySelector('#secSearch').addEventListener('input', e => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(async () => {
            adminSectionSearch = e.target.value;
            await renderAdminSectionsCard({ cached: true });
            const box = document.getElementById('secSearch');
            if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
        }, 300);
    });

    if (editing) {
        const panel = container.querySelector('#secEditPanel');
        bindInstructorPicker(panel, 'secEdit');
        bindCourseCodeInput(panel.querySelector('#secEditCode'));
        // Unsaved edits survive closing the panel or leaving the page; cleared once saved
        const sectionDraft = attachFormDraft(panel.querySelector('#secEditForm'), `section:edit:${editing.sectionId}`);
        const close = () => { editingSectionId = null; renderAdminSectionsCard({ cached: true }); };
        panel.querySelector('#secEditClose').addEventListener('click', close);
        panel.querySelector('#secEditCancel').addEventListener('click', close);
        panel.querySelector('#secEditSave').addEventListener('click', async () => {
            const v = (id) => panel.querySelector(`#${id}`).value;
            const teacher = readInstructor(panel, 'secEdit');
            const body = {
                courseCode: v('secEditCode').trim().toUpperCase(),
                courseName: v('secEditName').trim(),
                credits: parseInt(v('secEditCredits'), 10),
                sectionNo: v('secEditSec'),
                dayOfWeek: parseInt(v('secEditDay'), 10),
                startTime: v('secEditStart'),
                endTime: v('secEditEnd'),
                room: v('secEditRoom').trim(),
                instructorId: teacher.instructorId,
                instructorName: teacher.instructorName,
            };
            const cap = v('secEditCap').trim();
            if (cap) body.capacity = parseInt(cap, 10);
            if (!body.courseCode || !body.courseName || !(body.credits > 0) || !body.startTime || !body.endTime) {
                showToast('error', 'กรุณากรอกช่องที่มี * ให้ครบ');
                return;
            }
            if (!isValidCourseCode(body.courseCode)) {
                showToast('error', 'รหัสวิชาใส่ได้เฉพาะภาษาอังกฤษและตัวเลขเท่านั้น เช่น CS3101');
                return;
            }
            if (body.startTime >= body.endTime) {
                showToast('error', 'เวลาสิ้นสุดต้องหลังเวลาเริ่ม');
                return;
            }
            try {
                await fetchAPI(`/sections/${editing.sectionId}`, 'PUT', body, 8000);
                sectionDraft.clear();
                showToast('success', esc(`บันทึกการแก้ไข ${body.courseCode} แล้ว`));
                editingSectionId = null;
                renderAdminSectionsCard();
            } catch (err) {
                showToast('error', esc(apiErrorText(err)));
            }
        });
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    container.querySelectorAll('tr[data-section-id]').forEach(row => {
        const section = sections.find(s => String(s.sectionId) === row.dataset.sectionId);
        const label = `${section.courseCode} Sec ${section.sectionNo} (${section.term}/${section.academicYear})`;

        row.querySelector('.sec-edit').addEventListener('click', () => {
            editingSectionId = section.sectionId;
            renderAdminSectionsCard({ cached: true });
        });

        row.querySelector('.sec-delete').addEventListener('click', async () => {
            const warning = section.enrolledCount > 0
                ? `\nนักศึกษา ${section.enrolledCount} คนที่ลงวิชานี้จะถูกถอนออกจากตารางเรียนด้วย` : '';
            if (!await confirmDialog(`ลบ ${label}?${warning}`)) return;
            try {
                await fetchAPI(`/sections/${section.sectionId}`, 'DELETE', null, 8000);
                showToast('info', esc(`ลบ ${label} แล้ว`));
                if (editingSectionId === section.sectionId) editingSectionId = null;
                renderAdminSectionsCard();
            } catch (err) {
                showToast('error', esc(apiErrorText(err)));
            }
        });
    });
}
