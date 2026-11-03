/* ============================================================
   BSRU Student Portal — Advisor: Courses I teach (class sections)
   & Exam Announcements
   ============================================================ */

import { confirmDialog } from '../../components/confirmDialog.js';
import { esc, fetchAPI } from '../../utils.js';
import { apiErrorText, sectionStatusBadge } from '../admin.js';
import { getAuthState } from '../../auth.js';
import { showAdvisorToast } from './ui.js';
import { openSectionStudentsModal } from './sectionRoster.js';

/* ============================================================
   MOCK DATA — Advisor's Courses & Exam Announcements
   ============================================================ */
export const MOCK_ADVISOR_COURSES = [
    { code: 'SC17351', name: 'Object-Oriented Programming', nameTh: 'การเขียนโปรแกรมเชิงวัตถุ' },
    { code: 'SC17411', name: 'Web Development', nameTh: 'การพัฒนาเว็บ' },
    { code: 'SC17402', name: 'Software Engineering', nameTh: 'วิศวกรรมซอฟต์แวร์' },
];

export const MOCK_EXAM_ANNOUNCEMENTS = [
    { code: 'SC17351', name: 'การเขียนโปรแกรมเชิงวัตถุ', date: '18 มี.ค. 2569', time: '09:00-12:00', room: 'HALL-A', announcedBy: getAuthState().user?.displayName || 'อาจารย์ผู้สอน', announcedAt: '1 มี.ค. 2569' },
    { code: 'SC17411', name: 'การพัฒนาเว็บ', date: '20 มี.ค. 2569', time: '13:00-16:00', room: 'HALL-B', announcedBy: 'ผศ.ดร.วิชัย เทคโนโลยี', announcedAt: '1 มี.ค. 2569' },
];

/* ============================================================
   ADVISOR — Course Management & Exam Announcements
   ============================================================ */
const DAY_NAMES_TH = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

/** One entry per course code, for the exam announcement form */
function uniqueCourses(sections) {
    const byCode = new Map();
    sections.forEach(s => { if (!byCode.has(s.courseCode)) byCode.set(s.courseCode, { code: s.courseCode, nameTh: s.courseName }); });
    return [...byCode.values()];
}

export async function renderAdvisorCourses() {
    const container = document.getElementById('advisorCoursesContent');
    if (!container) return;

    // Real sections from the backend; null = backend offline, fall back to the demo course list
    let sections = null;
    try {
        sections = await fetchAPI('/sections/mine');
    } catch (err) {
        sections = null;
    }
    const courseList = sections ? uniqueCourses(sections) : MOCK_ADVISOR_COURSES;

    // Build exam announcements table
    const examRows = MOCK_EXAM_ANNOUNCEMENTS.map((ex, i) => `
        <tr>
            <td><span class="badge badge-blue">${esc(ex.code)}</span></td>
            <td>${esc(ex.name)}</td>
            <td>${esc(ex.date)}</td>
            <td class="hide-mobile">${esc(ex.time)}</td>
            <td class="hide-mobile">${esc(ex.room)}</td>
            <td><span class="badge badge-green">ประกาศแล้ว</span></td>
            <td>
                <button class="btn btn-sm btn-ghost btn-icon adv-del-exam" data-idx="${i}" title="ยกเลิก" aria-label="ยกเลิก">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                </button>
            </td>
        </tr>
    `).join('');

    // Build course options for exam form
    const courseOptions = courseList.map(c =>
        `<option value="${esc(c.code)}">${esc(c.code)} — ${esc(c.nameTh)}</option>`
    ).join('');

    container.innerHTML = `
        <!-- ═══ Section 1: Class sections I teach ═══ -->
        ${sections ? sectionsCardHtml(sections) : offlineCoursesCardHtml()}

        <!-- ═══ Section 2: Exam Announcements ═══ -->
        <div class="card">
            <div class="card-title" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
                <span>📝 ประกาศตารางสอบ <span class="badge badge-green" style="font-size:0.75rem">${MOCK_EXAM_ANNOUNCEMENTS.length} รายการ</span></span>
                <button class="btn btn-sm btn-orange" id="advToggleAddExam" ${courseList.length === 0 ? 'disabled title="เพิ่มรายวิชาก่อน"' : ''}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    ประกาศสอบ
                </button>
            </div>

            <!-- Add Exam Form (hidden by default) -->
            <div id="advAddExamForm" style="display:none" class="app-form-panel">
                <div class="app-form-header">
                    <div>
                        <div class="app-form-title">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                            ประกาศตารางสอบใหม่ (Announce Exam)
                        </div>
                        <div class="app-form-subtitle">ตารางสอบจะเชื่อมโยงไปยังนักศึกษาที่ลงทะเบียนวิชานี้อัตโนมัติ</div>
                    </div>
                    <button type="button" class="btn btn-sm btn-ghost" id="advCloseExamFormBtn" style="padding:4px 10px;font-size:0.8rem">✕ ปิด</button>
                </div>

                <div class="app-form-grid">
                    <div class="app-form-group">
                        <label class="app-form-label">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                            เลือกวิชา <span class="req">*</span>
                        </label>
                        <select id="advExamCourseSelect" class="app-select">${courseOptions}</select>
                    </div>
                    <div class="app-form-group">
                        <label class="app-form-label">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            วันสอบ <span class="req">*</span>
                        </label>
                        <input type="date" id="advExamDate" class="app-input" required>
                    </div>
                    <div class="app-form-group">
                        <label class="app-form-label">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            เวลาเริ่ม <span class="req">*</span>
                        </label>
                        <input type="time" id="advExamTimeStart" class="app-input" value="09:00" required>
                    </div>
                    <div class="app-form-group">
                        <label class="app-form-label">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 8"/></svg>
                            เวลาสิ้นสุด <span class="req">*</span>
                        </label>
                        <input type="time" id="advExamTimeEnd" class="app-input" value="12:00" required>
                    </div>
                    <div class="app-form-group">
                        <label class="app-form-label">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                            ห้องสอบ <span class="req">*</span>
                        </label>
                        <input type="text" id="advExamRoom" class="app-input" placeholder="เช่น HALL-A / CS-Lab2" required>
                    </div>
                </div>

                <div class="app-form-actions">
                    <button class="app-btn-primary" id="advSaveExamBtn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        📢 ประกาศสอบ
                    </button>
                    <button class="app-btn-ghost" id="advCancelExamBtn">ยกเลิก</button>
                </div>
            </div>

            <div class="table-wrap">
                <table class="data-table" id="advExamsTable">
                    <thead>
                        <tr><th>รหัสวิชา</th><th>ชื่อวิชา</th><th>วันสอบ</th><th class="hide-mobile">เวลา</th><th class="hide-mobile">ห้องสอบ</th><th>สถานะ</th><th style="width:50px"></th></tr>
                    </thead>
                    <tbody>${examRows || '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">ยังไม่มีประกาศสอบ</td></tr>'}</tbody>
                </table>
            </div>
        </div>

        <!-- ═══ Info Card ═══ -->
        <div class="card" style="border-left:4px solid var(--blue-500);background:var(--blue-50, rgba(59,130,246,0.06))">
            <div style="display:flex;gap:12px;align-items:flex-start">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--blue-500)" stroke-width="2" style="width:24px;height:24px;flex-shrink:0;margin-top:2px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <div>
                    <div style="font-weight:600;margin-bottom:4px">ระบบประกาศสอบอัตโนมัติ</div>
                    <div style="font-size:0.85rem;color:var(--text-muted)">เมื่ออาจารย์ประกาศสอบ ระบบจะแสดงตารางสอบให้กับนักศึกษาที่ลงทะเบียนเรียนวิชานั้นโดยอัตโนมัติ (เทียบจากรหัสวิชาในตารางเรียนของนักศึกษา)</div>
                </div>
            </div>
        </div>
    `;

    // Clear errors on input
    ['advExamDate', 'advExamTimeStart', 'advExamTimeEnd', 'advExamRoom'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => el.classList.remove('is-invalid'));
            el.addEventListener('change', () => el.classList.remove('is-invalid'));
        }
    });

    if (sections) bindSectionsCard(sections);

    // ── Event: Toggle & Close Add Exam Form ──
    const closeExamForm = () => {
        const form = document.getElementById('advAddExamForm');
        if (form) form.style.display = 'none';
    };
    document.getElementById('advToggleAddExam').addEventListener('click', () => {
        const form = document.getElementById('advAddExamForm');
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
    });
    const cancelExamBtn = document.getElementById('advCancelExamBtn');
    if (cancelExamBtn) cancelExamBtn.addEventListener('click', closeExamForm);
    const closeExamBtn = document.getElementById('advCloseExamFormBtn');
    if (closeExamBtn) closeExamBtn.addEventListener('click', closeExamForm);

    // ── Event: Save Exam Announcement ──
    document.getElementById('advSaveExamBtn').addEventListener('click', () => {
        const elCourse = document.getElementById('advExamCourseSelect');
        const elDate = document.getElementById('advExamDate');
        const elStart = document.getElementById('advExamTimeStart');
        const elEnd = document.getElementById('advExamTimeEnd');
        const elRoom = document.getElementById('advExamRoom');

        const courseCode = elCourse.value;
        const dateVal = elDate.value;
        const timeStart = elStart.value;
        const timeEnd = elEnd.value;
        const room = elRoom.value.trim();

        [elDate, elStart, elEnd, elRoom].forEach(el => el.classList.remove('is-invalid'));

        if (!courseCode || !dateVal || !timeStart || !timeEnd || !room) {
            if (!dateVal) elDate.classList.add('is-invalid');
            if (!timeStart) elStart.classList.add('is-invalid');
            if (!timeEnd) elEnd.classList.add('is-invalid');
            if (!room) elRoom.classList.add('is-invalid');
            showAdvisorToast('error', 'กรุณากรอกข้อมูลให้ครบทุกช่อง');
            return;
        }
        if (MOCK_EXAM_ANNOUNCEMENTS.some(ex => ex.code === courseCode)) {
            elCourse.classList.add('is-invalid');
            showAdvisorToast('error', `วิชา ${courseCode} มีประกาศสอบอยู่แล้ว`);
            return;
        }

        const course = courseList.find(c => c.code === courseCode);
        const [y, m, d] = dateVal.split('-');
        const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const thDate = `${parseInt(d)} ${months[parseInt(m) - 1]} ${parseInt(y) + 543}`;

        const now = new Date();
        const nowStr = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear() + 543}`;

        MOCK_EXAM_ANNOUNCEMENTS.push({
            code: courseCode,
            name: course ? course.nameTh : courseCode,
            date: thDate,
            time: `${timeStart}-${timeEnd}`,
            room,
            announcedBy: 'ผศ.ดร.วิชัย เทคโนโลยี',
            announcedAt: nowStr,
        });

        showAdvisorToast('success', `ประกาศสอบวิชา ${courseCode} — ${thDate} สำเร็จ 🎉`);
        renderAdvisorCourses();
    });

    // ── Event: Delete Exam ──
    document.querySelectorAll('.adv-del-exam').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx, 10);
            const removed = MOCK_EXAM_ANNOUNCEMENTS.splice(idx, 1)[0];
            showAdvisorToast('info', `ยกเลิกประกาศสอบ ${removed.code} แล้ว`);
            renderAdvisorCourses();
        });
    });
}

/* ============================================================
   ADVISOR — Class sections I teach (backed by /api/sections)
   Changing a section here changes the timetable of every enrolled student.
   ============================================================ */
function offlineCoursesCardHtml() {
    const rows = MOCK_ADVISOR_COURSES.map(c => `
        <tr><td><span class="badge badge-blue">${esc(c.code)}</span></td><td>${esc(c.name)}</td><td class="hide-mobile">${esc(c.nameTh)}</td></tr>`).join('');
    return `
        <div class="card">
            <div class="card-title">📚 รายวิชาที่สอน <span class="badge badge-blue" style="font-size:0.75rem">${MOCK_ADVISOR_COURSES.length} วิชา</span></div>
            <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px">เชื่อมต่อ backend ไม่ได้ จึงแสดงรายวิชาตัวอย่างและยังแก้ไขกลุ่มเรียนไม่ได้</p>
            <div class="table-wrap">
                <table class="data-table">
                    <thead><tr><th>รหัสวิชา</th><th>ชื่อวิชา (EN)</th><th class="hide-mobile">ชื่อวิชา (TH)</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>`;
}

function sectionsCardHtml(sections) {
    const rows = sections.map(s => `
        <tr data-section-id="${s.sectionId}">
            <td><span class="badge badge-blue">${esc(s.courseCode)}</span><div style="font-size:0.82rem">${esc(s.courseName)}</div></td>
            <td>${s.term}/${s.academicYear}</td>
            <td class="hide-mobile">${esc(s.sectionNo)}</td>
            <td>${esc(s.dayName)} ${esc(s.startTime)}–${esc(s.endTime)}</td>
            <td class="hide-mobile">${esc(s.room || '-')}</td>
            <td>${s.enrolledCount}${s.capacity ? ' / ' + s.capacity : ''}</td>
            <td>${sectionStatusBadge(s)}${s.reviewNote ? `<div style="font-size:0.75rem;color:var(--text-muted)">${esc(s.reviewNote)}</div>` : ''}</td>
            <td style="white-space:nowrap">
                <div class="action-btns" style="display:inline-flex;align-items:center;gap:6px">
                    <button type="button" class="btn btn-sm btn-ghost btn-icon adv-sec-students" title="รายชื่อนักศึกษา" aria-label="รายชื่อนักศึกษา">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </button>
                    <button type="button" class="btn btn-sm btn-ghost btn-icon adv-sec-edit" title="แก้ไข" aria-label="แก้ไข">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button type="button" class="btn btn-sm btn-ghost btn-icon adv-sec-delete" title="ลบ" aria-label="ลบ">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                </div>
            </td>
        </tr>`).join('');

    const pending = sections.filter(s => s.approvalStatus === 'PENDING').length;
    const dayOptions = DAY_NAMES_TH.map((d, i) => `<option value="${i}">${d}</option>`).join('');
    const field = (label, input) => `
        <div class="app-form-group">
            <label class="app-form-label">${label}</label>
            ${input}
        </div>`;

    return `
        <div class="card">
            <div class="card-title" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
                <span>📚 รายวิชาที่สอน <span class="badge badge-blue" style="font-size:0.75rem">${sections.length} กลุ่มเรียน</span>${pending ? ` <span class="badge badge-amber" style="font-size:0.75rem">รออนุมัติ ${pending}</span>` : ''}</span>
                <button class="btn btn-sm btn-orange" id="advToggleAddSection">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    เปิดรายวิชา
                </button>
            </div>
            <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px">
                กลุ่มเรียนที่เพิ่มหรือแก้ไขจะถูกส่งไปให้ผู้ดูแลระบบอนุมัติก่อน นักศึกษาจึงจะลงทะเบียนได้ ·
                วัน เวลา หรือห้องที่แก้ จะเปลี่ยนในตารางเรียนของนักศึกษาที่ลงกลุ่มนี้ไว้แล้วทันที
            </p>

            <div id="advSectionForm" style="display:none" class="app-form-panel">
                <div class="app-form-header">
                    <div>
                        <div class="app-form-title" id="advSectionFormTitle">เพิ่มกลุ่มเรียน</div>
                        <div class="app-form-subtitle">ช่องที่มี * ต้องกรอก · เวลาสอนของ Sec ต่าง ๆ ต้องไม่ทับกัน และนักศึกษาลงได้ไม่เกินจำนวนที่นั่งที่กำหนด</div>
                    </div>
                    <button type="button" class="btn btn-sm btn-ghost" id="advCloseSectionFormBtn" style="padding:4px 10px;font-size:0.8rem">✕ ปิด</button>
                </div>
                <div class="app-form-grid app-form-grid-3col">
                    ${field('ปีการศึกษา <span class="req">*</span>', '<input type="number" id="advSecYear" class="app-input" placeholder="เช่น 2569">')}
                    ${field('ภาคเรียน <span class="req">*</span>', '<select id="advSecTerm" class="app-select"><option value="1">1</option><option value="2">2</option><option value="3">ฤดูร้อน</option></select>')}
                    ${field('รหัสวิชา <span class="req">*</span>', '<input type="text" id="advSecCode" class="app-input" placeholder="เช่น CS3101">')}
                    ${field('ชื่อวิชา <span class="req">*</span>', '<input type="text" id="advSecName" class="app-input" placeholder="เช่น ปัญญาประดิษฐ์">')}
                    ${field('หน่วยกิต <span class="req">*</span>', '<input type="number" id="advSecCredits" class="app-input" min="1" value="3">')}
                </div>
                <!-- One block per Sec: the teacher opens D1, D2 or both, each with its own time, room and seats -->
                ${['D1', 'D2'].map(g => `
                <div class="adv-sec-block" data-group="${g}" style="border:1px solid var(--g-100);border-radius:var(--radius-md);padding:12px;margin-top:12px">
                    <label class="adv-sec-toggle" style="font-weight:600;display:flex;gap:8px;align-items:center;cursor:pointer">
                        <input type="checkbox" class="adv-sec-enabled" checked> เปิด Sec ${g}
                    </label>
                    <div class="app-form-grid app-form-grid-3col adv-sec-fields" style="margin-top:8px">
                        ${field('วัน <span class="req">*</span>', `<select class="app-select adv-sec-day">${dayOptions}</select>`)}
                        ${field('เวลาเริ่ม <span class="req">*</span>', '<input type="time" class="app-input adv-sec-start">')}
                        ${field('เวลาสิ้นสุด <span class="req">*</span>', '<input type="time" class="app-input adv-sec-end">')}
                        ${field('ห้อง', '<input type="text" class="app-input adv-sec-room" placeholder="เช่น CS-Lab1">')}
                        ${field('จำนวนที่นั่ง <span class="req">*</span>', '<input type="number" class="app-input adv-sec-cap" min="1" step="1" placeholder="เช่น 40">')}
                    </div>
                </div>`).join('')}
                <div class="app-form-actions">
                    <button class="app-btn-primary" id="advSaveSectionBtn">ส่งให้ผู้ดูแลระบบอนุมัติ</button>
                    <button class="app-btn-ghost" id="advCancelSectionBtn">ยกเลิก</button>
                </div>
            </div>

            <div class="table-wrap">
                <table class="data-table" id="advSectionsTable">
                    <thead>
                        <tr><th>วิชา</th><th>ภาค</th><th class="hide-mobile">Sec</th><th>วัน-เวลา</th><th class="hide-mobile">ห้อง</th><th>นักศึกษา</th><th>สถานะ</th><th></th></tr>
                    </thead>
                    <tbody>${rows || '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted)">ยังไม่มีกลุ่มเรียนที่สอน</td></tr>'}</tbody>
                </table>
            </div>
        </div>`;
}

function bindSectionsCard(sections) {
    const form = document.getElementById('advSectionForm');
    const $ = id => document.getElementById(id);
    let editingId = null;

    const blocks = [...form.querySelectorAll('.adv-sec-block')];
    const SEC_DEFAULTS = { D1: { day: 0, start: '09:00', end: '12:00' }, D2: { day: 0, start: '13:00', end: '16:00' } };
    const syncBlock = (block) => {
        const on = block.querySelector('.adv-sec-enabled').checked;
        block.querySelector('.adv-sec-fields').style.opacity = on ? '1' : '0.4';
        block.querySelectorAll('.adv-sec-fields input, .adv-sec-fields select').forEach(el => { el.disabled = !on; });
    };
    blocks.forEach(block => block.querySelector('.adv-sec-enabled').addEventListener('change', () => syncBlock(block)));

    const openForm = (section) => {
        editingId = section ? section.sectionId : null;
        const latest = sections[0];
        $('advSectionFormTitle').textContent = section
            ? `แก้ไข ${section.courseCode} Sec ${section.sectionNo} (${section.term}/${section.academicYear})`
            : 'เปิดรายวิชา (เลือกได้ว่าจะเปิด Sec D1, D2 หรือทั้งสอง)';
        $('advSecYear').value = section ? section.academicYear : (latest ? latest.academicYear : '');
        $('advSecTerm').value = section ? section.term : (latest ? latest.term : 1);
        $('advSecCode').value = section ? section.courseCode : '';
        $('advSecName').value = section ? section.courseName : '';
        $('advSecCredits').value = section ? section.credits : 3;
        blocks.forEach(block => {
            const group = block.dataset.group;
            const editingThis = section && section.sectionNo === group;
            const d = SEC_DEFAULTS[group];
            // When editing, only the edited Sec is shown and it cannot be switched off
            block.style.display = !section || editingThis ? 'block' : 'none';
            block.querySelector('.adv-sec-toggle input').checked = !section || editingThis;
            block.querySelector('.adv-sec-toggle').style.display = section ? 'none' : 'flex';
            block.querySelector('.adv-sec-day').value = editingThis ? section.dayOfWeek : d.day;
            block.querySelector('.adv-sec-start').value = editingThis ? section.startTime : d.start;
            block.querySelector('.adv-sec-end').value = editingThis ? section.endTime : d.end;
            block.querySelector('.adv-sec-room').value = editingThis ? (section.room || '') : '';
            block.querySelector('.adv-sec-cap').value = editingThis && section.capacity ? section.capacity : '';
            syncBlock(block);
        });
        form.style.display = 'block';
        form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    const closeForm = () => { form.style.display = 'none'; editingId = null; };

    $('advToggleAddSection').addEventListener('click', () => {
        if (form.style.display === 'none' || editingId !== null) openForm(null); else closeForm();
    });
    $('advCloseSectionFormBtn').addEventListener('click', closeForm);
    $('advCancelSectionBtn').addEventListener('click', closeForm);

    $('advSaveSectionBtn').addEventListener('click', async () => {
        const course = {
            academicYear: Number($('advSecYear').value) || null,
            term: Number($('advSecTerm').value),
            courseCode: $('advSecCode').value.trim(),
            courseName: $('advSecName').value.trim(),
            credits: Number($('advSecCredits').value) || null,
        };
        if (!course.academicYear || !course.courseCode || !course.courseName || !course.credits) {
            showAdvisorToast('error', 'กรุณากรอกข้อมูลรายวิชาที่มี * ให้ครบ');
            return;
        }
        const secs = blocks
            .filter(b => b.style.display !== 'none' && b.querySelector('.adv-sec-enabled').checked)
            .map(b => ({
                ...course,
                sectionNo: b.dataset.group,
                dayOfWeek: Number(b.querySelector('.adv-sec-day').value),
                startTime: b.querySelector('.adv-sec-start').value,
                endTime: b.querySelector('.adv-sec-end').value,
                room: b.querySelector('.adv-sec-room').value.trim(),
                capacity: Number(b.querySelector('.adv-sec-cap').value),
            }));
        if (secs.length === 0) {
            showAdvisorToast('error', 'กรุณาเลือกเปิดอย่างน้อย 1 Sec');
            return;
        }
        for (const s of secs) {
            if (!s.startTime || !s.endTime || s.startTime >= s.endTime) {
                showAdvisorToast('error', `Sec ${s.sectionNo}: เวลาสิ้นสุดต้องหลังเวลาเริ่ม`);
                return;
            }
            if (!Number.isInteger(s.capacity) || s.capacity < 1) {
                showAdvisorToast('error', `Sec ${s.sectionNo}: กรุณากรอกจำนวนที่นั่งเป็นตัวเลขมากกว่า 0`);
                return;
            }
        }
        if (secs.length === 2 && secs[0].dayOfWeek === secs[1].dayOfWeek
            && secs[0].startTime < secs[1].endTime && secs[1].startTime < secs[0].endTime) {
            showAdvisorToast('error', 'เวลาของ Sec D1 และ D2 ทับกัน กรุณาเลือกเวลาไม่ให้ทับกัน');
            return;
        }
        try {
            if (editingId !== null) {
                await fetchAPI(`/sections/${editingId}`, 'PUT', secs[0], 8000);
                showAdvisorToast('success', esc(`แก้ไข ${course.courseCode} Sec ${secs[0].sectionNo} แล้ว ส่งให้ผู้ดูแลระบบอนุมัติอีกครั้ง`));
            } else {
                await fetchAPI('/sections/batch', 'POST', secs, 8000);
                showAdvisorToast('success', esc(`ส่งคำขอเปิด ${course.courseCode} Sec ${secs.map(s => s.sectionNo).join(', ')} แล้ว รอผู้ดูแลระบบอนุมัติ`));
            }
            renderAdvisorCourses();
        } catch (err) {
            showAdvisorToast('error', esc(apiErrorText(err)));
        }
    });

    document.querySelectorAll('#advSectionsTable tr[data-section-id]').forEach(row => {
        const section = sections.find(s => String(s.sectionId) === row.dataset.sectionId);
        if (!section) return;

        row.querySelector('.adv-sec-edit').addEventListener('click', () => openForm(section));

        row.querySelector('.adv-sec-delete').addEventListener('click', async () => {
            const warning = section.enrolledCount > 0
                ? `\nนักศึกษา ${section.enrolledCount} คนที่ลงกลุ่มนี้จะถูกถอนออกจากตารางเรียนด้วย` : '';
            if (!await confirmDialog(`ลบ ${section.courseCode} กลุ่ม ${section.sectionNo} (${section.term}/${section.academicYear})?${warning}`)) return;
            try {
                await fetchAPI(`/sections/${section.sectionId}`, 'DELETE', null, 8000);
                showAdvisorToast('info', esc(`ลบ ${section.courseCode} กลุ่ม ${section.sectionNo} แล้ว`));
                renderAdvisorCourses();
            } catch (err) {
                showAdvisorToast('error', esc(apiErrorText(err)));
            }
        });

        row.querySelector('.adv-sec-students').addEventListener('click', async () => {
            try {
                const students = await fetchAPI(`/sections/${section.sectionId}/students`);
                openSectionStudentsModal(section, Array.isArray(students) ? students : []);
            } catch (err) {
                showAdvisorToast('error', esc(apiErrorText(err)));
            }
        });
    });
}
