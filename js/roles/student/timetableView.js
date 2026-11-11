/* ============================================================
   BSRU Student Portal — Student Timetable & Registration Cart
   ============================================================ */

import { confirmDialog } from '../../components/confirmDialog.js';
import { esc, showToast } from '../../utils.js';
import { fetchAPI } from '../../api.js';
import { getAuthState } from '../../auth.js';
import { MOCK_EXAM_ANNOUNCEMENTS } from '../advisor.js';
import { showPetitionToast } from './petitionsView.js';
import {
    DAY_NAMES_TH, bindInstructorPicker, dayOptionsHTML, formField, instructorPickerHTML, loadAdvisors,
    bindCourseCodeInput, isValidCourseCode, readInstructor, setInstructor, timeRangeHTML,
} from '../../components/courseForm.js';

/* ============================================================
   MOCK DATA — Timetable schedules grouped by semester
   ============================================================ */
export let MOCK_TIMETABLE_SEMESTERS = [
    {
        label: 'Term 1/2569',
        schedule: [
            { day: 0, startTime: '09:00', endTime: '12:00', subjectCode: 'SC17351', subjectName: 'Object-Oriented Programming', teacherName: 'Dr. Somchai', room: 'Room 423' },
            { day: 2, startTime: '12:00', endTime: '15:00', subjectCode: 'SC17411', subjectName: 'Web Development', teacherName: 'Dr. Suda', room: 'Room 6121' },
            { day: 2, startTime: '15:00', endTime: '18:00', subjectCode: 'SC17402', subjectName: 'Software Engineering', teacherName: 'Prof. Anan', room: 'Room 6125' },
            { day: 4, startTime: '14:00', endTime: '17:00', subjectCode: 'SC17353', subjectName: 'Data Structures', teacherName: 'Dr. Wicha', room: 'Room 6123' },
        ],
    },
    {
        label: 'Term 2/2568',
        schedule: [
            { day: 0, startTime: '09:00', endTime: '12:00', subjectCode: 'CS2101', subjectName: 'Data Structures', teacherName: 'Dr. Wicha', room: 'CS-301' },
            { day: 0, startTime: '13:00', endTime: '16:00', subjectCode: 'CS2102', subjectName: 'Algorithms', teacherName: 'Prof. Anan', room: 'CS-205' },
            { day: 1, startTime: '09:00', endTime: '12:00', subjectCode: 'CS2201', subjectName: 'Computer Architecture', teacherName: 'Dr. Somchai', room: 'CS-Lab2' },
            { day: 3, startTime: '09:00', endTime: '12:00', subjectCode: 'CS2103', subjectName: 'Operating Systems', teacherName: 'Dr. Suda', room: 'CS-Lab1' },
            { day: 4, startTime: '09:00', endTime: '12:00', subjectCode: 'GE1201', subjectName: 'English for IT', teacherName: 'Aj. Sarah', room: 'LA-402' },
        ],
    },
    {
        label: 'Term 2/2569',
        schedule: [
            { day: 1, startTime: '09:00', endTime: '12:00', subjectCode: 'CS2301', subjectName: 'Database Systems', teacherName: 'Dr. Manop', room: 'CS-Lab2' },
            { day: 2, startTime: '09:00', endTime: '12:00', subjectCode: 'CS2302', subjectName: 'Web Programming', teacherName: 'Aj. Suda', room: 'CS-Lab3' },
            { day: 3, startTime: '13:00', endTime: '16:00', subjectCode: 'CS2401', subjectName: 'Requirements Engineering', teacherName: 'Prof. Anan', room: 'CS-205' },
            { day: 4, startTime: '09:00', endTime: '12:00', subjectCode: 'GE1301', subjectName: 'General Psychology', teacherName: 'Aj. Yupa', room: 'LA-301' },
        ],
    },
];

export const MOCK_EXAMS = [
    { code: 'CS3101', name: 'ปัญญาประดิษฐ์', date: '18 มี.ค. 2569', time: '09:00-12:00', room: 'HALL-A', seat: 'A-042' },
    { code: 'CS3102', name: 'วิศวกรรมซอฟต์แวร์', date: '20 มี.ค. 2569', time: '13:00-16:00', room: 'HALL-A', seat: 'A-042' },
    { code: 'CS3201', name: 'ระบบฐานข้อมูลขั้นสูง', date: '22 มี.ค. 2569', time: '09:00-12:00', room: 'CS-Lab2', seat: '-' },
    { code: 'CS3301', name: 'เครือข่ายคอมพิวเตอร์', date: '24 มี.ค. 2569', time: '09:00-12:00', room: 'HALL-B', seat: 'B-018' },
    { code: 'CS3103', name: 'การพัฒนาเว็บแอปพลิเคชัน', date: '25 มี.ค. 2569', time: '13:00-16:00', room: 'CS-Lab3', seat: '-' },
    { code: 'GE2301', name: 'ภาษาอังกฤษเชิงวิชาการ', date: '27 มี.ค. 2569', time: '09:00-12:00', room: 'LA-402', seat: 'C-103' },
];

/* ============================================================
   TIMETABLE CONSTANTS & HELPERS
   ============================================================ */
export const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const TIME_SLOTS = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
export const COLOR_CLASSES = ['color-1', 'color-2', 'color-3', 'color-4', 'color-5', 'color-6'];
export const THAI_DATE_TIME = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' });

/** Convert time string "HH:MM" to slot index (0-based from 07:00) */
export function timeToSlot(t) {
    const h = parseInt(t.split(':')[0], 10);
    return Math.max(0, h - 7);
}

/** Slot where a class ending at "HH:MM" stops; 11:30 runs into the 11:00 row, so round up */
export function timeToEndSlot(t) {
    const [h, m] = t.split(':').map(n => parseInt(n, 10));
    return Math.max(0, h - 7 + (m > 0 ? 1 : 0));
}

/** Build desktop CSS Grid schedule matrix */
export function buildTimetableDesktopHTML(schedule, showDelete) {
    // Determine which time slots are actually used
    let minSlot = 14, maxSlot = 0;
    schedule.forEach(e => {
        const s = timeToSlot(e.startTime);
        const end = timeToEndSlot(e.endTime);
        if (s < minSlot) minSlot = s;
        if (end > maxSlot) maxSlot = end;
    });
    if (minSlot >= maxSlot) { minSlot = 2; maxSlot = 12; } // default 09:00-19:00

    const usedSlots = [];
    for (let i = minSlot; i < maxSlot; i++) usedSlots.push(i);

    // Build color map per subject code
    const subjectCodes = [...new Set(schedule.map(e => e.subjectCode))];
    const colorMap = {};
    subjectCodes.forEach((code, i) => { colorMap[code] = COLOR_CLASSES[i % COLOR_CLASSES.length]; });

    let html = `<div class="tt-schedule-grid" style="grid-template-rows: auto repeat(${usedSlots.length}, minmax(60px, auto));">`;

    // Corner cell
    html += `<div class="tt-corner">เวลา / วัน</div>`;

    // Day headers
    DAYS_FULL.forEach((day, i) => {
        const weekend = i >= 5 ? ' tt-weekend' : '';
        html += `<div class="tt-day-header${weekend}" style="grid-column:${i + 2}; grid-row:1;">
            <span class="tt-day-full">${day}</span>
            <span class="tt-day-short">${DAYS_SHORT[i]}</span>
        </div>`;
    });

    // Time labels (left column)
    usedSlots.forEach((slot, ri) => {
        const t = TIME_SLOTS[slot];
        const tEnd = TIME_SLOTS[slot + 1] || '';
        html += `<div class="tt-time-label" style="grid-column:1; grid-row:${ri + 2};">${t}<br>${tEnd}</div>`;
    });

    // Empty cells (background grid)
    usedSlots.forEach((_, ri) => {
        for (let di = 0; di < 7; di++) {
            html += `<div class="tt-cell" style="grid-column:${di + 2}; grid-row:${ri + 2};"></div>`;
        }
    });

    // Place class cards into the grid
    schedule.forEach((e, idx) => {
        const colStart = e.day + 2;
        const rowStart = (timeToSlot(e.startTime) - minSlot) + 2;
        const rowEnd = Math.max(rowStart + 1, (timeToEndSlot(e.endTime) - minSlot) + 2);
        const color = colorMap[e.subjectCode] || 'color-1';

        const deleteBtn = showDelete ? `<button class="tt-delete-course" data-course-idx="${idx}" title="ลบวิชานี้" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.3);border:none;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;transition:opacity 0.2s;color:#fff;font-size:12px;padding:0;line-height:1">✕</button>` : '';

        html += `<div class="tt-class-card ${color}" style="grid-column:${colStart}; grid-row:${rowStart}/${rowEnd};position:relative" onmouseenter="this.querySelector('.tt-delete-course')&&(this.querySelector('.tt-delete-course').style.opacity='1')" onmouseleave="this.querySelector('.tt-delete-course')&&(this.querySelector('.tt-delete-course').style.opacity='0')">
            ${deleteBtn}
            <span class="tt-class-code">${esc(e.subjectCode)}</span>${e.status === 'PENDING' ? '<span class="tt-pending-badge">รอยืนยัน</span>' : ''}
            <span class="tt-class-name">${esc(e.subjectName)}</span>
            <div class="tt-class-meta">
                <div class="tt-class-meta-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    ${esc(e.startTime)} - ${esc(e.endTime)}
                </div>
                <div class="tt-class-meta-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    ${esc(e.teacherName)}
                </div>
                <div class="tt-class-meta-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    ${esc(e.room)}
                </div>
            </div>
        </div>`;
    });

    html += `</div>`;

    // Build mobile agenda view (hidden on desktop via CSS)
    html += buildTimetableAgendaHTML(schedule, colorMap, showDelete);

    return html;
}

/** Build mobile agenda view — stacked list grouped by day */
export function buildTimetableAgendaHTML(schedule, colorMap, showDelete) {
    if (schedule.length === 0) {
        return `<div class="tt-agenda-view" style="text-align:center;padding:32px 16px;color:var(--text-muted)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;opacity:0.4;margin-bottom:8px"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <div style="font-weight:500;margin-bottom:4px">ยังไม่มีรายวิชาในภาคเรียนนี้</div>
            <div style="font-size:0.82rem">กดปุ่ม "+ ลงทะเบียนเรียน" ด้านบนเพื่อลงข้อมูลตารางเรียน</div>
        </div>`;
    }

    let html = `<div class="tt-agenda-view">`;

    DAYS_FULL.forEach((dayName, dayIdx) => {
        const entries = schedule
            .filter(e => e.day === dayIdx)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));

        if (entries.length === 0) return; // Skip empty days

        html += `<div class="tt-agenda-day">
            <div class="tt-agenda-day-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                ${dayName}
                <span class="tt-agenda-day-count">${entries.length} วิชา</span>
            </div>
            <div class="tt-agenda-cards">`;

        entries.forEach(e => {
            const originalIdx = schedule.indexOf(e);
            const cColor = colorMap[e.subjectCode] || 'color-1';
            const bgMap = { 'color-1': 'var(--brand-600)', 'color-2': 'var(--blue-600)', 'color-3': 'var(--green-600)', 'color-4': 'var(--amber-600)', 'color-5': 'var(--red-600)', 'color-6': 'var(--orange-600)' };
            const codeBg = bgMap[cColor] || 'var(--brand-600)';

            const deleteBtn = showDelete ? `
                <button class="tt-delete-course" data-course-idx="${originalIdx}" title="ลบวิชานี้" style="margin-left:auto;background:none;border:none;color:var(--g-400);cursor:pointer;padding:6px;display:flex;align-items:center;justify-content:center;border-radius:4px;align-self:center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </button>` : '';

            html += `<div class="tt-agenda-card">
                <div class="tt-agenda-time">
                    <span class="tt-agenda-time-start">${esc(e.startTime)}</span>
                    <span class="tt-agenda-time-divider"></span>
                    <span class="tt-agenda-time-end">${esc(e.endTime)}</span>
                </div>
                <div class="tt-agenda-info">
                    <span class="tt-agenda-code" style="background:${codeBg}">${esc(e.subjectCode)}</span>${e.status === 'PENDING' ? '<span class="tt-pending-badge">รอยืนยัน</span>' : ''}
                    <div class="tt-agenda-name">${esc(e.subjectName)}</div>
                    <div class="tt-agenda-details">
                        <span class="tt-agenda-detail">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            ${esc(e.teacherName)}
                        </span>
                        <span class="tt-agenda-detail">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                            ${esc(e.room)}
                        </span>
                    </div>
                </div>
                ${deleteBtn}
            </div>`;
        });

        html += `</div></div>`;
    });

    html += `</div>`;
    return html;
}

/** Build exam schedule cards — filtered by student's enrolled courses */
export function buildExamHTML(currentSchedule, semesters = MOCK_TIMETABLE_SEMESTERS) {
    // Get all subject codes the student is enrolled in across all semesters
    const enrolledCodes = new Set();
    semesters.forEach(sem => {
        sem.schedule.forEach(e => enrolledCodes.add(e.subjectCode));
    });
    // Also add from the current schedule directly
    if (currentSchedule) currentSchedule.forEach(e => enrolledCodes.add(e.subjectCode));

    // Filter exam announcements to only show courses the student has enrolled in
    const matchedExams = MOCK_EXAM_ANNOUNCEMENTS.filter(ex => enrolledCodes.has(ex.code));

    if (matchedExams.length === 0) {
        return `<div style="text-align:center;padding:32px 16px;color:var(--text-muted)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;opacity:0.4;margin-bottom:8px"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <div style="font-weight:500;margin-bottom:4px">ยังไม่มีตารางสอบสำหรับวิชาที่คุณลงเรียน</div>
            <div style="font-size:0.82rem">ตารางสอบจะแสดงอัตโนมัติเมื่ออาจารย์ผู้สอนประกาศสอบในรายวิชาที่คุณลงทะเบียนเรียน</div>
        </div>`;
    }

    let html = `<div class="tt-exam-list">`;
    matchedExams.forEach(ex => {
        html += `<div class="tt-exam-card">
            <div class="tt-exam-header">
                <span class="tt-exam-code">${esc(ex.code)}</span>
                <span class="badge badge-green" style="font-size:0.7rem">จากอาจารย์ผู้สอน</span>
            </div>
            <div class="tt-exam-name">${esc(ex.name)}</div>
            <div class="tt-exam-details">
                <span class="tt-exam-detail-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    ${esc(ex.date)}
                </span>
                <span class="tt-exam-detail-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    ${esc(ex.time)}
                </span>
                <span class="tt-exam-detail-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    ${esc(ex.room)}
                </span>
            </div>
        </div>`;
    });
    html += `</div>`;
    return html;
}

/** Build the semester <select> options for timetable */
export function buildTimetableSemesterOptions(semesters, selectedIdx) {
    return semesters.map((sem, i) =>
        `<option value="${i}"${i === selectedIdx ? ' selected' : ''}>${esc(sem.label)}</option>`
    ).join('');
}

/** Pull the backend message out of a fetchAPI error ('HTTP 404 (...): {"error":"..."}') */
export function apiErrorMessage(err) {
    const match = /\{.*\}$/s.exec(err.message || '');
    if (match) {
        try { return JSON.parse(match[0]).error || err.message; } catch (e) { /* not JSON */ }
    }
    return err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่';
}

/** The whole JSON body of a fetchAPI error ({ error, details }), or null */
export function apiErrorBody(err) {
    const match = /\{.*\}$/s.exec(err.message || '');
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch (e) { return null; }
}

/** Banner telling the student whether they can add or drop courses in this semester */
export function buildRegistrationBanner(sem) {
    if (sem.offline) {
        return `<div class="tt-reg-banner closed">โหมดออฟไลน์: แสดงตารางเรียนตัวอย่าง ยังเพิ่มหรือลบวิชาไม่ได้</div>`;
    }
    const reg = sem.registration;
    if (!reg) {
        return `<div class="tt-reg-banner closed">🔒 ภาคเรียนนี้ไม่ได้เปิดลงทะเบียน การเพิ่มหรือลบวิชาทำได้โดยผู้ดูแลระบบหรืออาจารย์ผู้สอน</div>`;
    }
    const period = `${THAI_DATE_TIME.format(new Date(reg.opensAt))} – ${THAI_DATE_TIME.format(new Date(reg.closesAt))}`;
    if (reg.open) {
        return `<div class="tt-reg-banner open">🟢 เปิดลงทะเบียนอยู่ (${period}) เพิ่มหรือลบวิชาได้</div>`;
    }
    return `<div class="tt-reg-banner closed">🔒 ปิดลงทะเบียน${reg.forceClosed ? ' (ผู้ดูแลระบบปิดไว้)' : ''} · ช่วงลงทะเบียน ${period}</div>`;
}

/** Convert GET /students/{id}/timetable + GET /registration-periods into the semesters this page renders */
export function timetableFromApi(terms, periods) {
    const key = (year, term) => `${year}/${term}`;
    const semesters = terms.map(t => ({
        academicYear: t.academicYear,
        term: t.term,
        label: t.label,
        registration: t.registration,
        conflicts: t.conflicts,
        totalCredits: t.totalCredits,
        schedule: t.sessions.map(s => ({
            day: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            subjectCode: s.courseCode,
            subjectName: s.courseName,
            teacherName: s.instructorName || '-',
            room: s.room || '-',
            sectionId: s.sectionId,
            sectionNo: s.sectionNo,
            credits: s.credits,
            status: s.enrollmentStatus,
        })),
        rejected: t.rejected || [],
    }));
    // A semester open for registration needs a tab even before the student has any course in it
    const known = new Set(semesters.map(s => key(s.academicYear, s.term)));
    periods.filter(p => p.open && !known.has(key(p.academicYear, p.term))).forEach(p => {
        semesters.push({
            academicYear: p.academicYear, term: p.term, label: `Term ${p.term}/${p.academicYear}`,
            registration: p, conflicts: [], totalCredits: 0, schedule: [], rejected: [],
        });
    });
    return semesters.sort((a, b) => b.academicYear - a.academicYear || b.term - a.term);
}

export function renderTimetable(studentId) {
    const container = document.getElementById('timetableContent');
    // Show the offline sample first, then replace it with the database timetable when the backend answers
    let semesters = MOCK_TIMETABLE_SEMESTERS.map(s => ({ ...s, offline: true }));
    let currentIdx = 0;
    let cartOpen = false;
    let homeSec = '';            // the student's own Sec (D1/D2), the default in the registration form
    let advisors = [];           // teachers in the system for the "อาจารย์ผู้สอน" list
    // An admin opening this page as the student registers for them (e.g. the first semester after
    // admission): confirmed straight away and allowed while registration is closed
    const auth = getAuthState();
    const staffRegistering = auth.isImpersonating && auth.role === 'ADMIN';

    async function load(keepSelection) {
        const selected = semesters[currentIdx];
        try {
            const [terms, periods, student, teachers] = await Promise.all([
                fetchAPI(`/students/${encodeURIComponent(studentId)}/timetable`),
                fetchAPI('/registration-periods'),
                fetchAPI(`/students/${encodeURIComponent(studentId)}`).catch(() => null),
                loadAdvisors(),
            ]);
            homeSec = student?.studentSection || '';
            advisors = teachers;
            semesters = timetableFromApi(terms, periods);
            if (keepSelection && selected) {
                currentIdx = Math.max(0, semesters.findIndex(s =>
                    s.academicYear === selected.academicYear && s.term === selected.term));
            } else {
                // Start on the semester open for registration, else one that has a registration period, else the newest
                const openIdx = semesters.findIndex(s => s.registration?.open);
                currentIdx = Math.max(0, openIdx >= 0 ? openIdx : semesters.findIndex(s => s.registration));
            }
        } catch (err) {
            console.warn('[Timetable] Backend unavailable, showing sample timetable:', err.message);
        }
        render(currentIdx);
    }

    function render(idx) {
        if (semesters.length === 0) {
            container.innerHTML = `<div class="card"><div class="card-title">ตารางเรียน Study Timetable</div><p>ยังไม่มีรายวิชาในตารางเรียน</p></div>`;
            return;
        }
        const sem = semesters[idx];
        const canEdit = !sem.offline && (staffRegistering ? !!sem.registration : !!sem.registration?.open);
        const credits = sem.totalCredits ?? sem.schedule.reduce((a, e) => a + (e.credits || 0), 0);
        const conflictBox = sem.conflicts?.length
            ? `<div class="tt-reg-banner warn">⚠️ มีวิชาเวลาเรียนชนกัน: ${esc(sem.conflicts.join(', '))}</div>`
            : '';
        const rejectedBox = (sem.rejected || []).map(r => `
            <div class="tt-reg-banner warn" style="display:flex;justify-content:space-between;gap:8px;align-items:center">
                <span>❌ คำขอลงทะเบียน ${esc(r.courseCode)} ${esc(r.courseName)} (Sec ${esc(r.sectionNo)}) ไม่ได้รับการยืนยัน${r.note ? `: ${esc(r.note)}` : ''}</span>
                <button class="btn btn-sm btn-ghost tt-dismiss-rejected" data-section-id="${r.sectionId}">รับทราบ</button>
            </div>`).join('');

        container.innerHTML = `
            <div class="card">
                <div class="card-title" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
                    <span style="display:flex;align-items:center;gap:8px">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:22px;height:22px;color:var(--brand-500)"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        ตารางเรียน Study Timetable
                    </span>
                    ${canEdit ? `<button class="btn btn-sm btn-orange" id="ttToggleAddCourse" style="display:inline-flex;align-items:center;gap:6px">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        ลงทะเบียนเรียน
                    </button>` : ''}
                </div>

                ${buildRegistrationBanner(sem)}
                ${conflictBox}
                ${rejectedBox}

                ${canEdit ? `
                <!-- Self-registration: the student types in a course and it goes straight into the timetable -->
                <div id="ttCartPanel" style="display:${cartOpen ? 'block' : 'none'}" class="app-form-panel">
                    <div class="app-form-header">
                        <div>
                            <div class="app-form-title">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                                ลงทะเบียนเรียน (${esc(sem.label)})
                            </div>
                            <div class="app-form-subtitle">กรอกข้อมูลวิชาที่เรียนแล้วกด "ลงทะเบียน" วิชาจะเข้าตารางเรียนทันที ไม่ต้องรออนุมัติ ·
                                พิมพ์รหัสหรือชื่อวิชาเพื่อเลือกวิชาที่เคยมีในระบบ ระบบจะกรอกข้อมูลให้อัตโนมัติ</div>
                        </div>
                        <button type="button" class="btn btn-sm btn-ghost" id="ttCloseFormBtn" style="padding:4px 10px;font-size:0.8rem">✕ ปิด</button>
                    </div>

                    <div id="ttRegForm">
                        <div class="app-form-grid app-form-grid-3col">
                            ${formField('รหัสวิชา <span class="req">*</span>', `
                                <div style="position:relative">
                                    <input type="text" id="ttRegCode" class="app-input" placeholder="เช่น CS3101" autocomplete="off">
                                    <div id="ttRegSuggest" class="tt-suggest-box" style="display:none"></div>
                                </div>`)}
                            ${formField('ชื่อวิชา <span class="req">*</span>', '<input type="text" id="ttRegName" class="app-input" placeholder="เช่น ปัญญาประดิษฐ์" autocomplete="off">')}
                            ${formField('หน่วยกิต <span class="req">*</span>', '<input type="number" id="ttRegCredits" class="app-input" min="1" max="12" value="3">')}
                            ${formField('Sec <span class="req">*</span>', `<select id="ttRegSec" class="app-select">${['D1', 'D2'].map(g =>
                                `<option value="${g}" ${g === (homeSec || 'D1') ? 'selected' : ''}>${g}${g === homeSec ? ' (Sec ของฉัน)' : ''}</option>`).join('')}</select>`)}
                            ${formField('อาจารย์ผู้สอน <span class="req">*</span>', instructorPickerHTML('ttReg', advisors))}
                            ${formField('ห้องเรียน', '<input type="text" id="ttRegRoom" class="app-input" placeholder="เช่น CS-Lab1">')}
                            ${formField('วันที่เรียน <span class="req">*</span>', `<select id="ttRegDay" class="app-select">${dayOptionsHTML(0)}</select>`)}
                            ${formField('เวลาเรียน <span class="req">*</span>', timeRangeHTML('ttReg'), 'app-form-span-2')}
                        </div>
                        <div id="ttRegDupBox" class="tt-reg-banner warn" style="display:none;margin-top:12px"></div>
                    </div>

                    <div class="app-form-actions">
                        <button class="app-btn-primary" id="ttRegSubmitBtn">ลงทะเบียน</button>
                        <button class="app-btn-ghost" id="ttRegClearBtn">ล้างข้อมูล</button>
                    </div>
                </div>` : ''}

                <div class="batch-filter-bar" style="margin-bottom:16px">
                    <label>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        Semester
                    </label>
                    <select class="batch-select" id="timetableSemesterSelect" aria-label="à¹à¸¥à¸·à¸­à¸à¸ à¸²à¸à¹à¸£à¸µà¸¢à¸">
                        ${buildTimetableSemesterOptions(semesters, idx)}
                    </select>
                    <span class="filter-result-count">Showing: <strong>${esc(sem.label)}</strong> · ${sem.schedule.length} วิชา${credits ? ` · ${credits} หน่วยกิต` : ''}</span>
                </div>
                <div id="timetableTableBody">
                    ${buildTimetableDesktopHTML(sem.schedule, canEdit)}
                </div>
            </div>
            <div class="card">
                <div class="card-title">📝 ตารางสอบ Exam Schedule <span style="font-size:0.8rem;color:var(--text-muted);font-weight:400">(อัปเดตอัตโนมัติจากอาจารย์ผู้สอน)</span></div>
                ${buildExamHTML(sem.schedule, semesters)}
            </div>`;

        // ── Event: Semester Select ──
        document.getElementById('timetableSemesterSelect').addEventListener('change', (e) => {
            currentIdx = parseInt(e.target.value, 10);
            render(currentIdx);
        });

        // ── Event: Dismiss a rejected request (allowed even after registration closes) ──
        document.querySelectorAll('.tt-dismiss-rejected').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    await fetchAPI(`/students/${encodeURIComponent(studentId)}/enrollments/${btn.dataset.sectionId}`, 'DELETE', null, 8000);
                    await load(true);
                } catch (err) {
                    showPetitionToast('error', esc(apiErrorMessage(err)));
                }
            });
        });

        if (!canEdit) return;

        // ── Self-registration form ──
        const panel = document.getElementById('ttCartPanel');
        const form = document.getElementById('ttRegForm');
        const $ = (id) => document.getElementById(id);
        const submitBtn = $('ttRegSubmitBtn');
        bindInstructorPicker(form, 'ttReg');
        bindCourseCodeInput($('ttRegCode'));

        $('ttToggleAddCourse').addEventListener('click', () => {
            cartOpen = panel.style.display === 'none';
            panel.style.display = cartOpen ? 'block' : 'none';
            if (cartOpen) $('ttRegCode').focus();
        });
        $('ttCloseFormBtn').addEventListener('click', () => {
            cartOpen = false;
            panel.style.display = 'none';
        });

        const dupBox = $('ttRegDupBox');
        const suggestBox = $('ttRegSuggest');
        let existingSection = null;   // same course + Sec already recorded in this semester

        function showDuplicate(section) {
            existingSection = section;
            if (!section) {
                dupBox.style.display = 'none';
                dupBox.innerHTML = '';
                submitBtn.textContent = 'ลงทะเบียน';
                return;
            }
            const teacher = section.instructorName ? ` · อาจารย์ ${esc(section.instructorName)}` : '';
            const room = section.room ? ` · ห้อง ${esc(section.room)}` : '';
            dupBox.innerHTML = `
                <div style="font-weight:600;margin-bottom:4px">⚠️ มีวิชานี้ในระบบแล้ว</div>
                <div>${esc(section.courseCode)} ${esc(section.courseName)} (Sec ${esc(section.sectionNo)}, ${section.credits} หน่วยกิต)
                    · วัน${esc(section.dayName)} ${esc(section.startTime)}–${esc(section.endTime)}${teacher}${room}
                    · ลงทะเบียนแล้ว ${section.enrolledCount} คน</div>
                <div style="font-size:0.82rem;margin-top:4px">กด "ลงทะเบียนวิชานี้" เพื่อใช้ข้อมูลเดิม ไม่ต้องกรอกใหม่ (ถ้าข้อมูลไม่ถูกต้อง แจ้งผู้ดูแลระบบให้แก้ไข)</div>`;
            dupBox.style.display = 'block';
            submitBtn.textContent = 'ลงทะเบียนวิชานี้ (ใช้ข้อมูลเดิม)';
        }

        /** Warn as soon as the typed course + Sec already exists in this semester */
        async function checkDuplicate() {
            const code = $('ttRegCode').value.trim().toUpperCase();
            const sec = $('ttRegSec').value;
            if (!code) { showDuplicate(null); return; }
            try {
                const found = await fetchAPI(`/sections/lookup?academicYear=${sem.academicYear}&term=${sem.term}&courseCode=${encodeURIComponent(code)}`, 'GET', null, 8000);
                if ($('ttRegCode').value.trim().toUpperCase() !== code) return;   // typed on meanwhile
                showDuplicate(found.find(s => s.sectionNo === sec) || null);
            } catch (err) {
                showDuplicate(null);
            }
        }

        function fillFrom(c) {
            $('ttRegCode').value = c.courseCode;
            $('ttRegName').value = c.courseName || '';
            $('ttRegCredits').value = c.credits || 3;
            $('ttRegDay').value = String(c.dayOfWeek ?? 0);
            $('ttRegStart').value = c.startTime || '';
            $('ttRegEnd').value = c.endTime || '';
            $('ttRegRoom').value = c.room || '';
            setInstructor(form, 'ttReg', c);
        }

        let suggestTimer = null;
        let suggestions = [];
        function hideSuggestions() {
            suggestBox.style.display = 'none';
            suggestBox.innerHTML = '';
        }
        async function suggest(q) {
            if (q.trim().length < 2) { hideSuggestions(); return; }
            try {
                suggestions = await fetchAPI(`/courses/suggestions?q=${encodeURIComponent(q.trim())}`, 'GET', null, 8000);
            } catch (err) {
                suggestions = [];
            }
            if (suggestions.length === 0) { hideSuggestions(); return; }
            suggestBox.innerHTML = `<div style="font-size:0.78rem;color:var(--text-muted);padding:6px 10px">วิชาที่เคยบันทึกในระบบ — กดเพื่อกรอกให้อัตโนมัติ</div>`
                + suggestions.map((c, i) => `
                <button type="button" class="tt-suggest-item" data-idx="${i}">
                    <strong>${esc(c.courseCode)}</strong> ${esc(c.courseName)}
                    <span style="color:var(--text-muted);font-size:0.8rem"> · ${c.credits} หน่วยกิต${c.instructorName ? ` · ${esc(c.instructorName)}` : ''} · วัน${esc(DAY_NAMES_TH[c.dayOfWeek])} ${esc(c.startTime)}–${esc(c.endTime)} · ล่าสุด ${esc(c.lastTaught)}</span>
                </button>`).join('');
            suggestBox.style.display = 'block';
            suggestBox.querySelectorAll('.tt-suggest-item').forEach(btn => btn.addEventListener('mousedown', (e) => {
                e.preventDefault();   // keep focus handling simple: fill before the input blurs
                fillFrom(suggestions[Number(btn.dataset.idx)]);
                hideSuggestions();
                checkDuplicate();
            }));
        }
        ['ttRegCode', 'ttRegName'].forEach(id => {
            $(id).addEventListener('input', (e) => {
                e.target.classList.remove('is-invalid');
                clearTimeout(suggestTimer);
                suggestTimer = setTimeout(() => suggest(e.target.value), 250);
                if (id === 'ttRegCode') showDuplicate(null);
            });
            $(id).addEventListener('blur', () => setTimeout(hideSuggestions, 150));
        });
        $('ttRegCode').addEventListener('change', checkDuplicate);
        $('ttRegSec').addEventListener('change', checkDuplicate);
        form.querySelectorAll('.app-input, .app-select').forEach(el =>
            el.addEventListener('input', () => el.classList.remove('is-invalid')));

        $('ttRegClearBtn').addEventListener('click', () => {
            form.querySelectorAll('input').forEach(el => { el.value = ''; el.classList.remove('is-invalid'); });
            $('ttRegCredits').value = 3;
            $('ttRegDay').value = '0';
            setInstructor(form, 'ttReg', {});
            showDuplicate(null);
            hideSuggestions();
        });

        async function register(useExisting) {
            const teacher = readInstructor(form, 'ttReg');
            const body = {
                academicYear: sem.academicYear,
                term: sem.term,
                courseCode: $('ttRegCode').value.trim().toUpperCase(),
                courseName: $('ttRegName').value.trim(),
                credits: parseInt($('ttRegCredits').value, 10),
                sectionNo: $('ttRegSec').value,
                dayOfWeek: parseInt($('ttRegDay').value, 10),
                startTime: $('ttRegStart').value,
                endTime: $('ttRegEnd').value,
                room: $('ttRegRoom').value.trim(),
                instructorId: teacher.instructorId,
                instructorName: teacher.instructorName,
                useExisting,
            };
            if (!useExisting) {
                const missing = [];
                const need = (ok, id, label) => { if (!ok) { $(id).classList.add('is-invalid'); missing.push(label); } };
                need(body.courseCode, 'ttRegCode', 'รหัสวิชา');
                need(body.courseName, 'ttRegName', 'ชื่อวิชา');
                need(body.credits > 0, 'ttRegCredits', 'หน่วยกิต');
                need(body.instructorId || body.instructorName, $('ttRegTeacher').value === '__other' ? 'ttRegTeacherName' : 'ttRegTeacher', 'อาจารย์ผู้สอน');
                need(body.startTime, 'ttRegStart', 'เวลาเริ่ม');
                need(body.endTime, 'ttRegEnd', 'เวลาสิ้นสุด');
                if (missing.length) {
                    showPetitionToast('error', `กรุณากรอก ${missing.join(', ')}`);
                    return;
                }
                if (!isValidCourseCode(body.courseCode)) {
                    $('ttRegCode').classList.add('is-invalid');
                    showPetitionToast('error', 'รหัสวิชาใส่ได้เฉพาะภาษาอังกฤษและตัวเลขเท่านั้น เช่น CS3101');
                    return;
                }
                if (body.startTime >= body.endTime) {
                    $('ttRegEnd').classList.add('is-invalid');
                    showPetitionToast('error', 'เวลาสิ้นสุดต้องหลังเวลาเริ่ม');
                    return;
                }
            }
            submitBtn.disabled = true;
            try {
                const saved = await fetchAPI(`/students/${encodeURIComponent(studentId)}/self-registration`, 'POST', body, 10000);
                showPetitionToast('success', esc(`ลงทะเบียน ${saved.courseCode} ${saved.courseName} แล้ว บันทึกลงตารางเรียนเรียบร้อย ✅`));
                cartOpen = false;
                await load(true);
            } catch (err) {
                const parsed = apiErrorBody(err);
                if (parsed?.details?.sectionId) {
                    showDuplicate(parsed.details);
                    showPetitionToast('info', esc(parsed.error));
                } else {
                    showPetitionToast('error', esc(apiErrorMessage(err)));
                }
            } finally {
                submitBtn.disabled = false;
            }
        }
        submitBtn.addEventListener('click', () => register(!!existingSection));


        // ── Event: Drop a course ──
        document.querySelectorAll('.tt-delete-course').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const entry = sem.schedule[parseInt(btn.dataset.courseIdx, 10)];
                const pending = entry.status === 'PENDING';
                if (!await confirmDialog(pending
                    ? `ยกเลิกคำขอลงทะเบียน ${entry.subjectCode} ${entry.subjectName}?`
                    : `ถอนวิชา ${entry.subjectCode} ${entry.subjectName} ออกจากตารางเรียน?`)) return;
                try {
                    await fetchAPI(`/students/${encodeURIComponent(studentId)}/enrollments/${entry.sectionId}`, 'DELETE', null, 8000);
                    showPetitionToast('success', esc(pending ? `ยกเลิกคำขอ ${entry.subjectCode} แล้ว` : `ถอนวิชา ${entry.subjectCode} ออกจากตารางเรียนแล้ว`));
                    await load(true);
                } catch (err) {
                    showPetitionToast('error', apiErrorMessage(err));
                }
            });
        });
    }

    render(currentIdx);
    load(false);
}
