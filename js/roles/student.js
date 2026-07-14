import { esc, fmt, gradeClass, statusBadge } from '../main.js';
import { MOCK_STUDENTS_POOL, MOCK_ADVISORS } from './admin.js';

/* ============================================================
   MOCK DATA — Timetable schedules grouped by semester
   Each semester has a label and an array of schedule entries.
   Each entry defines: day (0=Mon…6=Sun), startSlot (0-based
   index into 14 hourly slots starting at 07:00), span (colspan),
   and label text shown inside the cell.
   ============================================================ */
const MOCK_TIMETABLE_SEMESTERS = [
    {
        label: 'Term 2/2566',
        schedule: [
            { day: 0, startSlot: 2, span: 3, text: 'SC17351, D1, 423' },       // Monday 09:00-12:00
            { day: 2, startSlot: 5, span: 3, text: 'SC17411, D1, 6121' },      // Wednesday 12:00-15:00
            { day: 2, startSlot: 8, span: 3, text: 'SC17402, D1, 6125' },      // Wednesday 15:00-18:00
            { day: 4, startSlot: 7, span: 3, text: 'SC17353, D2, 6123' },      // Friday 14:00-17:00
        ],
    },
    {
        label: 'Term 1/2566',
        schedule: [
            { day: 0, startSlot: 2, span: 3, text: 'CS2101, D1, CS-301' },     // Monday 09:00-12:00
            { day: 0, startSlot: 6, span: 3, text: 'CS2102, D1, CS-205' },     // Monday 13:00-16:00
            { day: 1, startSlot: 2, span: 3, text: 'CS2201, D1, CS-Lab2' },    // Tuesday 09:00-12:00
            { day: 3, startSlot: 2, span: 3, text: 'CS2103, D2, CS-Lab1' },    // Thursday 09:00-12:00
            { day: 4, startSlot: 2, span: 3, text: 'GE1201, D3, LA-402' },     // Friday 09:00-12:00
        ],
    },
    {
        label: 'Term 2/2565',
        schedule: [
            { day: 1, startSlot: 2, span: 3, text: 'CS2301, D1, CS-Lab2' },    // Tuesday 09:00-12:00
            { day: 2, startSlot: 2, span: 3, text: 'CS2302, D1, CS-Lab3' },    // Wednesday 09:00-12:00
            { day: 3, startSlot: 6, span: 3, text: 'CS2401, D1, CS-205' },     // Thursday 13:00-16:00
            { day: 4, startSlot: 2, span: 3, text: 'GE1301, D3, LA-301' },     // Friday 09:00-12:00
        ],
    },
];

const MOCK_EXAMS = [
    { code: 'CS3101', name: 'ปัญญาประดิษฐ์', date: '18 มี.ค. 2569', time: '09:00-12:00', room: 'HALL-A', seat: 'A-042' },
    { code: 'CS3102', name: 'วิศวกรรมซอฟต์แวร์', date: '20 มี.ค. 2569', time: '13:00-16:00', room: 'HALL-A', seat: 'A-042' },
    { code: 'CS3201', name: 'ระบบฐานข้อมูลขั้นสูง', date: '22 มี.ค. 2569', time: '09:00-12:00', room: 'CS-Lab2', seat: '-' },
    { code: 'CS3301', name: 'เครือข่ายคอมพิวเตอร์', date: '24 มี.ค. 2569', time: '09:00-12:00', room: 'HALL-B', seat: 'B-018' },
    { code: 'CS3103', name: 'การพัฒนาเว็บแอปพลิเคชัน', date: '25 มี.ค. 2569', time: '13:00-16:00', room: 'CS-Lab3', seat: '-' },
    { code: 'GE2301', name: 'ภาษาอังกฤษเชิงวิชาการ', date: '27 มี.ค. 2569', time: '09:00-12:00', room: 'LA-402', seat: 'C-103' },
];

/* ============================================================
   MOCK DATA — Grades grouped by semester
   ============================================================ */
const MOCK_GRADES = {
    semesters: [
        {
            label: 'Term 2/2566',
            courses: [
                { code: 'CS2301', name: 'ระบบฐานข้อมูล', credits: 3, grade: 'A', point: 4.0 },
                { code: 'CS2302', name: 'การเขียนโปรแกรมเว็บ', credits: 3, grade: 'A', point: 4.0 },
                { code: 'CS2303', name: 'ระบบจัดการฐานข้อมูล (Lab)', credits: 1, grade: 'A', point: 4.0 },
                { code: 'CS2401', name: 'วิศวกรรมความต้องการ', credits: 3, grade: 'B+', point: 3.5 },
                { code: 'MA2101', name: 'สถิติสำหรับวิทยาการคอมพิวเตอร์', credits: 3, grade: 'B', point: 3.0 },
                { code: 'GE1301', name: 'จิตวิทยาทั่วไป', credits: 3, grade: 'A', point: 4.0 },
            ],
        },
        {
            label: 'Term 1/2566',
            courses: [
                { code: 'CS2101', name: 'โครงสร้างข้อมูล', credits: 3, grade: 'A', point: 4.0 },
                { code: 'CS2102', name: 'การวิเคราะห์อัลกอริทึม', credits: 3, grade: 'B+', point: 3.5 },
                { code: 'CS2201', name: 'สถาปัตยกรรมคอมพิวเตอร์', credits: 3, grade: 'A', point: 4.0 },
                { code: 'CS2103', name: 'ระบบปฏิบัติการ', credits: 3, grade: 'B+', point: 3.5 },
                { code: 'GE1201', name: 'คณิตศาสตร์ดิสครีต', credits: 3, grade: 'B', point: 3.0 },
                { code: 'GE1102', name: 'ภาษาอังกฤษเพื่อการสื่อสาร', credits: 3, grade: 'A', point: 4.0 },
            ],
        },
        {
            label: 'Term 2/2565',
            courses: [
                { code: 'CS3101', name: 'ปัญญาประดิษฐ์', credits: 3, grade: '-', point: null },
                { code: 'CS3102', name: 'วิศวกรรมซอฟต์แวร์', credits: 3, grade: '-', point: null },
                { code: 'CS3201', name: 'ระบบฐานข้อมูลขั้นสูง', credits: 3, grade: '-', point: null },
                { code: 'CS3301', name: 'เครือข่ายคอมพิวเตอร์', credits: 3, grade: '-', point: null },
                { code: 'CS3103', name: 'การพัฒนาเว็บแอปพลิเคชัน', credits: 3, grade: '-', point: null },
                { code: 'GE2301', name: 'ภาษาอังกฤษเชิงวิชาการ', credits: 3, grade: '-', point: null },
            ],
        },
    ],
};

const MOCK_FINANCE = {
    totalPaid: 142500, currentOwed: 18750,
    scholarship: 'ทุน กยศ. (กองทุนเงินให้กู้ยืมเพื่อการศึกษา)', scholarshipAmount: 40000,
    payments: [
        { semester: '1/2565', amount: 18750, status: 'ชำระแล้ว', date: '15 มิ.ย. 2565', method: 'ธนาคารกรุงไทย' },
        { semester: '2/2565', amount: 18750, status: 'ชำระแล้ว', date: '12 พ.ย. 2565', method: 'ธนาคารกรุงไทย' },
        { semester: '1/2566', amount: 18750, status: 'ชำระแล้ว', date: '18 มิ.ย. 2566', method: 'พร้อมเพย์' },
        { semester: '2/2566', amount: 18750, status: 'ชำระแล้ว', date: '14 พ.ย. 2566', method: 'พร้อมเพย์' },
        { semester: '1/2567', amount: 18750, status: 'ค้างชำระ', date: '-', method: '-' },
    ],
};

const MOCK_GRADUATION = {
    requiredCredits: 132, earnedCredits: 96,
    coreRequired: 72, coreEarned: 54,
    geRequired: 30, geEarned: 24,
    electiveRequired: 18, electiveEarned: 12,
    freeRequired: 12, freeEarned: 6,
    gpaRequired: 2.0, currentGpa: 3.42,
    activityRequired: 6, activityCompleted: 4,
    status: 'กำลังดำเนินการ',
};

const MOCK_ACTIVITIES = [
    { name: 'ปฐมนิเทศนักศึกษาใหม่', date: '5 มิ.ย. 2565', type: 'มหาวิทยาลัย', hours: 6, status: 'ผ่าน', icon: '🏫' },
    { name: 'อบรม Python for Data Science', date: '20 ส.ค. 2565', type: 'วิชาการ', hours: 12, status: 'ผ่าน', icon: '💻' },
    { name: 'จิตอาสา — สอนคอมพิวเตอร์ชุมชน', date: '15 ต.ค. 2565', type: 'จิตอาสา', hours: 8, status: 'ผ่าน', icon: '🤝' },
    { name: 'แข่งขัน Hackathon BSRU', date: '12 ก.พ. 2566', type: 'วิชาการ', hours: 24, status: 'ผ่าน', icon: '🏆' },
    { name: 'กีฬาสีคณะวิทยาศาสตร์', date: '5 มี.ค. 2566', type: 'กีฬา', hours: 6, status: 'ผ่าน', icon: '⚽' },
    { name: 'สัมมนา AI & Future of Work', date: '22 ก.ย. 2566', type: 'วิชาการ', hours: 6, status: 'ผ่าน', icon: '🤖' },
    { name: 'ค่ายอาสาพัฒนา จ.กาญจนบุรี', date: '10 ม.ค. 2567', type: 'จิตอาสา', hours: 18, status: 'รอตรวจสอบ', icon: '🏕️' },
    { name: 'อบรม Cloud Computing Workshop', date: '15 ก.พ. 2567', type: 'วิชาการ', hours: 8, status: 'ลงทะเบียนแล้ว', icon: '☁️' },
];

function getStudentFullData(studentId) {
    const base = MOCK_STUDENTS_POOL.find(s => s.studentId === studentId) || MOCK_STUDENTS_POOL[0];
    const creditsMap = { 3: 96, 2: 48, 1: 18 };
    const admitMap = { 3: 2564, 2: 2565, 1: 2566 };
    return {
        ...base,
        faculty: 'คณะวิทยาศาสตร์และเทคโนโลยี',
        department: 'สาขาวิทยาการคอมพิวเตอร์',
        advisor: MOCK_ADVISORS.find(a => a.id === base.advisor)?.nameTh || 'ผศ.ดร.วิชัย เทคโนโลยี',
        email: base.nameEn.split(' ')[0].toLowerCase() + '.' + base.nameEn.split(' ')[1][0].toLowerCase() + '@bsru.ac.th',
        phone: '08' + Math.floor(10000000 + Math.random() * 90000000),
        credits: creditsMap[base.year] || 48,
        admitYear: admitMap[base.year] || 2565,
        birthDate: Math.floor(1 + Math.random() * 28) + ' ' + ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][Math.floor(Math.random() * 12)] + ' 2546',
        address: '123 ถ.อิสรภาพ แขวงหิรัญรูจี เขตธนบุรี กรุงเทพฯ 10600',
    };
}

/* ============================================================
   MAIN ENTRY POINT
   ============================================================ */
export function initStudentDashboard(studentId) {
    const student = getStudentFullData(studentId);
    renderBibliography(student);
    renderTimetable();
    renderFinance();
    renderGrades(student);
    renderGraduation(student);
    renderActivity();
}

/* ============================================================
   BIBLIOGRAPHY
   ============================================================ */
function renderBibliography(s) {
    document.getElementById('bibliographyContent').innerHTML = `
        <div class="card">
            <div class="profile-top">
                <div class="profile-avatar-wrap">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div class="profile-info">
                    <div class="profile-name">${esc(s.nameTh)}</div>
                    <div class="profile-id">รหัส ${esc(s.studentId)} · ${esc(s.nameEn)}</div>
                    <div class="profile-detail-grid">
                        <div class="profile-item"><span class="label">คณะ</span><span class="value">${esc(s.faculty)}</span></div>
                        <div class="profile-item"><span class="label">สาขา</span><span class="value">${esc(s.department)}</span></div>
                        <div class="profile-item"><span class="label">ชั้นปี</span><span class="value">ปี ${s.year}</span></div>
                        <div class="profile-item"><span class="label">สถานภาพ</span><span class="value">${esc(s.status)}</span></div>
                        <div class="profile-item"><span class="label">อาจารย์ที่ปรึกษา</span><span class="value">${esc(s.advisor)}</span></div>
                        <div class="profile-item"><span class="label">วันเกิด</span><span class="value">${esc(s.birthDate)}</span></div>
                        <div class="profile-item"><span class="label">Email</span><span class="value">${esc(s.email)}</span></div>
                        <div class="profile-item"><span class="label">โทรศัพท์</span><span class="value">${esc(s.phone)}</span></div>
                        <div class="profile-item"><span class="label">ปีเข้าศึกษา</span><span class="value">${s.admitYear}</span></div>
                        <div class="profile-item"><span class="label">ที่อยู่</span><span class="value">${esc(s.address)}</span></div>
                    </div>
                </div>
            </div>
        </div>
        <div class="stat-row">
            <div class="stat-card"><div class="stat-icon purple">🎓</div><div><div class="stat-value">${s.gpa.toFixed(2)}</div><div class="stat-label">GPA สะสม</div></div></div>
            <div class="stat-card"><div class="stat-icon green">📚</div><div><div class="stat-value">${s.credits}</div><div class="stat-label">หน่วยกิตสะสม</div></div></div>
            <div class="stat-card"><div class="stat-icon amber">📅</div><div><div class="stat-value">ปี ${s.year}</div><div class="stat-label">ชั้นปีปัจจุบัน</div></div></div>
            <div class="stat-card"><div class="stat-icon blue">📖</div><div><div class="stat-value">6</div><div class="stat-label">วิชาที่ลงเรียน</div></div></div>
        </div>`;
}

/* ============================================================
   TIMETABLE — with Semester Filter
   ============================================================ */

/** Build a single 15-column schedule table body from a semester's schedule array */
function buildTimetableHTML(schedule) {
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const TOTAL_SLOTS = 14;

    let tbody = '';
    DAYS.forEach((dayName, dayIdx) => {
        const isWeekend = dayIdx >= 5;
        const dayClass = isWeekend ? 'day-col weekend' : 'day-col';

        // Collect entries for this day, sorted by startSlot
        const entries = schedule
            .filter(e => e.day === dayIdx)
            .sort((a, b) => a.startSlot - b.startSlot);

        let cells = '';
        let cursor = 0; // current slot position (0-based, 0 = 07:00-08:00)

        for (const entry of entries) {
            // Fill empty slots before this entry
            while (cursor < entry.startSlot) {
                cells += '<td></td>';
                cursor++;
            }
            // The scheduled class cell
            cells += `<td colspan="${entry.span}" class="subject">${esc(entry.text)}</td>`;
            cursor += entry.span;
        }
        // Fill remaining empty slots
        while (cursor < TOTAL_SLOTS) {
            cells += '<td></td>';
            cursor++;
        }

        tbody += `<tr><td class="${dayClass}">${dayName}</td>${cells}</tr>`;
    });

    return `
        <div class="timetable-wrapper">
            <table class="schedule-table data-table">
                <thead>
                    <tr>
                        <th>Day/Time</th>
                        <th>07:00-08:00</th>
                        <th>08:00-09:00</th>
                        <th>09:00-10:00</th>
                        <th>10:00-11:00</th>
                        <th>11:00-12:00</th>
                        <th>12:00-13:00</th>
                        <th>13:00-14:00</th>
                        <th>14:00-15:00</th>
                        <th>15:00-16:00</th>
                        <th>16:00-17:00</th>
                        <th>17:00-18:00</th>
                        <th>18:00-19:00</th>
                        <th>19:00-20:00</th>
                        <th>20:00-21:00</th>
                    </tr>
                </thead>
                <tbody>${tbody}</tbody>
            </table>
        </div>`;
}

/** Build the semester <select> options for timetable */
function buildTimetableSemesterOptions(selectedIdx) {
    return MOCK_TIMETABLE_SEMESTERS.map((sem, i) =>
        `<option value="${i}"${i === selectedIdx ? ' selected' : ''}>${esc(sem.label)}</option>`
    ).join('');
}

function renderTimetable() {
    const container = document.getElementById('timetableContent');
    // Default to the first (most recent) semester
    let currentIdx = 0;

    function render(idx) {
        const sem = MOCK_TIMETABLE_SEMESTERS[idx];
        container.innerHTML = `
            <div class="card">
                <div class="card-title">📖 Study/Exams Timetable</div>
                <div class="batch-filter-bar" style="margin-bottom:16px">
                    <label>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        Semester
                    </label>
                    <select class="batch-select" id="timetableSemesterSelect">
                        ${buildTimetableSemesterOptions(idx)}
                    </select>
                    <span class="filter-result-count">Showing: <strong>${esc(sem.label)}</strong></span>
                </div>
                <div id="timetableTableBody">
                    ${buildTimetableHTML(sem.schedule)}
                </div>
            </div>`;

        // Attach change listener
        document.getElementById('timetableSemesterSelect').addEventListener('change', (e) => {
            currentIdx = parseInt(e.target.value, 10);
            render(currentIdx);
        });
    }

    render(currentIdx);
}

/* ============================================================
   FINANCE
   ============================================================ */
function renderFinance() {
    const f = MOCK_FINANCE;
    const payRows = f.payments.map(p => `<tr><td>${esc(p.semester)}</td><td>${fmt(p.amount)} ฿</td><td><span class="badge ${statusBadge(p.status)}">${esc(p.status)}</span></td><td>${esc(p.date)}</td><td>${esc(p.method)}</td></tr>`).join('');
    document.getElementById('financeContent').innerHTML = `
        <div class="stat-row">
            <div class="finance-summary" style="flex:2"><h3>ยอดค้างชำระ</h3><div class="finance-amount">${fmt(f.currentOwed)} ฿</div><div class="finance-sub">ภาคเรียนที่ 1/2567</div></div>
            <div class="stat-card" style="flex:1"><div class="stat-icon green">💰</div><div><div class="stat-value">${fmt(f.totalPaid)}</div><div class="stat-label">ชำระแล้วทั้งหมด (฿)</div></div></div>
        </div>
        <div class="card"><div class="card-title">🎓 ทุนการศึกษา <span class="badge badge-green">ได้รับทุน</span></div><div class="profile-detail-grid"><div class="profile-item"><span class="label">ชื่อทุน</span><span class="value">${esc(f.scholarship)}</span></div><div class="profile-item"><span class="label">จำนวน</span><span class="value">${fmt(f.scholarshipAmount)} ฿/ปี</span></div></div></div>
        <div class="card"><div class="card-title">📋 ประวัติการชำระเงิน</div><div class="table-wrap"><table class="data-table"><thead><tr><th>ภาคเรียน</th><th>จำนวน</th><th>สถานะ</th><th>วันที่</th><th>ช่องทาง</th></tr></thead><tbody>${payRows}</tbody></table></div></div>`;
}

/* ============================================================
   GRADES (Studied Result) — with Semester Filter
   ============================================================ */

/** Build the semester <select> options for grades */
function buildGradesSemesterOptions(selectedIdx) {
    return MOCK_GRADES.semesters.map((sem, i) =>
        `<option value="${i}"${i === selectedIdx ? ' selected' : ''}>${esc(sem.label)}</option>`
    ).join('');
}

/** Build the grades table body for a given semester index */
function buildGradesBody(idx) {
    const sem = MOCK_GRADES.semesters[idx];
    const done = sem.courses.filter(c => c.point !== null);
    const tp = done.reduce((a, c) => a + c.point * c.credits, 0);
    const tc = done.reduce((a, c) => a + c.credits, 0);
    const semGpa = tc > 0 ? (tp / tc).toFixed(2) : '-';
    const rows = sem.courses.map(c =>
        `<tr><td><strong>${esc(c.code)}</strong></td><td>${esc(c.name)}</td><td style="text-align:center">${c.credits}</td><td style="text-align:center"><span class="grade ${gradeClass(c.grade)}">${c.grade}</span></td><td style="text-align:center">${c.point !== null ? c.point.toFixed(1) : '-'}</td></tr>`
    ).join('');

    return `
        <div class="table-wrap">
            <table class="data-table">
                <thead><tr><th>รหัส</th><th>ชื่อวิชา</th><th style="text-align:center">หน่วยกิต</th><th style="text-align:center">เกรด</th><th style="text-align:center">คะแนน</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:24px;margin-top:12px;font-size:0.85rem">
            <span>หน่วยกิตลงทะเบียน: <strong>${sem.courses.reduce((a, c) => a + c.credits, 0)}</strong></span>
            <span>GPA: <strong style="color:var(--p-600)">${semGpa}</strong></span>
        </div>`;
}

function renderGrades(student) {
    const container = document.getElementById('gradesContent');
    let currentIdx = 0; // default to most recent semester

    function render(idx) {
        const sem = MOCK_GRADES.semesters[idx];
        container.innerHTML = `
            <div class="stat-row">
                <div class="stat-card"><div class="stat-icon purple">📊</div><div><div class="stat-value">${student.gpa.toFixed(2)}</div><div class="stat-label">GPA สะสม</div></div></div>
                <div class="stat-card"><div class="stat-icon green">📚</div><div><div class="stat-value">${student.credits}</div><div class="stat-label">หน่วยกิตสะสม</div></div></div>
                <div class="stat-card"><div class="stat-icon amber">📋</div><div><div class="stat-value">${MOCK_GRADES.semesters.length}</div><div class="stat-label">ภาคเรียนทั้งหมด</div></div></div>
            </div>
            <div class="card">
                <div class="card-title">📖 ผลการเรียนรายภาคเรียน (Studied Result)</div>
                <div class="batch-filter-bar" style="margin-bottom:16px">
                    <label>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        Semester
                    </label>
                    <select class="batch-select" id="gradesSemesterSelect">
                        ${buildGradesSemesterOptions(idx)}
                    </select>
                    <span class="filter-result-count">Showing: <strong>${esc(sem.label)}</strong></span>
                </div>
                <div id="gradesTableBody">
                    ${buildGradesBody(idx)}
                </div>
            </div>`;

        // Attach change listener
        document.getElementById('gradesSemesterSelect').addEventListener('change', (e) => {
            currentIdx = parseInt(e.target.value, 10);
            render(currentIdx);
        });
    }

    render(currentIdx);
}

/* ============================================================
   GRADUATION PROGRESS
   ============================================================ */
function renderGraduation(student) {
    const g = MOCK_GRADUATION;
    const pct = (e, r) => Math.min(Math.round((e / r) * 100), 100);
    const fc = p => p >= 100 ? 'green' : p >= 60 ? '' : p >= 30 ? 'amber' : 'red';
    const tp = pct(g.earnedCredits, g.requiredCredits);
    const data = [
        ['หน่วยกิตรวม', g.earnedCredits, g.requiredCredits],
        ['วิชาเฉพาะด้าน', g.coreEarned, g.coreRequired],
        ['วิชาศึกษาทั่วไป', g.geEarned, g.geRequired],
        ['วิชาเลือกเสรี', g.electiveEarned, g.electiveRequired],
        ['วิชาเลือกอิสระ', g.freeEarned, g.freeRequired],
        ['กิจกรรม', g.activityCompleted, g.activityRequired],
    ];
    const bars = data.map(([label, earned, req]) => {
        const p = pct(earned, req);
        return `<div class="progress-group"><div class="progress-label"><strong>${label}</strong><span>${earned}/${req} (${p}%)</span></div><div class="progress-bar"><div class="progress-fill ${fc(p)}" style="width:0%" data-target="${p}"></div></div></div>`;
    }).join('');
    document.getElementById('graduationContent').innerHTML = `
        <div class="stat-row">
            <div class="stat-card"><div class="stat-icon purple">🎓</div><div><div class="stat-value">${tp}%</div><div class="stat-label">ความคืบหน้า</div></div></div>
            <div class="stat-card"><div class="stat-icon green">📊</div><div><div class="stat-value">${student.gpa.toFixed(2)}</div><div class="stat-label">GPA (≥ ${g.gpaRequired.toFixed(1)})</div></div></div>
            <div class="stat-card"><div class="stat-icon amber">📚</div><div><div class="stat-value">${g.earnedCredits}/${g.requiredCredits}</div><div class="stat-label">หน่วยกิตสะสม</div></div></div>
            <div class="stat-card"><div class="stat-icon blue">📋</div><div><div class="stat-value">${esc(g.status)}</div><div class="stat-label">สถานะ</div></div></div>
        </div>
        <div class="card"><div class="card-title">📈 ความคืบหน้ารายหมวด</div>${bars}</div>`;
    setTimeout(() => {
        document.querySelectorAll('#mod-graduation .progress-fill').forEach(bar => { bar.style.width = bar.dataset.target + '%'; });
    }, 100);
}

/* ============================================================
   ACTIVITIES
   ============================================================ */
function renderActivity() {
    const totalHours = MOCK_ACTIVITIES.reduce((a, c) => a + c.hours, 0);
    const passed = MOCK_ACTIVITIES.filter(a => a.status === 'ผ่าน').length;
    const cards = MOCK_ACTIVITIES.map(a => `
        <div class="activity-card">
            <div class="activity-icon" style="background:var(--p-50)">${a.icon}</div>
            <div class="activity-body"><div class="activity-title">${esc(a.name)}</div><div class="activity-meta">${esc(a.date)} · ${esc(a.type)} · ${a.hours} ชม.</div></div>
            <span class="activity-status badge ${statusBadge(a.status)}">${esc(a.status)}</span>
        </div>`).join('');
    document.getElementById('activityContent').innerHTML = `
        <div class="stat-row">
            <div class="stat-card"><div class="stat-icon purple">📋</div><div><div class="stat-value">${MOCK_ACTIVITIES.length}</div><div class="stat-label">กิจกรรมทั้งหมด</div></div></div>
            <div class="stat-card"><div class="stat-icon green">✅</div><div><div class="stat-value">${passed}</div><div class="stat-label">ผ่านแล้ว</div></div></div>
            <div class="stat-card"><div class="stat-icon amber">⏱️</div><div><div class="stat-value">${totalHours}</div><div class="stat-label">ชั่วโมงสะสม</div></div></div>
        </div>${cards}`;
}
