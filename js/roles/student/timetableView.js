/* ============================================================
   BSRU Student Portal — Student Timetable & Registration Cart
   ============================================================ */

import { confirmDialog } from '../../components/confirmDialog.js';
import { esc, showToast } from '../../utils.js';
import { fetchAPI } from '../../api.js';
import { MOCK_EXAM_ANNOUNCEMENTS } from '../advisor.js';
import { showPetitionToast } from './petitionsView.js';

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

/** Build desktop CSS Grid schedule matrix */
export function buildTimetableDesktopHTML(schedule, showDelete) {
    // Determine which time slots are actually used
    let minSlot = 14, maxSlot = 0;
    schedule.forEach(e => {
        const s = timeToSlot(e.startTime);
        const end = timeToSlot(e.endTime);
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
        const rowEnd = (timeToSlot(e.endTime) - minSlot) + 2;
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
            <div style="font-size:0.82rem">กดปุ่ม "+ เพิ่มวิชาเรียน" ด้านบนเพื่อลงข้อมูลตารางเรียน</div>
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
    let studentSection = null;   // Sec D1 / D2, set by the admin
    let cartOpen = false;
    const carts = {};            // "year/term" -> course codes picked but not sent yet

    async function load(keepSelection) {
        const selected = semesters[currentIdx];
        try {
            const [terms, periods, profile] = await Promise.all([
                fetchAPI(`/students/${encodeURIComponent(studentId)}/timetable`),
                fetchAPI('/registration-periods'),
                fetchAPI(`/students/${encodeURIComponent(studentId)}`).catch(() => null),
            ]);
            semesters = timetableFromApi(terms, periods);
            studentSection = profile?.studentSection || null;
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
        const canEdit = !sem.offline && !!sem.registration?.open;
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
                <!-- Registration cart: pick several courses, check them, then send them together -->
                <div id="ttCartPanel" style="display:${cartOpen ? 'block' : 'none'}" class="app-form-panel">
                    <div class="app-form-header">
                        <div>
                            <div class="app-form-title">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                                ลงทะเบียนเรียน (${esc(sem.label)})${studentSection ? ` · Sec ${esc(studentSection)}` : ''}
                            </div>
                            <div class="app-form-subtitle">พิมพ์รหัสวิชาแล้วกด "เพิ่มลงรายการ" ได้หลายวิชา ระบบเลือกกลุ่มเรียนตาม Sec ของคุณ และตรวจที่นั่งกับเวลาชนให้ เมื่อครบแล้วกด "ยืนยันลงทะเบียน" คำขอจะรอผู้ดูแลระบบยืนยัน</div>
                        </div>
                        <button type="button" class="btn btn-sm btn-ghost" id="ttCloseFormBtn" style="padding:4px 10px;font-size:0.8rem">✕ ปิด</button>
                    </div>

                    <div class="batch-filter-bar" style="flex-wrap:wrap;gap:8px">
                        <input type="text" id="ttCartCode" class="app-input" placeholder="รหัสวิชา เช่น CS3401" style="max-width:220px">
                        <button class="btn btn-sm btn-orange" id="ttCartAddBtn">เพิ่มลงรายการ</button>
                    </div>
                    <div id="ttCartList" style="margin-top:12px"></div>

                    <div class="app-form-actions">
                        <button class="app-btn-primary" id="ttCartSubmitBtn" disabled>ยืนยันลงทะเบียน</button>
                        <button class="app-btn-ghost" id="ttCartClearBtn">ล้างรายการ</button>
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

        // ── Registration cart ──
        const cartKey = `${sem.academicYear}/${sem.term}`;
        const cart = carts[cartKey] || (carts[cartKey] = []);
        const panel = document.getElementById('ttCartPanel');
        const submitBtn = document.getElementById('ttCartSubmitBtn');

        document.getElementById('ttToggleAddCourse').addEventListener('click', () => {
            cartOpen = panel.style.display === 'none';
            panel.style.display = cartOpen ? 'block' : 'none';
            if (cartOpen) document.getElementById('ttCartCode').focus();
        });
        document.getElementById('ttCloseFormBtn').addEventListener('click', () => {
            cartOpen = false;
            panel.style.display = 'none';
        });

        /** Ask the backend about the whole cart and show seats, time clashes and other problems per course */
        async function refreshCart() {
            const list = document.getElementById('ttCartList');
            if (!list) return;
            submitBtn.disabled = true;
            submitBtn.textContent = 'ยืนยันลงทะเบียน';
            if (cart.length === 0) {
                list.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem">ยังไม่มีวิชาในรายการ</div>';
                return;
            }
            let check;
            try {
                check = await fetchAPI(`/students/${encodeURIComponent(studentId)}/registration/check`, 'POST', {
                    academicYear: sem.academicYear, term: sem.term, courseCodes: cart,
                }, 8000);
            } catch (err) {
                list.innerHTML = `<div class="tt-cart-problem">${esc(apiErrorMessage(err))}</div>`;
                return;
            }
            const rows = check.items.map((item, i) => {
                const s = item.section;
                const seats = !s ? '-' : item.seatsLeft === null ? 'ไม่จำกัด' : `เหลือ ${item.seatsLeft}`;
                const state = item.problems.length
                    ? item.problems.map(p => `<div class="tt-cart-problem">⚠️ ${esc(p)}</div>`).join('')
                    : '<span class="badge badge-green">พร้อมลงทะเบียน</span>';
                return `
                    <tr>
                        <td><span class="badge badge-blue">${esc(item.courseCode)}</span>${s ? `<div style="font-size:0.82rem">${esc(s.courseName)}</div>` : ''}</td>
                        <td>${s ? esc(s.sectionNo) : '-'}</td>
                        <td>${s ? `${esc(s.dayName)} ${esc(s.startTime)}–${esc(s.endTime)}` : '-'}</td>
                        <td class="hide-mobile">${s ? s.credits : '-'}</td>
                        <td>${seats}</td>
                        <td>${state}</td>
                        <td><button class="btn btn-sm btn-ghost tt-cart-remove" data-idx="${i}" title="เอาออกจากรายการ">✕</button></td>
                    </tr>`;
            }).join('');
            list.innerHTML = `
                <div class="table-wrap">
                    <table class="data-table">
                        <thead><tr><th>วิชา</th><th>Sec</th><th>วัน-เวลา</th><th class="hide-mobile">หน่วยกิต</th><th>ที่นั่ง</th><th>ตรวจสอบ</th><th></th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                <div style="font-size:0.85rem;margin-top:8px">รวม <strong>${check.items.length}</strong> วิชา · <strong>${check.totalCredits}</strong> หน่วยกิต</div>`;
            list.querySelectorAll('.tt-cart-remove').forEach(btn => btn.addEventListener('click', () => {
                cart.splice(parseInt(btn.dataset.idx, 10), 1);
                refreshCart();
            }));
            submitBtn.disabled = !check.ok;
            submitBtn.textContent = `ยืนยันลงทะเบียน (${check.items.length} วิชา)`;
        }

        const addToCart = () => {
            const input = document.getElementById('ttCartCode');
            const code = input.value.trim().toUpperCase();
            if (!code) {
                input.classList.add('is-invalid');
                showPetitionToast('error', 'กรุณากรอกรหัสวิชา');
                return;
            }
            if (cart.includes(code)) {
                showPetitionToast('info', `${esc(code)} อยู่ในรายการแล้ว`);
                return;
            }
            cart.push(code);
            input.value = '';
            input.focus();
            refreshCart();
        };
        document.getElementById('ttCartAddBtn').addEventListener('click', addToCart);
        document.getElementById('ttCartCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') addToCart(); });
        document.getElementById('ttCartCode').addEventListener('input', (e) => e.target.classList.remove('is-invalid'));
        document.getElementById('ttCartClearBtn').addEventListener('click', () => {
            cart.splice(0, cart.length);
            refreshCart();
        });

        submitBtn.addEventListener('click', async () => {
            submitBtn.disabled = true;
            try {
                const result = await fetchAPI(`/students/${encodeURIComponent(studentId)}/registration`, 'POST', {
                    academicYear: sem.academicYear, term: sem.term, courseCodes: cart,
                }, 10000);
                showPetitionToast('success', `ส่งคำขอลงทะเบียน ${result.items.length} วิชาแล้ว รอผู้ดูแลระบบยืนยัน ✅`);
                cart.splice(0, cart.length);
                cartOpen = false;
                await load(true);
            } catch (err) {
                showPetitionToast('error', esc(apiErrorMessage(err)));
                refreshCart();
            }
        });

        refreshCart();

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
