import { esc, fmt, gradeClass, statusBadge } from '../main.js';
import { MOCK_STUDENTS_POOL, MOCK_ADVISORS, MOCK_PETITIONS_LOG } from './admin.js';
import { MOCK_EXAM_ANNOUNCEMENTS } from './advisor.js';
import { fetchAPI } from '../api.js';

/* ============================================================
   MOCK DATA — Timetable schedules grouped by semester
   Each semester has a label and an array of schedule entries.
   Each entry defines: day (0=Mon…6=Sun), startSlot (0-based
   index into 14 hourly slots starting at 07:00), span (colspan),
   and label text shown inside the cell.
   ============================================================ */
let MOCK_TIMETABLE_SEMESTERS = [
    {
        label: 'Term 2/2566',
        schedule: [
            { day: 0, startTime: '09:00', endTime: '12:00', subjectCode: 'SC17351', subjectName: 'Object-Oriented Programming', teacherName: 'Dr. Somchai', room: 'Room 423' },
            { day: 2, startTime: '12:00', endTime: '15:00', subjectCode: 'SC17411', subjectName: 'Web Development', teacherName: 'Dr. Suda', room: 'Room 6121' },
            { day: 2, startTime: '15:00', endTime: '18:00', subjectCode: 'SC17402', subjectName: 'Software Engineering', teacherName: 'Prof. Anan', room: 'Room 6125' },
            { day: 4, startTime: '14:00', endTime: '17:00', subjectCode: 'SC17353', subjectName: 'Data Structures', teacherName: 'Dr. Wicha', room: 'Room 6123' },
        ],
    },
    {
        label: 'Term 1/2566',
        schedule: [
            { day: 0, startTime: '09:00', endTime: '12:00', subjectCode: 'CS2101', subjectName: 'Data Structures', teacherName: 'Dr. Wicha', room: 'CS-301' },
            { day: 0, startTime: '13:00', endTime: '16:00', subjectCode: 'CS2102', subjectName: 'Algorithms', teacherName: 'Prof. Anan', room: 'CS-205' },
            { day: 1, startTime: '09:00', endTime: '12:00', subjectCode: 'CS2201', subjectName: 'Computer Architecture', teacherName: 'Dr. Somchai', room: 'CS-Lab2' },
            { day: 3, startTime: '09:00', endTime: '12:00', subjectCode: 'CS2103', subjectName: 'Operating Systems', teacherName: 'Dr. Suda', room: 'CS-Lab1' },
            { day: 4, startTime: '09:00', endTime: '12:00', subjectCode: 'GE1201', subjectName: 'English for IT', teacherName: 'Aj. Sarah', room: 'LA-402' },
        ],
    },
    {
        label: 'Term 2/2565',
        schedule: [
            { day: 1, startTime: '09:00', endTime: '12:00', subjectCode: 'CS2301', subjectName: 'Database Systems', teacherName: 'Dr. Manop', room: 'CS-Lab2' },
            { day: 2, startTime: '09:00', endTime: '12:00', subjectCode: 'CS2302', subjectName: 'Web Programming', teacherName: 'Aj. Suda', room: 'CS-Lab3' },
            { day: 3, startTime: '13:00', endTime: '16:00', subjectCode: 'CS2401', subjectName: 'Requirements Engineering', teacherName: 'Prof. Anan', room: 'CS-205' },
            { day: 4, startTime: '09:00', endTime: '12:00', subjectCode: 'GE1301', subjectName: 'General Psychology', teacherName: 'Aj. Yupa', room: 'LA-301' },
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
    totalPaid: 75000, currentOwed: 18750,
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

/* ============================================================
   EDITABLE STUDENT DATA STORE
   Stores student-editable fields keyed by studentId.
   ============================================================ */
const studentEditableData = {};

function getStudentFullData(studentId) {
    const base = MOCK_STUDENTS_POOL.find(s => s.studentId === studentId) || MOCK_STUDENTS_POOL[0];
    const creditsMap = { 3: 96, 2: 48, 1: 18 };
    const admitMap = { 3: 2564, 2: 2565, 1: 2566 };

    // Initialize editable data from localStorage or defaults
    if (!studentEditableData[studentId]) {
        let saved = null;
        try {
            saved = JSON.parse(localStorage.getItem('studentEditableData_' + studentId));
        } catch (e) {}

        studentEditableData[studentId] = saved || {
            email: base.nameEn.split(' ')[0].toLowerCase() + '.' + base.nameEn.split(' ')[1][0].toLowerCase() + '@bsru.ac.th',
            phone: '08' + Math.floor(10000000 + Math.random() * 90000000),
            birthDate: Math.floor(1 + Math.random() * 28) + ' ' + ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][Math.floor(Math.random() * 12)] + ' 2546',
            religion: 'พุทธ',
            address: '123 ถ.อิสรภาพ แขวงหิรัญรูจี เขตธนบุรี กรุงเทพฯ 10600',
            avatar: null,
        };
    }
    const editable = studentEditableData[studentId];

    return {
        ...base,
        faculty: 'คณะวิทยาศาสตร์และเทคโนโลยี',
        department: 'สาขาวิทยาการคอมพิวเตอร์',
        advisor: MOCK_ADVISORS.find(a => a.id === base.advisor)?.nameTh || 'ผศ.ดร.วิชัย เทคโนโลยี',
        email: editable.email,
        phone: editable.phone,
        credits: creditsMap[base.year] || 48,
        admitYear: admitMap[base.year] || 2565,
        birthDate: editable.birthDate,
        religion: editable.religion || 'พุทธ',
        address: editable.address,
        avatar: editable.avatar || null,
    };
}

function updateTopbarAvatar(avatarUrl) {
    const topbarAvatar = document.getElementById('topbarAvatar');
    if (topbarAvatar) {
        if (avatarUrl) {
            topbarAvatar.innerHTML = `<img src="${avatarUrl}" class="topbar-avatar-img" alt="User Avatar">`;
        } else {
            topbarAvatar.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                </svg>`;
        }
    }
}

/* ============================================================
   MAIN ENTRY POINT
   ============================================================ */
export function initStudentDashboard(studentId) {
    const student = getStudentFullData(studentId);
    updateTopbarAvatar(student.avatar);
    renderBibliography(student);
    renderTimetable();
    renderFinance();
    renderGrades(student);
    renderGraduation(student);
    renderActivity();
    renderPetitions(student);
}

/* ============================================================
   THAI DATE CONVERSION HELPERS
   ============================================================ */
const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** Convert Thai date string e.g. "15 ม.ค. 2546" to ISO date "2003-01-15" */
function thaiDateToISO(thaiDateStr) {
    if (!thaiDateStr) return '';
    const parts = thaiDateStr.trim().split(/\s+/);
    if (parts.length < 3) return '';
    const day = parseInt(parts[0], 10);
    const monthIdx = THAI_MONTHS_SHORT.indexOf(parts[1]);
    const yearBE = parseInt(parts[2], 10);
    if (isNaN(day) || monthIdx === -1 || isNaN(yearBE)) return '';
    const yearCE = yearBE - 543;
    const yStr = String(yearCE).padStart(4, '0');
    const mStr = String(monthIdx + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    return `${yStr}-${mStr}-${dStr}`;
}

/** Convert ISO date "2003-01-15" to Thai date string "15 ม.ค. 2546" */
function isoToThaiDate(isoDateStr) {
    if (!isoDateStr) return '';
    const parts = isoDateStr.split('-');
    if (parts.length < 3) return isoDateStr;
    const yearCE = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (isNaN(yearCE) || isNaN(month) || isNaN(day)) return isoDateStr;
    const yearBE = yearCE + 543;
    const monthName = THAI_MONTHS_SHORT[month - 1] || '';
    return `${day} ${monthName} ${yearBE}`;
}

/* ============================================================
   BIBLIOGRAPHY — View / Edit Mode
   ============================================================ */
function renderBibliography(s) {
    const container = document.getElementById('bibliographyContent');

    function renderViewMode() {
        const avatarHTML = s.avatar
            ? `<img src="${s.avatar}" alt="${esc(s.nameTh)}" class="profile-avatar-img" id="profileAvatarImg">`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

        container.innerHTML = `
        <div class="card profile-hero-card">
            <div class="profile-hero-top">
                <div class="profile-avatar-block">
                    <div class="profile-avatar-wrap" id="avatarWrap" title="คลิกเพื่อเปลี่ยนรูปโปรไฟล์">
                        ${avatarHTML}
                        <label class="avatar-upload-overlay" for="directAvatarFile">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                            <span>เปลี่ยนรูป</span>
                        </label>
                        <input type="file" id="directAvatarFile" accept="image/png, image/jpeg, image/webp" style="display:none">
                    </div>
                    <div class="profile-avatar-actions">
                        <label class="btn btn-xs btn-ghost profile-avatar-btn" for="directAvatarFile">
                            📷 เปลี่ยนรูป
                        </label>
                        ${s.avatar ? `<button class="btn btn-xs btn-ghost profile-avatar-btn text-danger" id="directRemoveAvatarBtn" title="รีเซ็ตรูปโปรไฟล์">🗑️ ลบรูป</button>` : ''}
                    </div>
                </div>

                <div class="profile-headline">
                    <div class="profile-name">${esc(s.nameTh)}</div>
                    <div class="profile-id-badge">
                        <span class="id-tag">รหัส ${esc(s.studentId)}</span>
                        <span class="id-divider">•</span>
                        <span class="name-en">${esc(s.nameEn)}</span>
                    </div>
                    <div class="profile-chips">
                        <span class="badge badge-green"><span class="badge-dot"></span>${esc(s.status)}</span>
                        <span class="profile-chip">ชั้นปีที่ ${s.year}</span>
                        <span class="profile-chip">เข้าศึกษาปี ${s.admitYear}</span>
                    </div>
                    <button class="btn btn-sm btn-orange profile-edit-btn" id="bioEditBtn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        แก้ไขข้อมูลส่วนตัว
                    </button>
                </div>
            </div>

            <!-- Profile Info Sections Grid -->
            <div class="profile-sections-container">
                <!-- Section 1: ข้อมูลการศึกษา -->
                <div class="profile-section-box">
                    <div class="profile-section-title">
                        <div class="pst-icon">🎓</div>
                        <span>ข้อมูลด้านการศึกษา</span>
                    </div>
                    <div class="profile-rows-list">
                        <div class="p-row">
                            <span class="p-label">คณะ</span>
                            <span class="p-val">${esc(s.faculty)}</span>
                        </div>
                        <div class="p-row">
                            <span class="p-label">สาขาวิชา</span>
                            <span class="p-val">${esc(s.department)}</span>
                        </div>
                        <div class="p-row">
                            <span class="p-label">ชั้นปี</span>
                            <span class="p-val">ปี ${s.year}</span>
                        </div>
                        <div class="p-row">
                            <span class="p-label">สถานภาพ</span>
                            <span class="p-val"><span class="badge badge-green">${esc(s.status)}</span></span>
                        </div>
                        <div class="p-row">
                            <span class="p-label">อาจารย์ที่ปรึกษา</span>
                            <span class="p-val p-advisor">${esc(s.advisor)}</span>
                        </div>
                        <div class="p-row">
                            <span class="p-label">ปีที่เข้าศึกษา</span>
                            <span class="p-val">${s.admitYear}</span>
                        </div>
                    </div>
                </div>

                <!-- Section 2: ข้อมูลส่วนตัวและการติดต่อ -->
                <div class="profile-section-box">
                    <div class="profile-section-title">
                        <div class="pst-icon">👤</div>
                        <span>ข้อมูลส่วนตัวและการติดต่อ</span>
                    </div>
                    <div class="profile-rows-list">
                        <div class="p-row">
                            <span class="p-label">วันเกิด</span>
                            <span class="p-val">${esc(s.birthDate)}</span>
                        </div>
                        <div class="p-row">
                            <span class="p-label">ศาสนา</span>
                            <span class="p-val">${esc(s.religion || 'พุทธ')}</span>
                        </div>
                        <div class="p-row">
                            <span class="p-label">อีเมล</span>
                            <a href="mailto:${esc(s.email)}" class="p-val p-link">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                ${esc(s.email)}
                            </a>
                        </div>
                        <div class="p-row">
                            <span class="p-label">โทรศัพท์</span>
                            <a href="tel:${esc(s.phone)}" class="p-val p-link">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                ${esc(s.phone)}
                            </a>
                        </div>
                        <div class="p-row p-row-address">
                            <span class="p-label">ที่อยู่ปัจจุบัน</span>
                            <div class="p-val-address">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;color:var(--brand-500);flex-shrink:0;margin-top:2px"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                                <span>${esc(s.address)}</span>
                            </div>
                        </div>
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

        document.getElementById('bioEditBtn').addEventListener('click', renderEditMode);

        // Direct Avatar File Upload
        document.getElementById('directAvatarFile')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                showPetitionToast('error', '⚠️ กรุณาเลือกไฟล์รูปภาพที่ถูกต้อง (PNG, JPG, WebP)');
                return;
            }
            if (file.size > 2 * 1024 * 1024) {
                showPetitionToast('error', '⚠️ ขนาดไฟล์รูปภาพเกิน 2MB กรุณาเลือกรูปภาพที่มีขนาดเล็กลง');
                return;
            }
            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target.result;
                studentEditableData[s.studentId].avatar = dataUrl;
                try {
                    localStorage.setItem('studentEditableData_' + s.studentId, JSON.stringify(studentEditableData[s.studentId]));
                } catch (err) {}
                updateTopbarAvatar(dataUrl);
                showPetitionToast('success', 'เปลี่ยนรูปโปรไฟล์สำเร็จแล้ว ✅');
                s.avatar = dataUrl;
                renderViewMode();
            };
            reader.readAsDataURL(file);
        });

        // Direct Avatar Removal / Reset
        document.getElementById('directRemoveAvatarBtn')?.addEventListener('click', () => {
            studentEditableData[s.studentId].avatar = null;
            try {
                localStorage.setItem('studentEditableData_' + s.studentId, JSON.stringify(studentEditableData[s.studentId]));
            } catch (err) {}
            updateTopbarAvatar(null);
            showPetitionToast('info', 'รีเซ็ตรูปโปรไฟล์เป็นค่าเริ่มต้นเรียบร้อยแล้ว');
            s.avatar = null;
            renderViewMode();
        });
    }

    function renderEditMode() {
        const religions = ['พุทธ', 'อิสลาม', 'คริสต์', 'ฮินดู', 'ซิกข์', 'อื่นๆ / ไม่ระบุ'];
        const relOpts = religions.map(r => `<option value="${r}" ${s.religion === r ? 'selected' : ''}>${r}</option>`).join('');
        const birthDateISO = thaiDateToISO(s.birthDate);
        const todayISO = new Date().toISOString().split('T')[0];

        const avatarHTML = s.avatar
            ? `<img src="${s.avatar}" alt="${esc(s.nameTh)}" class="profile-avatar-img">`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

        container.innerHTML = `
        <div class="card app-form-panel" style="margin-bottom:0">
            <div class="app-form-header">
                <div>
                    <div class="app-form-title">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        แก้ไขข้อมูลส่วนตัวนักศึกษา (Edit Profile)
                    </div>
                    <div class="app-form-subtitle">ปรับปรุงข้อมูลติดต่อและข้อมูลทั่วไปของคุณ</div>
                </div>
            </div>

            <!-- Profile Picture Section inside Edit Form -->
            <div style="display:flex;gap:16px;align-items:center;background:#f8fafc;padding:14px 18px;border-radius:var(--radius-md);border:1px solid var(--g-200);margin-bottom:20px;flex-wrap:wrap">
                <div class="profile-avatar-wrap" style="width:76px;height:76px;border-radius:50%" id="editFormAvatarWrap">
                    ${avatarHTML}
                </div>
                <div style="flex:1;min-width:200px">
                    <div style="font-weight:700;font-size:0.85rem;color:var(--g-800);margin-bottom:2px">รูปภาพโปรไฟล์ (Profile Picture)</div>
                    <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px">รองรับไฟล์ JPG, PNG, WebP ขนาดไม่เกิน 2MB</div>
                    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                        <label class="btn btn-sm btn-outline" for="editFormAvatarInput" style="cursor:pointer;font-size:0.8rem;display:inline-flex;align-items:center;gap:4px">
                            📁 เลือกรูปใหม่
                        </label>
                        <input type="file" id="editFormAvatarInput" accept="image/png, image/jpeg, image/webp" style="display:none">
                        ${s.avatar ? `<button type="button" class="btn btn-sm btn-ghost" id="editFormRemoveAvatarBtn" style="color:var(--red-600);font-size:0.8rem">🗑️ ลบรูปโปรไฟล์</button>` : ''}
                    </div>
                </div>
            </div>

            <div class="app-form-grid" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));">
                <div class="app-form-group">
                    <label class="app-form-label">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        ชื่อ-สกุล (ภาษาไทย) <span class="req">*</span>
                    </label>
                    <input type="text" class="app-input" id="bioNameTh" value="${esc(s.nameTh)}" placeholder="เช่น สมชาย ใจดี">
                    <span style="font-size:0.72rem;color:var(--text-muted)">เฉพาะตัวอักษรภาษาไทย</span>
                </div>
                <div class="app-form-group">
                    <label class="app-form-label">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        ชื่อ-สกุล (English) <span class="req">*</span>
                    </label>
                    <input type="text" class="app-input" id="bioNameEn" value="${esc(s.nameEn)}" placeholder="e.g. Somchai Jaidee">
                    <span style="font-size:0.72rem;color:var(--text-muted)">เฉพาะตัวอักษรภาษาอังกฤษ (A-Z, a-z)</span>
                </div>
                <div class="app-form-group">
                    <label class="app-form-label">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                        Email <span class="req">*</span>
                    </label>
                    <input type="email" class="app-input" id="bioEmail" value="${esc(s.email)}" placeholder="username@bsru.ac.th">
                </div>
                <div class="app-form-group">
                    <label class="app-form-label">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        หมายเลขโทรศัพท์ <span class="req">*</span>
                    </label>
                    <input type="tel" class="app-input" id="bioPhone" value="${esc(s.phone)}" maxlength="10" placeholder="08xxxxxxxx" oninput="this.value=this.value.replace(/[^0-9]/g,'')">
                    <span style="font-size:0.72rem;color:var(--text-muted)">ตัวเลข 10 หลัก (เช่น 0812345678)</span>
                </div>
                <div class="app-form-group">
                    <label class="app-form-label">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        วันเกิด (เลือกจากปฏิทิน)
                    </label>
                    <input type="date" class="app-input" id="bioBirthDate" value="${birthDateISO}" max="${todayISO}">
                </div>
                <div class="app-form-group">
                    <label class="app-form-label">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                        ศาสนา
                    </label>
                    <select class="app-select" id="bioReligion">${relOpts}</select>
                </div>
                <div class="app-form-group" style="grid-column: 1 / -1">
                    <label class="app-form-label">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                        ที่อยู่ปัจจุบัน
                    </label>
                    <textarea class="app-textarea" id="bioAddress" rows="2" placeholder="บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์">${esc(s.address)}</textarea>
                </div>
            </div>

            <!-- Read-only fields info -->
            <div style="margin-top:18px;padding:14px 18px;background:rgba(31,71,133,0.04);border-radius:var(--radius-lg);border:1px solid var(--brand-100)">
                <div style="font-size:0.8rem;font-weight:700;color:var(--brand-700);margin-bottom:8px;display:flex;align-items:center;gap:6px">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    ข้อมูลที่จัดการโดยระบบ (Read-only System Fields)
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(140px, 1fr));gap:6px 16px;font-size:0.82rem;color:var(--g-700)">
                    <span>📌 รหัสนักศึกษา: <strong>${esc(s.studentId)}</strong></span>
                    <span>📌 คณะ: <strong>${esc(s.faculty)}</strong></span>
                    <span>📌 สาขา: <strong>${esc(s.department)}</strong></span>
                    <span>📌 ชั้นปี: <strong>ปี ${s.year}</strong></span>
                    <span>📌 สถานภาพ: <strong>${esc(s.status)}</strong></span>
                    <span>📌 อาจารย์ที่ปรึกษา: <strong>${esc(s.advisor)}</strong></span>
                    <span>📌 ปีเข้าศึกษา: <strong>${s.admitYear}</strong></span>
                </div>
            </div>

            <div class="app-form-actions">
                <button class="app-btn-primary" id="bioSaveBtn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    บันทึกข้อมูล
                </button>
                <button class="app-btn-ghost" id="bioCancelBtn">ยกเลิก</button>
            </div>
        </div>`;

        // Real-time error clearing on input
        ['bioNameTh', 'bioNameEn', 'bioEmail', 'bioPhone'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => el.classList.remove('is-invalid'));
        });

        // Edit form avatar upload
        document.getElementById('editFormAvatarInput')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                showPetitionToast('error', '⚠️ กรุณาเลือกไฟล์รูปภาพที่ถูกต้อง (PNG, JPG, WebP)');
                return;
            }
            if (file.size > 2 * 1024 * 1024) {
                showPetitionToast('error', '⚠️ ขนาดไฟล์รูปภาพเกิน 2MB กรุณาเลือกรูปภาพที่มีขนาดเล็กลง');
                return;
            }
            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target.result;
                studentEditableData[s.studentId].avatar = dataUrl;
                try {
                    localStorage.setItem('studentEditableData_' + s.studentId, JSON.stringify(studentEditableData[s.studentId]));
                } catch (err) {}
                updateTopbarAvatar(dataUrl);
                s.avatar = dataUrl;
                const wrap = document.getElementById('editFormAvatarWrap');
                if (wrap) wrap.innerHTML = `<img src="${dataUrl}" class="profile-avatar-img" alt="Preview">`;
                showPetitionToast('success', 'อัปเดตรูปภาพโปรไฟล์เรียบร้อยแล้ว ✅');
            };
            reader.readAsDataURL(file);
        });

        document.getElementById('editFormRemoveAvatarBtn')?.addEventListener('click', () => {
            studentEditableData[s.studentId].avatar = null;
            try {
                localStorage.setItem('studentEditableData_' + s.studentId, JSON.stringify(studentEditableData[s.studentId]));
            } catch (err) {}
            updateTopbarAvatar(null);
            s.avatar = null;
            const wrap = document.getElementById('editFormAvatarWrap');
            if (wrap) wrap.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
            showPetitionToast('info', 'รีเซ็ตรูปโปรไฟล์แล้ว');
        });

        document.getElementById('bioCancelBtn').addEventListener('click', renderViewMode);
        document.getElementById('bioSaveBtn').addEventListener('click', () => {
            const elNameTh = document.getElementById('bioNameTh');
            const elNameEn = document.getElementById('bioNameEn');
            const elEmail = document.getElementById('bioEmail');
            const elPhone = document.getElementById('bioPhone');
            const elBirthDate = document.getElementById('bioBirthDate');
            const elReligion = document.getElementById('bioReligion');
            const elAddress = document.getElementById('bioAddress');

            const nameTh = elNameTh.value.trim();
            const nameEn = elNameEn.value.trim();
            const email = elEmail.value.trim();
            const phone = elPhone.value.trim();
            const birthDateISO = elBirthDate.value;
            const religion = elReligion.value.trim();
            const address = elAddress.value.trim();

            // Clear previous errors
            [elNameTh, elNameEn, elEmail, elPhone].forEach(el => el.classList.remove('is-invalid'));

            // 1. Required fields check
            let hasError = false;
            if (!nameTh) { elNameTh.classList.add('is-invalid'); hasError = true; }
            if (!nameEn) { elNameEn.classList.add('is-invalid'); hasError = true; }
            if (!email) { elEmail.classList.add('is-invalid'); hasError = true; }
            if (!phone) { elPhone.classList.add('is-invalid'); hasError = true; }

            if (hasError) {
                showPetitionToast('error', 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
                return;
            }

            // 2. Thai Name Validation
            const thaiRegex = /^[\u0E00-\u0E7F\s.]+$/;
            if (!thaiRegex.test(nameTh)) {
                elNameTh.classList.add('is-invalid');
                showPetitionToast('error', '⚠️ ชื่อ-สกุล (ภาษาไทย) ต้องเป็นตัวอักษรภาษาไทยเท่านั้น');
                elNameTh.focus();
                return;
            }

            // 3. English Name Validation
            const engRegex = /^[A-Za-z\s.]+$/;
            if (!engRegex.test(nameEn)) {
                elNameEn.classList.add('is-invalid');
                showPetitionToast('error', '⚠️ ชื่อ-สกุล (English) ต้องเป็นตัวอักษรภาษาอังกฤษเท่านั้น');
                elNameEn.focus();
                return;
            }

            // 4. Phone Number Validation
            const phoneRegex = /^0[0-9]{9}$/;
            if (!phoneRegex.test(phone)) {
                elPhone.classList.add('is-invalid');
                showPetitionToast('error', '⚠️ หมายเลขโทรศัพท์ต้องเป็นตัวเลข 10 หลัก (ขึ้นต้นด้วย 0 เช่น 0812345678)');
                elPhone.focus();
                return;
            }

            // 5. Convert birthDate from calendar picker to Thai format
            let formattedBirthDate = s.birthDate;
            if (birthDateISO) {
                formattedBirthDate = isoToThaiDate(birthDateISO);
            }

            // Update base data in pool
            const poolEntry = MOCK_STUDENTS_POOL.find(st => st.studentId === s.studentId);
            if (poolEntry) {
                poolEntry.nameTh = nameTh;
                poolEntry.nameEn = nameEn;
            }

            // Update editable store (preserving avatar)
            studentEditableData[s.studentId] = {
                ...studentEditableData[s.studentId],
                email,
                phone,
                birthDate: formattedBirthDate,
                religion,
                address
            };
            try {
                localStorage.setItem('studentEditableData_' + s.studentId, JSON.stringify(studentEditableData[s.studentId]));
            } catch (err) {}

            // Refresh student object and re-render
            const updated = getStudentFullData(s.studentId);
            s = updated;
            showPetitionToast('success', 'บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว ✅');
            renderViewMode();
        });
    }

    renderViewMode();
}

/* ============================================================
   TIMETABLE — CSS Grid Schedule Matrix + Mobile Agenda
   ============================================================ */

const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME_SLOTS = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
const COLOR_CLASSES = ['color-1', 'color-2', 'color-3', 'color-4', 'color-5', 'color-6'];

/** Convert time string "HH:MM" to slot index (0-based from 07:00) */
function timeToSlot(t) {
    const h = parseInt(t.split(':')[0], 10);
    return Math.max(0, h - 7);
}

/** Build desktop CSS Grid schedule matrix */
function buildTimetableDesktopHTML(schedule, showDelete) {
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
    const totalRows = usedSlots.length + 1; // +1 for header row

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
            <span class="tt-class-code">${esc(e.subjectCode)}</span>
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
function buildTimetableAgendaHTML(schedule, colorMap, showDelete) {
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
            // Extract background color for code badge from color class
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
                    <span class="tt-agenda-code" style="background:${codeBg}">${esc(e.subjectCode)}</span>
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
function buildExamHTML(currentSchedule) {
    // Get all subject codes the student is enrolled in across all semesters
    const enrolledCodes = new Set();
    MOCK_TIMETABLE_SEMESTERS.forEach(sem => {
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
function buildTimetableSemesterOptions(selectedIdx) {
    return MOCK_TIMETABLE_SEMESTERS.map((sem, i) =>
        `<option value="${i}"${i === selectedIdx ? ' selected' : ''}>${esc(sem.label)}</option>`
    ).join('');
}

/** Build time <select> options from 07:00 to 20:00 */
function buildTimeOptions(selectedTime) {
    let options = '';
    for (let h = 7; h <= 20; h++) {
        const t = String(h).padStart(2, '0') + ':00';
        options += `<option value="${t}"${t === selectedTime ? ' selected' : ''}>${t}</option>`;
    }
    return options;
}

/** Build day <select> options */
function buildDayOptions() {
    const labels = ['จันทร์ (Mon)', 'อังคาร (Tue)', 'พุธ (Wed)', 'พฤหัสบดี (Thu)', 'ศุกร์ (Fri)', 'เสาร์ (Sat)', 'อาทิตย์ (Sun)'];
    return labels.map((label, i) =>
        `<option value="${i}">${label}</option>`
    ).join('');
}

function renderTimetable() {
    const container = document.getElementById('timetableContent');
    let currentIdx = 0;

    function render(idx) {
        const sem = MOCK_TIMETABLE_SEMESTERS[idx];
        container.innerHTML = `
            <div class="card">
                <div class="card-title" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
                    <span style="display:flex;align-items:center;gap:8px">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:22px;height:22px;color:var(--brand-500)"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        ตารางเรียน Study Timetable
                    </span>
                    <button class="btn btn-sm btn-orange" id="ttToggleAddCourse" style="display:inline-flex;align-items:center;gap:6px">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        เพิ่มวิชาเรียน
                    </button>
                </div>

                <!-- Add Course Form (hidden by default) -->
                <div id="ttAddCourseForm" style="display:none" class="app-form-panel">
                    <div class="app-form-header">
                        <div>
                            <div class="app-form-title">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                                เพิ่มรายวิชาเรียน (Add New Course)
                            </div>
                            <div class="app-form-subtitle">กรอกรายละเอียดวิชาเรียนเพื่อจัดตารางเรียนให้อัตโนมัติ</div>
                        </div>
                        <button type="button" class="btn btn-sm btn-ghost" id="ttCloseFormBtn" style="padding:4px 10px;font-size:0.8rem">✕ ปิด</button>
                    </div>

                    <div class="app-form-grid">
                        <div class="app-form-group">
                            <label class="app-form-label">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                                รหัสวิชา <span class="req">*</span>
                            </label>
                            <input type="text" id="ttNewCode" class="app-input" placeholder="เช่น SC17351 / CS3101" required>
                        </div>
                        
                        <div class="app-form-group" style="grid-column: span 2;">
                            <label class="app-form-label">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                                ชื่อวิชา <span class="req">*</span>
                            </label>
                            <input type="text" id="ttNewName" class="app-input" placeholder="เช่น Web Development / Object-Oriented Programming" required>
                        </div>

                        <div class="app-form-group">
                            <label class="app-form-label">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                วันเรียน <span class="req">*</span>
                            </label>
                            <select id="ttNewDay" class="app-select">${buildDayOptions()}</select>
                        </div>

                        <div class="app-form-group">
                            <label class="app-form-label">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                เวลาเริ่ม <span class="req">*</span>
                            </label>
                            <select id="ttNewStartTime" class="app-select">${buildTimeOptions('09:00')}</select>
                        </div>

                        <div class="app-form-group">
                            <label class="app-form-label">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 8"/></svg>
                                เวลาสิ้นสุด <span class="req">*</span>
                            </label>
                            <select id="ttNewEndTime" class="app-select">${buildTimeOptions('12:00')}</select>
                        </div>

                        <div class="app-form-group">
                            <label class="app-form-label">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                ห้องเรียน
                            </label>
                            <input type="text" id="ttNewRoom" class="app-input" placeholder="เช่น Room 6121 / CS-Lab2">
                        </div>

                        <div class="app-form-group" style="grid-column: span 2;">
                            <label class="app-form-label">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                อาจารย์ผู้สอน
                            </label>
                            <input type="text" id="ttNewTeacher" class="app-input" placeholder="เช่น Dr. Somchai / ผศ.ดร.วิชัย เทคโนโลยี">
                        </div>
                    </div>

                    <div class="app-form-actions">
                        <button class="app-btn-primary" id="ttSaveCourseBtn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                            บันทึกวิชาเรียน
                        </button>
                        <button class="app-btn-ghost" id="ttCancelCourseBtn">ยกเลิก</button>
                    </div>
                </div>

                <div class="batch-filter-bar" style="margin-bottom:16px">
                    <label>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        Semester
                    </label>
                    <select class="batch-select" id="timetableSemesterSelect">
                        ${buildTimetableSemesterOptions(idx)}
                    </select>
                    <span class="filter-result-count">Showing: <strong>${esc(sem.label)}</strong> · ${sem.schedule.length} วิชา</span>
                </div>
                <div id="timetableTableBody">
                    ${buildTimetableDesktopHTML(sem.schedule, true)}
                </div>
            </div>
            <div class="card">
                <div class="card-title">📝 ตารางสอบ Exam Schedule <span style="font-size:0.8rem;color:var(--text-muted);font-weight:400">(อัปเดตอัตโนมัติจากอาจารย์ผู้สอน)</span></div>
                ${buildExamHTML(sem.schedule)}
            </div>`;

        // ── Event: Semester Select ──
        document.getElementById('timetableSemesterSelect').addEventListener('change', (e) => {
            currentIdx = parseInt(e.target.value, 10);
            render(currentIdx);
        });

        // ── Event: Toggle & Close Add Course Form ──
        const closeAddCourseForm = () => {
            const form = document.getElementById('ttAddCourseForm');
            if (form) form.style.display = 'none';
        };

        document.getElementById('ttToggleAddCourse').addEventListener('click', () => {
            const form = document.getElementById('ttAddCourseForm');
            form.style.display = form.style.display === 'none' ? 'block' : 'none';
        });
        const closeBtn = document.getElementById('ttCloseFormBtn');
        if (closeBtn) closeBtn.addEventListener('click', closeAddCourseForm);
        const cancelBtn = document.getElementById('ttCancelCourseBtn');
        if (cancelBtn) cancelBtn.addEventListener('click', closeAddCourseForm);

        // Clear errors on input / change
        ['ttNewCode', 'ttNewName', 'ttNewStartTime', 'ttNewEndTime', 'ttNewDay'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => el.classList.remove('is-invalid'));
                el.addEventListener('change', () => el.classList.remove('is-invalid'));
            }
        });

        // ── Event: Save New Course ──
        document.getElementById('ttSaveCourseBtn').addEventListener('click', () => {
            const elCode = document.getElementById('ttNewCode');
            const elName = document.getElementById('ttNewName');
            const elDay = document.getElementById('ttNewDay');
            const elStart = document.getElementById('ttNewStartTime');
            const elEnd = document.getElementById('ttNewEndTime');
            const elRoom = document.getElementById('ttNewRoom');
            const elTeacher = document.getElementById('ttNewTeacher');

            const code = elCode.value.trim();
            const name = elName.value.trim();
            const day = parseInt(elDay.value, 10);
            const startTime = elStart.value;
            const endTime = elEnd.value;
            const room = elRoom.value.trim() || '-';
            const teacher = elTeacher.value.trim() || '-';

            [elCode, elName, elStart, elEnd, elDay].forEach(el => el.classList.remove('is-invalid'));

            if (!code || !name) {
                if (!code) elCode.classList.add('is-invalid');
                if (!name) elName.classList.add('is-invalid');
                showPetitionToast('error', 'กรุณากรอกรหัสวิชาและชื่อวิชา');
                return;
            }
            if (startTime >= endTime) {
                elStart.classList.add('is-invalid');
                elEnd.classList.add('is-invalid');
                showPetitionToast('error', 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม');
                return;
            }

            // Overlap detection
            const newStart = timeToSlot(startTime);
            const newEnd = timeToSlot(endTime);
            const overlap = sem.schedule.find(e => {
                if (e.day !== day) return false;
                const eStart = timeToSlot(e.startTime);
                const eEnd = timeToSlot(e.endTime);
                return newStart < eEnd && newEnd > eStart;
            });
            if (overlap) {
                elDay.classList.add('is-invalid');
                elStart.classList.add('is-invalid');
                elEnd.classList.add('is-invalid');
                showPetitionToast('error', `⚠️ เวลาซ้อนทับกับวิชา ${overlap.subjectCode} (${overlap.startTime}-${overlap.endTime})`);
                return;
            }

            sem.schedule.push({
                day,
                startTime,
                endTime,
                subjectCode: code,
                subjectName: name,
                teacherName: teacher,
                room,
            });

            showPetitionToast('success', `เพิ่มวิชา ${code} — ${name} สำเร็จ ✅`);
            render(currentIdx);
        });

        // ── Event: Delete Course from timetable ──
        document.querySelectorAll('.tt-delete-course').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const courseIdx = parseInt(btn.dataset.courseIdx, 10);
                const removed = sem.schedule.splice(courseIdx, 1)[0];
                showPetitionToast('success', `ลบวิชา ${removed.subjectCode} ออกจากตารางเรียนแล้ว`);
                render(currentIdx);
            });
        });
    }

    render(currentIdx);
}

/* ============================================================
   FINANCE
   ============================================================ */
function renderFinance() {
    const f = MOCK_FINANCE;
    const payRows = f.payments.map(p => `<tr><td>${esc(p.semester)}</td><td>${fmt(p.amount)} ฿</td><td><span class="badge ${statusBadge(p.status)}">${esc(p.status)}</span></td><td class="hide-mobile">${esc(p.date)}</td><td class="hide-mobile">${esc(p.method)}</td></tr>`).join('');
    document.getElementById('financeContent').innerHTML = `
        <div class="stat-row">
            <div class="finance-summary" style="flex:2"><h3>ยอดค้างชำระ</h3><div class="finance-amount">${fmt(f.currentOwed)} ฿</div><div class="finance-sub">ภาคเรียนที่ 1/2567</div></div>
            <div class="stat-card" style="flex:1"><div class="stat-icon green">💰</div><div><div class="stat-value">${fmt(f.totalPaid)}</div><div class="stat-label">ชำระแล้วทั้งหมด (฿)</div></div></div>
        </div>
        <div class="card"><div class="card-title">🎓 ทุนการศึกษา <span class="badge badge-green">ได้รับทุน</span></div><div class="profile-detail-grid"><div class="profile-item"><span class="label">ชื่อทุน</span><span class="value">${esc(f.scholarship)}</span></div><div class="profile-item"><span class="label">จำนวน</span><span class="value">${fmt(f.scholarshipAmount)} ฿/ปี</span></div></div></div>
        <div class="card"><div class="card-title">📋 ประวัติการชำระเงิน</div><div class="table-wrap"><table class="data-table"><thead><tr><th>ภาคเรียน</th><th>จำนวน</th><th>สถานะ</th><th class="hide-mobile">วันที่</th><th class="hide-mobile">ช่องทาง</th></tr></thead><tbody>${payRows}</tbody></table></div></div>`;
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
        `<tr><td><strong>${esc(c.code)}</strong></td><td>${esc(c.name)}</td><td style="text-align:center">${c.credits}</td><td style="text-align:center"><span class="grade ${gradeClass(c.grade)}">${c.grade}</span></td><td style="text-align:center" class="hide-mobile">${c.point !== null ? c.point.toFixed(1) : '-'}</td></tr>`
    ).join('');

    return `
        <div class="table-wrap">
            <table class="data-table">
                <thead><tr><th>รหัส</th><th>ชื่อวิชา</th><th style="text-align:center">หน่วยกิต</th><th style="text-align:center">เกรด</th><th style="text-align:center" class="hide-mobile">คะแนน</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:16px;flex-wrap:wrap;margin-top:12px;font-size:0.85rem">
            <span>หน่วยกิตลงทะเบียน: <strong>${sem.courses.reduce((a, c) => a + c.credits, 0)}</strong></span>
            <span>GPA: <strong style="color:var(--brand-600)">${semGpa}</strong></span>
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
   GRADUATION AUDIT (ตรวจสอบจบตามเกณฑ์หลักสูตร)
   ============================================================ */
const MOCK_GRADUATION_AUDIT = {
    summary: {
        totalRequiredCredits: 132,
        totalEarnedCredits: 96,
        currentGpa: 3.88,
        minGpa: 2.00,
        status: 'ยังไม่ผ่านเงื่อนไข',
        passedCategories: 8,
        totalCategories: 11,
        pendingRequirements: [
            '2.2.2 หมวดวิชาเฉพาะด้าน (เลือก) — ขาดอีก 6 หน่วยกิต (ผ่านแล้ว 15/21 CR)',
            '2.3 วิชาพื้นฐานวิชาชีพ — ขาดโครงงาน 2 (SC17402) และฝึกงาน (SC17411/12) ขาดอีก 6 หน่วยกิต',
            '4. กลุ่มทักษะ — รอผลการทดสอบ CEFR และทักษะดิจิทัล DL',
        ],
    },
    sections: [
        {
            id: 'sec-1',
            title: '1. หมวดวิชาศึกษาทั่วไป',
            subsections: [
                {
                    id: 'sec-1-1',
                    title: '1.1 วิชาศึกษาทั่วไปบังคับ',
                    status: 'PASS', minCr: 20, passCr: 20, gpa: '4.00',
                    groups: [
                        {
                            code: '1.1.1', title: 'กลุ่มที่ 1 ศาสตร์พระราชาและวิถีแห่งสังคม',
                            status: 'PASS', minCr: 3, passCr: 3, gpa: '4.00',
                            courses: [
                                { code: 'GE01101', name: 'ศาสตร์พระราชาสู่การพัฒนาท้องถิ่น', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 2: 'A 2/66' } }
                            ]
                        },
                        {
                            code: '1.1.2', title: 'กลุ่มที่ 2 ภาษาและเทคโนโลยีทางการสื่อสาร',
                            status: 'PASS', minCr: 6, passCr: 6, gpa: '4.00',
                            courses: [
                                { code: 'GE02101', name: 'ภาษาอังกฤษเพื่อการสื่อสารในยุคดิจิทัล', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 2: 'A 2/66' } },
                                { code: 'GE02102', name: 'ภาษาไทยเพื่อการสื่อสารร่วมสมัย', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 1: 'A 1/66' } }
                            ]
                        },
                        {
                            code: '1.1.3', title: 'กลุ่มที่ 3 คุณภาพชีวิตและคุณค่าของความเป็นมนุษย์',
                            status: 'PASS', minCr: 2, passCr: 2, gpa: '4.00',
                            courses: [
                                { code: 'GE03101', name: 'ชีวิตดีมีความสุข', credits: '2(1-2-3)', ca: 2, pt: 8.0, avg: '4.00', max: '4.00', terms: { 3: 'A 1/67' } }
                            ]
                        },
                        {
                            code: '1.1.4', title: 'กลุ่มที่ 4 ศิลปะแห่งการจัดการและการเป็นผู้ประกอบการ',
                            status: 'PASS', minCr: 3, passCr: 3, gpa: '4.00',
                            courses: [
                                { code: 'GE04101', name: 'ประกอบการธุรกิจเชิงสร้างสรรค์', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 1: 'A 1/66' } }
                            ]
                        },
                        {
                            code: '1.1.5', title: 'กลุ่มที่ 5 ศาสตร์แห่งการคิดและการสร้างสรรค์นวัตกรรม',
                            status: 'PASS', minCr: 6, passCr: 6, gpa: '4.00',
                            courses: [
                                { code: 'GE05101', name: 'รู้คิดชีวิตก้าวหน้า', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 1: 'A 1/66' } },
                                { code: 'GE05102', name: 'ทักษะการใช้เทคโนโลยีดิจิทัล', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 2: 'A 2/66' } }
                            ]
                        }
                    ]
                },
                {
                    id: 'sec-1-2',
                    title: '1.2 วิชาศึกษาทั่วไปเลือกกลุ่มละ 1 วิชา จำนวน 3 รายวิชา จาก 5 กลุ่มและเลือกเรียนได้กลุ่มละ 1 วิชาเท่านั้น',
                    status: 'PASS', minCr: 9, passCr: 9, gpa: '4.00',
                    groups: [
                        {
                            code: '1.2.1', title: 'กลุ่มที่ 1 ศาสตร์พระราชาและวิถีแห่งสังคม',
                            status: 'PASS', minCr: null, passCr: null, gpa: '0.00',
                            courses: [
                                { code: 'GE01201', name: 'วิถีพลเมืองและกฎหมายในชีวิตประจำวัน', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                { code: 'GE01202', name: 'พลวัตสังคมไทยและสังคมโลก', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: {} }
                            ]
                        },
                        {
                            code: '1.2.2', title: 'กลุ่มที่ 2 ภาษาและเทคโนโลยีทางการสื่อสาร',
                            status: 'PASS', minCr: null, passCr: null, gpa: '0.00',
                            courses: [
                                { code: 'GE02201', name: 'การรู้เท่าทันสื่อและสารสนเทศ', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                { code: 'GE02202', name: 'ภาษาเกาหลีในชีวิตประจำวัน', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                { code: 'GE02203', name: 'ภาษาเขมรในชีวิตประจำวัน', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                { code: 'GE02204', name: 'ภาษาจีนในชีวิตประจำวัน', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                { code: 'GE02205', name: 'ภาษาญี่ปุ่นในชีวิตประจำวัน', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                { code: 'GE02206', name: 'ภาษามลายูในชีวิตประจำวัน', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                { code: 'GE02207', name: 'ภาษาลาวในชีวิตประจำวัน', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                { code: 'GE02208', name: 'ภาษาเวียดนามในชีวิตประจำวัน', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                { code: 'GE02209', name: 'ภาษาสเปนในชีวิตประจำวัน', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: {} }
                            ]
                        },
                        {
                            code: '1.2.3', title: 'กลุ่มที่ 3 คุณภาพชีวิตและคุณค่าของความเป็นมนุษย์',
                            status: 'PASS', minCr: null, passCr: 3, gpa: '4.00',
                            courses: [
                                { code: 'GE03201', name: 'ศิลปะและความงามของชีวิต', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                { code: 'GE03202', name: 'ศิลปะการใช้ชีวิต', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 4: 'A 2/67' } }
                            ]
                        },
                        {
                            code: '1.2.4', title: 'กลุ่มที่ 4 ศิลปะแห่งการจัดการและการเป็นผู้ประกอบการ',
                            status: 'PASS', minCr: null, passCr: 3, gpa: '4.00',
                            courses: [
                                { code: 'GE04201', name: 'การวางแผนทางการเงินเพื่อความมั่นคง', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 4: 'A 2/67' } },
                                { code: 'GE04202', name: 'การทำงานอย่างมีความสุข', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: {} }
                            ]
                        },
                        {
                            code: '1.2.5', title: 'กลุ่มที่ 5 ศาสตร์แห่งการคิดและการสร้างสรรค์นวัตกรรม',
                            status: 'PASS', minCr: null, passCr: 3, gpa: '4.00',
                            courses: [
                                { code: 'GE05201', name: 'เทคโนโลยีดิจิทัลสำหรับนักธุรกิจมือใหม่', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 3: 'A 1/67' } },
                                { code: 'GE05202', name: 'รักษ์โลกรักเรา', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: {} }
                            ]
                        }
                    ]
                },
                {
                    id: 'sec-1-3',
                    title: '1.3 วิชาศึกษาทั่วไปบังคับเลือก',
                    status: 'PASS', minCr: 1, passCr: 1, gpa: '4.00',
                    groups: [
                        {
                            code: '1.3', title: 'วิชาศึกษาทั่วไปบังคับเลือก',
                            status: 'PASS', minCr: 1, passCr: 1, gpa: '4.00',
                            courses: [
                                { code: 'GE03301', name: 'จังหวะของชีวิต', credits: '1(0-2-1)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                { code: 'GE03302', name: 'การออกกำลังกายเพื่อสุขภาพ', credits: '1(0-2-1)', ca: 1, pt: 4.0, avg: '4.00', max: '4.00', terms: { 3: 'A 1/67' } },
                                { code: 'GE03303', name: 'การเต้นสมัยใหม่', credits: '1(0-2-1)', ca: null, pt: null, avg: null, max: null, terms: {} }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            id: 'sec-2',
            title: '2. หมวดวิชาเฉพาะไม่น้อยกว่า',
            subsections: [
                {
                    id: 'sec-2-1',
                    title: '2.1 วิชาแกน',
                    status: 'PASS', minCr: 18, passCr: 18, gpa: '4.00',
                    groups: [
                        {
                            code: '2.1', title: 'วิชาแกน', status: 'PASS', minCr: 18, passCr: 18, gpa: '4.00',
                            courses: [
                                { code: 'SC01001', name: 'คณิตศาสตร์เบื้องต้น', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 1: 'A 1/66' } },
                                { code: 'SC01002', name: 'แคลคูลัสเบื้องต้น', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 2: 'A 2/66' } },
                                { code: 'SC01012', name: 'เทคโนโลยีดิจิทัลสำหรับนักวิทยาศาสตร์', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 2: 'A 2/66' } },
                                { code: 'SC01013', name: 'ภาษาอังกฤษสำหรับนักวิทยาศาสตร์', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 4: 'A 2/67' } },
                                { code: 'SC17205', name: 'คณิตศาสตร์ดิสครีตและทฤษฎีการคำนวณ', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 4: 'A 2/67' } },
                                { code: 'SC17301', name: 'สถิติเพื่อการวิจัยทางวิทยาศาสตร์', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 5: 'A 1/68' } }
                            ]
                        }
                    ]
                },
                {
                    id: 'sec-2-2',
                    title: '2.2 วิชาเฉพาะด้าน',
                    subsections: [
                        {
                            id: 'sec-2-2-1',
                            title: '2.2.1 บังคับ',
                            groups: [
                                {
                                    code: '2.2.1.1', title: 'กลุ่มประเด็นด้านองค์กรและระบบสารสนเทศ', status: 'PASS', minCr: 6, passCr: 6, gpa: '3.50',
                                    courses: [
                                        { code: 'SC17204', name: 'การวิเคราะห์และออกแบบระบบ', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 3: 'A 1/67' } },
                                        { code: 'SC17302', name: 'ภาษาอังกฤษสำหรับวิทยาการคอมพิวเตอร์', credits: '3(3-0-6)', ca: 3, pt: 9.0, avg: '3.00', max: '3.00', terms: { 5: 'B 1/68' } }
                                    ]
                                },
                                {
                                    code: '2.2.1.2', title: 'กลุ่มเทคโนโลยีเพื่องานประยุกต์', status: 'PASS', minCr: 12, passCr: 12, gpa: '4.00',
                                    courses: [
                                        { code: 'SC17207', name: 'ปฏิสัมพันธ์ระหว่างมนุษย์และคอมพิวเตอร์', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 4: 'A 2/67' } },
                                        { code: 'SC17208', name: 'การจัดการฐานข้อมูลและสารสนเทศ', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 4: 'A 2/67' } },
                                        { code: 'SC17304', name: 'ความมั่นคงปลอดภัยทางคอมพิวเตอร์', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 5: 'A 1/68' } },
                                        { code: 'SC17306', name: 'สัมมนาทางคอมพิวเตอร์', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 6: 'A 2/68' } }
                                    ]
                                },
                                {
                                    code: '2.2.1.3', title: 'กลุ่มเทคโนโลยีและวิธีการทางซอฟต์แวร์', status: 'PASS', minCr: 12, passCr: 12, gpa: '4.00',
                                    courses: [
                                        { code: 'SC17101', name: 'การเขียนโปรแกรมคอมพิวเตอร์และอัลกอริทึม', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 1: 'A 1/66' } },
                                        { code: 'SC17102', name: 'โครงสร้างข้อมูลและการเขียนโปรแกรม', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 2: 'A 2/66' } },
                                        { code: 'SC17202', name: 'การเขียนโปรแกรมเชิงวัตถุ', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 3: 'A 1/67' } },
                                        { code: 'SC17206', name: 'วิศวกรรมซอฟต์แวร์', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 4: 'A 2/67' } }
                                    ]
                                },
                                {
                                    code: '2.2.1.4', title: 'กลุ่มโครงสร้างพื้นฐานของระบบ', status: 'PASS', minCr: 12, passCr: 12, gpa: '4.00',
                                    courses: [
                                        { code: 'SC17201', name: 'ระบบปฏิบัติการ', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 3: 'A 1/67' } },
                                        { code: 'SC17203', name: 'เครือข่ายคอมพิวเตอร์และการสื่อสารข้อมูล', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 3: 'A 1/67' } },
                                        { code: 'SC17303', name: 'คอมพิวเตอร์กราฟิก', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 5: 'A 1/68' } },
                                        { code: 'SC17305', name: 'ปัญญาประดิษฐ์และระบบชาญฉลาด', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 6: 'A 2/68' } }
                                    ]
                                },
                                {
                                    code: '2.2.1.5', title: 'กลุ่มฮาร์ดแวร์และสถาปัตยกรรมคอมพิวเตอร์', status: 'PASS', minCr: 3, passCr: 3, gpa: '4.00',
                                    courses: [
                                        { code: 'SC17103', name: 'สถาปัตยกรรมคอมพิวเตอร์', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 1: 'A 1/66' } }
                                    ]
                                }
                            ]
                        },
                        {
                            id: 'sec-2-2-2',
                            title: '2.2.2 เลือกไม่น้อยกว่า',
                            status: 'FAIL', minCr: 21, passCr: 15, gpa: '3.90',
                            groups: [
                                {
                                    code: '2.2.2', title: 'เลือกไม่น้อยกว่า 21 หน่วยกิต', status: 'FAIL', minCr: 21, passCr: 15, gpa: '3.90',
                                    courses: [
                                        { code: 'SC17311', name: 'พื้นฐานอินเทอร์เน็ตทุกสรรพสิ่ง', credits: '3(2-2-5)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                        { code: 'SC17312', name: 'การพัฒนาระบบอินเทอร์เน็ตทุกสรรพสิ่ง', credits: '3(2-2-5)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                        { code: 'SC17321', name: 'วิทยาการข้อมูล', credits: '3(2-2-5)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                        { code: 'SC17322', name: 'คลังข้อมูล', credits: '3(2-2-5)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                        { code: 'SC17331', name: 'วิศวกรรมเว็บและการพัฒนาเว็บแอปพลิเคชัน', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 5: 'A 1/68' } },
                                        { code: 'SC17332', name: 'การพัฒนาเว็บแอปพลิเคชันที่ประมวลผลทางฝั่งเครื่องลูกข่าย', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 6: 'A 2/68' } },
                                        { code: 'SC17333', name: 'การพัฒนาเว็บไซต์ด้วยระบบจัดการเนื้อหา', credits: '3(2-2-5)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                        { code: 'SC17341', name: 'การพัฒนาแอปพลิเคชันบนอุปกรณ์เคลื่อนที่ 1', credits: '3(2-2-5)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                        { code: 'SC17342', name: 'การพัฒนาแอปพลิเคชันบนอุปกรณ์เคลื่อนที่ 2', credits: '3(2-2-5)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                        { code: 'SC17351', name: 'การเป็นผู้ประกอบการด้านดิจิทัล', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: { 7: '-- 1/69' } },
                                        { code: 'SC17352', name: 'ระบบสารสนเทศเพื่อการจัดการ', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                        { code: 'SC17353', name: 'ธุรกิจดิจิทัล', credits: '3(3-0-6)', ca: null, pt: null, avg: null, max: null, terms: { 7: '-- 1/69' } },
                                        { code: 'SC17354', name: 'การเขียนโปรแกรมคอมพิวเตอร์ขั้นสูง', credits: '3(2-2-5)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                        { code: 'SC17355', name: 'วิจัยดำเนินงาน', credits: '3(3-0-6)', ca: 3, pt: 10.5, avg: '3.50', max: '3.50', terms: { 5: 'B+ 1/68' } },
                                        { code: 'SC17356', name: 'การค้นคืนสารสนเทศ', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 6: 'A 2/68' } },
                                        { code: 'SC17361', name: 'การประยุกต์ใช้เทคโนโลยีคอมพิวเตอร์ในชีวิตประจำวัน', credits: '3(2-2-5)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 6: 'A 2/68' } },
                                        { code: 'SC17362', name: 'การจัดการเนื้อหาบนสื่อผสม', credits: '3(2-2-5)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                        { code: 'SC17363', name: 'การประยุกต์ใช้แอปพลิเคชันบนอุปกรณ์เคลื่อนที่', credits: '3(2-2-5)', ca: null, pt: null, avg: null, max: null, terms: {} }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                {
                    id: 'sec-2-3',
                    title: '2.3 วิชาพื้นฐานวิชาชีพ',
                    status: 'FAIL', minCr: 7, passCr: 1, gpa: '4.00',
                    groups: [
                        {
                            code: '2.3.1', title: 'แผนฝึกประสบการณ์วิชาชีพ', status: 'FAIL', minCr: null, passCr: 1, gpa: '4.00',
                            courses: [
                                { code: 'SC17401', name: 'โครงงานคอมพิวเตอร์ 1', credits: '1(1-0-2)', ca: 1, pt: 4.0, avg: '4.00', max: '4.00', terms: { 6: 'A 2/68' } },
                                { code: 'SC17402', name: 'โครงงานคอมพิวเตอร์ 2', credits: '2(0-4-2)', ca: null, pt: null, avg: null, max: null, terms: { 7: '-- 1/69' } },
                                { code: 'SC17411', name: 'เตรียมฝึกประสบการณ์วิชาชีพทางวิทยาการคอมพิวเตอร์', credits: '1(0-2-1)', ca: null, pt: null, avg: null, max: null, terms: { 7: '-- 1/69' } },
                                { code: 'SC17412', name: 'ฝึกประสบการณ์วิชาชีพทางวิทยาการคอมพิวเตอร์', credits: '3(450)', ca: null, pt: null, avg: null, max: null, terms: {} }
                            ]
                        },
                        {
                            code: '2.3.2', title: 'แผนสหกิจศึกษา', status: 'PASS', minCr: null, passCr: null, gpa: '0.00',
                            courses: [
                                { code: 'SC17421', name: 'เตรียมสหกิจศึกษาทางวิทยาการคอมพิวเตอร์', credits: '1(0-2-1)', ca: null, pt: null, avg: null, max: null, terms: {} },
                                { code: 'SC17422', name: 'สหกิจศึกษาทางวิทยาการคอมพิวเตอร์', credits: '6(640)', ca: null, pt: null, avg: null, max: null, terms: {} }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            id: 'sec-3',
            title: '3. หมวดวิชาเลือกเสรี',
            status: 'PASS', minCr: 6, passCr: 6, gpa: '4.00',
            groups: [
                {
                    code: '3.', title: 'หมวดวิชาเลือกเสรี', status: 'PASS', minCr: 6, passCr: 6, gpa: '4.00',
                    courses: [
                        { code: '2101207', name: 'สารสนเทศสำหรับเด็กและเยาวชน', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 6: 'A 2/68' } },
                        { code: 'ED16208', name: 'จิตวิทยาสังคม', credits: '3(3-0-6)', ca: 3, pt: 12.0, avg: '4.00', max: '4.00', terms: { 5: 'A 1/68' } }
                    ]
                }
            ]
        },
        {
            id: 'sec-4',
            title: '4. กลุ่มทักษะ',
            status: 'FAIL', minCr: null, passCr: null, gpa: '0.00',
            groups: [
                {
                    code: '4.', title: 'กลุ่มทักษะความรู้ความสามารถ', status: 'FAIL', minCr: null, passCr: null, gpa: '0.00',
                    courses: [
                        { code: 'CEFR111', name: 'การพัฒนาทักษะภาษาอังกฤษ (การวัดสมิทธิภาพทางภาษาอังกฤษ)', credits: '0', ca: null, pt: null, avg: null, max: null, terms: { 6: '-- 2/68' } },
                        { code: 'DL11111', name: 'ทักษะความเข้าใจและใช้เทคโนโลยีดิจิทัล', credits: '0', ca: null, pt: null, avg: null, max: null, terms: {} }
                    ]
                }
            ]
        }
    ]
};

function buildAuditGroupHTML(secId, grp, hideHeader = false) {
    const passBadge = grp.status ? `<span class="audit-badge ${grp.status.toLowerCase()}">${grp.status}</span>` : '';
    const minCrText = grp.minCr !== null && grp.minCr !== undefined ? `MIN ${grp.minCr} CR` : '';
    const passCrText = grp.passCr !== null && grp.passCr !== undefined ? `PASS ${grp.passCr} CR` : '';
    const gpaText = grp.gpa && grp.gpa !== '0.00' ? `GPA ${grp.gpa}` : '';

    let html = '';
    if (!hideHeader) {
        html += `
            <tr class="audit-group-hdr audit-row-${secId}">
                <td colspan="6" style="padding-left:22px">
                    <span style="color:var(--brand-700);font-weight:700">${esc(grp.code || '')}</span> <strong>${esc(grp.title)}</strong>
                </td>
                <td colspan="8" style="text-align:right;padding-right:14px">
                    ${passBadge}
                    ${minCrText ? `<span class="audit-cr-pill">${minCrText}</span>` : ''}
                    ${passCrText ? `<span class="audit-cr-pill">${passCrText}</span>` : ''}
                    ${gpaText ? `<span class="audit-gpa-pill">${gpaText}</span>` : ''}
                </td>
            </tr>
        `;
    }

    grp.courses.forEach(c => {
        const termsCells = [1, 2, 3, 4, 5, 6, 7, 8].map(termNum => {
            const val = c.terms && c.terms[termNum];
            if (!val) return '<td class="term-col" style="color:#cbd5e1">-</td>';
            if (val.startsWith('--')) {
                return `<td class="term-col"><span class="audit-grade-wait">${esc(val)}</span></td>`;
            }
            return `<td class="term-col"><span class="audit-grade-pass">${esc(val)}</span></td>`;
        }).join('');

        html += `
            <tr class="audit-course-row audit-row-${secId}">
                <td style="padding-left:32px">
                    <span class="audit-course-code">${esc(c.code)}:</span>
                    <span class="audit-course-name">${esc(c.name)}</span>
                </td>
                <td class="cr-col" style="color:var(--g-600)">${esc(c.credits || '-')}</td>
                <td class="num-col" style="${c.ca ? 'color:var(--g-800);font-weight:600' : 'color:#cbd5e1'}">${c.ca !== null && c.ca !== undefined ? c.ca : '-'}</td>
                <td class="num-col" style="${c.pt ? 'color:var(--g-800);font-weight:600' : 'color:#cbd5e1'}">${c.pt !== null && c.pt !== undefined ? c.pt.toFixed(1) : '-'}</td>
                <td class="num-col" style="${c.avg ? 'color:var(--g-800);font-weight:600' : 'color:#cbd5e1'}">${c.avg !== null && c.avg !== undefined ? c.avg : '-'}</td>
                <td class="num-col" style="${c.max ? 'color:var(--g-800);font-weight:600' : 'color:#cbd5e1'}">${c.max !== null && c.max !== undefined ? c.max : '-'}</td>
                ${termsCells}
            </tr>
        `;
    });

    return html;
}

function evaluateSection1_2(subsec) {
    let distinctPassedGroups = [];
    let groupViolations = [];
    let totalCredits = 0;
    let totalPoints = 0;

    subsec.groups.forEach((grp, idx) => {
        const passedCourses = grp.courses.filter(c => c.ca && c.ca > 0);
        if (passedCourses.length > 0) {
            distinctPassedGroups.push({
                index: idx + 1,
                code: grp.code,
                title: grp.title,
                courses: passedCourses
            });
            if (passedCourses.length > 1) {
                groupViolations.push(`${grp.code}: เลือกเรียนซ้ำ ${passedCourses.length} วิชา (เงื่อนไขอนุญาตให้เลือกได้กลุ่มละ 1 วิชาเท่านั้น)`);
            }
            const first = passedCourses[0];
            totalCredits += 3;
            if (first.pt) totalPoints += first.pt;
        }
    });

    const isPassed = distinctPassedGroups.length >= 3 && groupViolations.length === 0;
    const gpa = totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '0.00';
    const earnedCredits = Math.min(distinctPassedGroups.length, 3) * 3;

    return {
        isPassed,
        distinctCount: distinctPassedGroups.length,
        requiredCount: 3,
        passedGroups: distinctPassedGroups,
        violations: groupViolations,
        earnedCredits,
        requiredCredits: 9,
        gpa
    };
}

function buildGraduationAuditTableRows() {
    let rowsHTML = '';

    MOCK_GRADUATION_AUDIT.sections.forEach(sec => {
        rowsHTML += `
            <tr class="audit-sec-hdr" data-sec="${sec.id}">
                <td colspan="14" style="padding:9px 14px">
                    <div style="display:flex;align-items:center;justify-content:space-between">
                        <span style="display:flex;align-items:center;gap:8px">
                            <span class="audit-toggle-icon" id="toggle-${sec.id}" style="transition:transform 0.2s">▼</span>
                            <strong>${esc(sec.title)}</strong>
                        </span>
                        <span style="font-size:0.75rem;color:var(--brand-700);font-weight:600">คลิกเพื่อยุบ/ขยาย</span>
                    </div>
                </td>
            </tr>
        `;

        if (sec.subsections) {
            sec.subsections.forEach(subsec => {
                let passBadge = subsec.status ? `<span class="audit-badge ${subsec.status.toLowerCase()}">${subsec.status}</span>` : '';
                let minCrText = subsec.minCr !== null && subsec.minCr !== undefined ? `MIN ${subsec.minCr} CR` : (subsec.status ? 'MIN - CR' : '');
                let passCrText = subsec.passCr !== null && subsec.passCr !== undefined ? `PASS ${subsec.passCr} CR` : (subsec.status ? 'PASS - CR' : '');
                let gpaText = subsec.gpa ? `GPA ${subsec.gpa}` : '';

                // Special evaluation for Section 1.2 (3 of 5 groups rule)
                if (subsec.id === 'sec-1-2') {
                    const eval1_2 = evaluateSection1_2(subsec);
                    const statusClass = eval1_2.isPassed ? 'pass' : 'fail';
                    passBadge = `<span class="audit-badge ${statusClass}">${eval1_2.isPassed ? 'PASS' : 'FAIL'}</span>`;
                    passCrText = `PASS ${eval1_2.earnedCredits} CR (${eval1_2.distinctCount}/3 กลุ่ม)`;
                    gpaText = `GPA ${eval1_2.gpa}`;
                }

                rowsHTML += `
                    <tr class="audit-subsec-hdr audit-row-${sec.id}">
                        <td colspan="6" style="padding:8px 14px">
                            <strong>${esc(subsec.title)}</strong>
                        </td>
                        <td colspan="8" style="text-align:right;padding-right:12px">
                            ${passBadge}
                            ${minCrText ? `<span class="audit-cr-pill">${minCrText}</span>` : ''}
                            ${passCrText ? `<span class="audit-cr-pill">${passCrText}</span>` : ''}
                            ${gpaText ? `<span class="audit-gpa-pill">${gpaText}</span>` : ''}
                        </td>
                    </tr>
                `;

                if (subsec.groups) {
                    const isSingleMatchingGroup = subsec.groups.length === 1 && (
                        subsec.groups[0].title.trim() === subsec.title.trim() ||
                        subsec.title.includes(subsec.groups[0].title.trim()) ||
                        subsec.groups[0].title.includes(subsec.title.trim())
                    );

                    subsec.groups.forEach(grp => {
                        if (subsec.id === 'sec-1-2') {
                            const hasPassedCourse = grp.courses.some(c => c.ca && c.ca > 0);
                            const grpCopy = {
                                ...grp,
                                status: hasPassedCourse ? 'PASS' : null,
                                passCr: hasPassedCourse ? 3 : null
                            };
                            rowsHTML += buildAuditGroupHTML(sec.id, grpCopy, isSingleMatchingGroup);
                        } else {
                            rowsHTML += buildAuditGroupHTML(sec.id, grp, isSingleMatchingGroup);
                        }
                    });
                } else if (subsec.subsections) {
                    subsec.subsections.forEach(subsub => {
                        rowsHTML += `
                            <tr class="audit-subsec-hdr audit-row-${sec.id}" style="background:#fafafa !important">
                                <td colspan="6" style="padding-left:24px">
                                    <strong>${esc(subsub.title)}</strong>
                                </td>
                                <td colspan="8"></td>
                            </tr>
                        `;
                        if (subsub.groups) {
                            const isSubSingleMatching = subsub.groups.length === 1 && (
                                subsub.groups[0].title.trim() === subsub.title.trim() ||
                                subsub.title.includes(subsub.groups[0].title.trim())
                            );
                            subsub.groups.forEach(grp => {
                                rowsHTML += buildAuditGroupHTML(sec.id, grp, isSubSingleMatching);
                            });
                        }
                    });
                }
            });
        } else if (sec.groups) {
            sec.groups.forEach(grp => {
                rowsHTML += buildAuditGroupHTML(sec.id, grp, false);
            });
        }
    });

    return rowsHTML;
}

let currentGradViewMode = 'table';

function renderCourseCardItem(c) {
    let termGradeHTML = '<span style="color:#94a3b8;font-size:0.75rem">○ ยังไม่ได้ลงทะเบียน</span>';
    if (c.terms) {
        for (const [termNum, gradeText] of Object.entries(c.terms)) {
            if (gradeText) {
                if (gradeText.startsWith('--')) {
                    termGradeHTML = `<span class="audit-grade-wait">⏳ ${esc(gradeText)}</span>`;
                } else {
                    termGradeHTML = `<span class="audit-grade-pass">🎓 ${esc(gradeText)}</span>`;
                }
                break;
            }
        }
    }

    return `
        <div class="audit-course-card">
            <div class="audit-course-card-top">
                <div>
                    <span class="audit-course-code">${esc(c.code)}:</span>
                    <span class="audit-course-card-title">${esc(c.name)}</span>
                </div>
                <div>${termGradeHTML}</div>
            </div>
            <div class="audit-course-card-meta">
                <span class="audit-course-card-meta-pill">หน่วยกิต: <strong>${esc(c.credits || '-')}</strong></span>
                <span class="audit-course-card-meta-pill">CA: <strong>${c.ca !== null && c.ca !== undefined ? c.ca : '-'}</strong></span>
                <span class="audit-course-card-meta-pill">PT: <strong>${c.pt !== null && c.pt !== undefined ? c.pt.toFixed(1) : '-'}</strong></span>
                <span class="audit-course-card-meta-pill">AVG: <strong>${c.avg !== null && c.avg !== undefined ? c.avg : '-'}</strong></span>
                <span class="audit-course-card-meta-pill">MAX: <strong>${c.max !== null && c.max !== undefined ? c.max : '-'}</strong></span>
            </div>
        </div>
    `;
}

function buildGraduationCardsHTML() {
    let html = '<div class="audit-cards-container">';
    MOCK_GRADUATION_AUDIT.sections.forEach(sec => {
        let secContent = '';

        if (sec.subsections) {
            sec.subsections.forEach(subsec => {
                let passBadge = subsec.status ? `<span class="audit-badge ${subsec.status.toLowerCase()}">${subsec.status}</span>` : '';
                let minCrText = subsec.minCr !== null && subsec.minCr !== undefined ? `MIN ${subsec.minCr} CR` : '';
                let passCrText = subsec.passCr !== null && subsec.passCr !== undefined ? `PASS ${subsec.passCr} CR` : '';
                let gpaText = subsec.gpa ? `GPA ${subsec.gpa}` : '';

                if (subsec.id === 'sec-1-2') {
                    const eval1_2 = evaluateSection1_2(subsec);
                    const statusClass = eval1_2.isPassed ? 'pass' : 'fail';
                    passBadge = `<span class="audit-badge ${statusClass}">${eval1_2.isPassed ? 'PASS' : 'FAIL'}</span>`;
                    passCrText = `PASS ${eval1_2.earnedCredits} CR (${eval1_2.distinctCount}/3 กลุ่ม)`;
                    gpaText = `GPA ${eval1_2.gpa}`;
                }

                secContent += `
                    <div class="audit-card-subsec-hdr">
                        <div><strong>${esc(subsec.title)}</strong></div>
                        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                            ${passBadge}
                            ${minCrText ? `<span class="audit-cr-pill">${minCrText}</span>` : ''}
                            ${passCrText ? `<span class="audit-cr-pill">${passCrText}</span>` : ''}
                            ${gpaText ? `<span class="audit-gpa-pill">${gpaText}</span>` : ''}
                        </div>
                    </div>
                `;

                if (subsec.groups) {
                    const isSingle = subsec.groups.length === 1 && (
                        subsec.groups[0].title.trim() === subsec.title.trim() ||
                        subsec.title.includes(subsec.groups[0].title.trim())
                    );

                    subsec.groups.forEach(grp => {
                        if (!isSingle) {
                            let grpBadge = grp.status ? `<span class="audit-badge ${grp.status.toLowerCase()}">${grp.status}</span>` : '';
                            let grpMin = grp.minCr ? `MIN ${grp.minCr} CR` : '';
                            let grpPass = grp.passCr ? `PASS ${grp.passCr} CR` : '';
                            let grpGpa = grp.gpa && grp.gpa !== '0.00' ? `GPA ${grp.gpa}` : '';

                            if (subsec.id === 'sec-1-2') {
                                const hasPassedCourse = grp.courses.some(c => c.ca && c.ca > 0);
                                grpBadge = hasPassedCourse ? '<span class="audit-badge pass">PASS</span>' : '';
                                grpPass = hasPassedCourse ? 'PASS 3 CR' : '';
                            }

                            secContent += `
                                <div class="audit-card-group-hdr">
                                    <span>${esc(grp.code || '')} ${esc(grp.title)}</span>
                                    <div style="display:flex;gap:4px;align-items:center">
                                        ${grpBadge}
                                        ${grpMin ? `<span class="audit-cr-pill">${grpMin}</span>` : ''}
                                        ${grpPass ? `<span class="audit-cr-pill">${grpPass}</span>` : ''}
                                        ${grpGpa ? `<span class="audit-gpa-pill">${grpGpa}</span>` : ''}
                                    </div>
                                </div>
                            `;
                        }

                        grp.courses.forEach(c => {
                            secContent += renderCourseCardItem(c);
                        });
                    });
                } else if (subsec.subsections) {
                    subsec.subsections.forEach(subsub => {
                        secContent += `
                            <div class="audit-card-group-hdr" style="background:#f8fafc">
                                <span><strong>${esc(subsub.title)}</strong></span>
                            </div>
                        `;
                        if (subsub.groups) {
                            subsub.groups.forEach(grp => {
                                grp.courses.forEach(c => {
                                    secContent += renderCourseCardItem(c);
                                });
                            });
                        }
                    });
                }
            });
        } else if (sec.groups) {
            sec.groups.forEach(grp => {
                grp.courses.forEach(c => {
                    secContent += renderCourseCardItem(c);
                });
            });
        }

        html += `
            <div class="audit-card-section" id="card-sec-${sec.id}">
                <div class="audit-card-sec-hdr" data-card-sec="${sec.id}">
                    <div style="display:flex;align-items:center;gap:8px">
                        <span class="audit-card-toggle-icon" id="card-toggle-${sec.id}" style="transition:transform 0.2s">▼</span>
                        <strong style="color:var(--brand-900);font-size:0.88rem">${esc(sec.title)}</strong>
                    </div>
                    <span style="font-size:0.75rem;color:var(--brand-700);font-weight:600">คลิกเพื่อยุบ/ขยาย</span>
                </div>
                <div class="audit-card-sec-body" id="card-body-${sec.id}">
                    ${secContent}
                </div>
            </div>
        `;
    });

    html += '</div>';
    return html;
}

function renderGraduation(student) {
    const audit = MOCK_GRADUATION_AUDIT;
    const s = audit.summary;
    const progressPct = Math.round((s.totalEarnedCredits / s.totalRequiredCredits) * 100);

    const pendingListHTML = s.pendingRequirements.map(item => `
        <li style="margin-bottom:6px;display:flex;align-items:flex-start;gap:6px">
            <span style="color:var(--red-500);font-weight:bold">•</span>
            <span>${esc(item)}</span>
        </li>
    `).join('');

    document.getElementById('graduationContent').innerHTML = `
        <!-- Summary Stat Row -->
        <div class="stat-row">
            <div class="stat-card">
                <div class="stat-icon purple">🎓</div>
                <div>
                    <div class="stat-value">${progressPct}%</div>
                    <div class="stat-label">ความคืบหน้ารวม (${s.totalEarnedCredits}/${s.totalRequiredCredits} CR)</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon green">📊</div>
                <div>
                    <div class="stat-value">${student.gpa.toFixed(2)}</div>
                    <div class="stat-label">GPA สะสม (เกณฑ์ขั้นต่ำ ≥ ${s.minGpa.toFixed(2)})</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon amber">📚</div>
                <div>
                    <div class="stat-value">${s.passedCategories}/${s.totalCategories}</div>
                    <div class="stat-label">หมวดที่ผ่านเกณฑ์</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon red">⚠️</div>
                <div>
                    <div class="stat-value" style="font-size:1.1rem;color:var(--red-600)">${esc(s.status)}</div>
                    <div class="stat-label">สถานะการสำเร็จการศึกษา</div>
                </div>
            </div>
        </div>

        <!-- Progress Bar & Pending Alert -->
        <div class="card" style="margin-bottom:18px">
            <div class="card-title" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
                <span>📈 สรุปเงื่อนไขการสำเร็จการศึกษา (Graduation Requirements Audit)</span>
            </div>

            <div class="progress-group" style="margin-bottom:16px">
                <div class="progress-label">
                    <strong>หน่วยกิตสะสมตามหลักสูตร</strong>
                    <span>${s.totalEarnedCredits} จาก ${s.totalRequiredCredits} หน่วยกิต (${progressPct}%)</span>
                </div>
                <div class="progress-bar" style="height:10px">
                    <div class="progress-fill green" style="width:${progressPct}%"></div>
                </div>
            </div>

            <div style="padding:12px 16px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:var(--radius-md)">
                <div style="font-weight:700;color:var(--red-600);margin-bottom:6px;display:flex;align-items:center;gap:6px">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    รายการที่ต้องดำเนินการเพิ่มเติมเพื่อสำเร็จการศึกษา:
                </div>
                <ul style="margin:0;padding-left:16px;font-size:0.84rem;color:var(--g-700)">
                    ${pendingListHTML}
                </ul>
            </div>
        </div>

        <!-- View Mode Switcher Toolbar -->
        <div class="audit-view-toolbar">
            <div class="audit-view-btn-group">
                <button class="audit-view-btn ${currentGradViewMode === 'table' ? 'active' : ''}" id="gradViewTableBtn" title="สลับเป็นมุมมองตารางเต็ม">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
                    📊 ตารางเต็ม (Table View)
                </button>
                <button class="audit-view-btn ${currentGradViewMode === 'cards' ? 'active' : ''}" id="gradViewCardsBtn" title="สลับเป็นการ์ดสรุปบนมือถือ">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                    📱 การ์ดสรุป (Mobile Cards)
                </button>
            </div>
            <div style="display:flex;gap:8px">
                <button class="btn btn-sm btn-ghost" id="auditExpandAllBtn">▾ ขยายทุกหมวด</button>
                <button class="btn btn-sm btn-ghost" id="auditCollapseAllBtn">▴ ยุบทุกหมวด</button>
            </div>
        </div>

        <!-- 1. Full Audit Matrix Table View -->
        <div id="gradTableViewContainer" style="${currentGradViewMode === 'table' ? '' : 'display:none'}">
            <div class="card" style="padding:0;overflow:hidden">
                <div class="audit-scroll-hint">
                    <span>👈 เลื่อนตารางแนวนอนเพื่อดูผลเรียนแต่ละเทอม (เทอม 1-8) 👉</span>
                </div>
                <div class="audit-wrap">
                    <table class="audit-table" id="graduationAuditTable">
                        <thead>
                            <tr>
                                <th class="subject-col">รายวิชา</th>
                                <th class="cr-col">หน่วยกิต</th>
                                <th class="num-col">CA</th>
                                <th class="num-col">PT</th>
                                <th class="num-col">AVG</th>
                                <th class="num-col">MAX</th>
                                <th class="term-col">1</th>
                                <th class="term-col">2</th>
                                <th class="term-col">3</th>
                                <th class="term-col">4</th>
                                <th class="term-col">5</th>
                                <th class="term-col">6</th>
                                <th class="term-col">7</th>
                                <th class="term-col">8</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${buildGraduationAuditTableRows()}
                        </tbody>
                    </table>
                </div>

                <!-- Table Legend Footnote -->
                <div style="padding:14px 20px;background:#fafafa;border-top:1px solid #cbd5e1;font-size:0.75rem;color:#475569;line-height:1.6">
                    <strong>หมายเหตุ (Legend):</strong><br>
                    <strong>CA</strong>: จำนวนหน่วยกิตที่ลงทะเบียน · <strong>CS</strong>: จำนวนหน่วยกิตที่ผ่าน · <strong>CW</strong>: จำนวนหน่วยกิตที่รอ · <strong>CG</strong>: จำนวนหน่วยกิตที่คิดเกรด · <strong>PT</strong>: คะแนนรวม · <strong>AVG</strong>: ค่าเฉลี่ย · <strong>MAX</strong>: เกรดสูงสุด
                </div>
            </div>
        </div>

        <!-- 2. Mobile Cards View -->
        <div id="gradCardsViewContainer" style="${currentGradViewMode === 'cards' ? '' : 'display:none'}">
            ${buildGraduationCardsHTML()}
        </div>
    `;

    // ── View Mode Switcher Event Listeners ──
    const tableBtn = document.getElementById('gradViewTableBtn');
    const cardsBtn = document.getElementById('gradViewCardsBtn');
    const tableContainer = document.getElementById('gradTableViewContainer');
    const cardsContainer = document.getElementById('gradCardsViewContainer');

    tableBtn?.addEventListener('click', () => {
        currentGradViewMode = 'table';
        tableBtn.classList.add('active');
        cardsBtn.classList.remove('active');
        if (tableContainer) tableContainer.style.display = '';
        if (cardsContainer) cardsContainer.style.display = 'none';
    });

    cardsBtn?.addEventListener('click', () => {
        currentGradViewMode = 'cards';
        cardsBtn.classList.add('active');
        tableBtn.classList.remove('active');
        if (tableContainer) tableContainer.style.display = 'none';
        if (cardsContainer) cardsContainer.style.display = '';
    });

    // ── Accordion Collapse / Expand Events for Table View ──
    document.querySelectorAll('.audit-sec-hdr').forEach(hdr => {
        hdr.addEventListener('click', () => {
            const secId = hdr.dataset.sec;
            const rows = document.querySelectorAll(`.audit-row-${secId}`);
            const icon = document.getElementById(`toggle-${secId}`);
            const isHidden = rows.length > 0 && rows[0].style.display === 'none';

            rows.forEach(r => {
                r.style.display = isHidden ? '' : 'none';
            });
            if (icon) icon.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
        });
    });

    // ── Accordion Collapse / Expand Events for Cards View ──
    document.querySelectorAll('.audit-card-sec-hdr').forEach(hdr => {
        hdr.addEventListener('click', () => {
            const secId = hdr.dataset.cardSec;
            const body = document.getElementById(`card-body-${secId}`);
            const icon = document.getElementById(`card-toggle-${secId}`);
            if (body) {
                const isHidden = body.style.display === 'none';
                body.style.display = isHidden ? '' : 'none';
                if (icon) icon.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
            }
        });
    });

    // ── Expand / Collapse All Buttons for Both Views ──
    document.getElementById('auditExpandAllBtn')?.addEventListener('click', () => {
        MOCK_GRADUATION_AUDIT.sections.forEach(sec => {
            // Table view rows
            document.querySelectorAll(`.audit-row-${sec.id}`).forEach(r => r.style.display = '');
            const tableIcon = document.getElementById(`toggle-${sec.id}`);
            if (tableIcon) tableIcon.style.transform = 'rotate(0deg)';

            // Cards view bodies
            const cardBody = document.getElementById(`card-body-${sec.id}`);
            const cardIcon = document.getElementById(`card-toggle-${sec.id}`);
            if (cardBody) cardBody.style.display = '';
            if (cardIcon) cardIcon.style.transform = 'rotate(0deg)';
        });
    });

    document.getElementById('auditCollapseAllBtn')?.addEventListener('click', () => {
        MOCK_GRADUATION_AUDIT.sections.forEach(sec => {
            // Table view rows
            document.querySelectorAll(`.audit-row-${sec.id}`).forEach(r => r.style.display = 'none');
            const tableIcon = document.getElementById(`toggle-${sec.id}`);
            if (tableIcon) tableIcon.style.transform = 'rotate(-90deg)';

            // Cards view bodies
            const cardBody = document.getElementById(`card-body-${sec.id}`);
            const cardIcon = document.getElementById(`card-toggle-${sec.id}`);
            if (cardBody) cardBody.style.display = 'none';
            if (cardIcon) cardIcon.style.transform = 'rotate(-90deg)';
        });
    });
}

/* ============================================================
   ACTIVITIES
   ============================================================ */
function renderActivity() {
    const totalHours = MOCK_ACTIVITIES.reduce((a, c) => a + c.hours, 0);
    const passed = MOCK_ACTIVITIES.filter(a => a.status === 'ผ่าน').length;
    const cards = MOCK_ACTIVITIES.map(a => `
        <div class="activity-card">
            <div class="activity-icon" style="background:var(--brand-50)">${a.icon}</div>
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

/* ============================================================
   ACADEMIC PETITIONS
   ============================================================ */
function renderPetitions(student) {
    const container = document.getElementById('petitionsContent');
    const myPetitions = MOCK_PETITIONS_LOG.filter(p => p.studentId === student.studentId);
    const displayList = myPetitions.length > 0 ? myPetitions : MOCK_PETITIONS_LOG.slice(0, 3);

    const historyCards = displayList.map(p => `
        <div class="petition-history-card">
            <div class="petition-history-top">
                <span class="petition-history-id">${esc(p.id)}</span>
                <span class="badge ${statusBadge(p.status)}">${esc(p.status)}</span>
            </div>
            <div class="petition-history-type">${esc(p.type)}</div>
            <div class="petition-history-title">${esc(p.title)}</div>
            ${p.details ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">${esc(p.details)}</div>` : ''}
            ${p.adminComment ? `<div style="font-size:0.78rem;background:var(--brand-50);padding:6px 10px;border-radius:var(--radius-sm);color:var(--brand-700);margin-bottom:8px">💬 <strong>ความเห็นแอดมิน:</strong> ${esc(p.adminComment)}</div>` : ''}
            <div class="petition-history-date">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                ${esc(p.submittedAt)}
                ${p.attachment ? `<span style="margin-left:auto;color:var(--brand-500);font-weight:600">📎 ${esc(p.attachment)}</span>` : ''}
            </div>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="stat-row">
            <div class="stat-card"><div class="stat-icon purple">📝</div><div><div class="stat-value">${displayList.length}</div><div class="stat-label">คำร้องของคุณ</div></div></div>
            <div class="stat-card"><div class="stat-icon green">✅</div><div><div class="stat-value">${displayList.filter(p => p.status === 'อนุมัติ').length}</div><div class="stat-label">อนุมัติแล้ว</div></div></div>
            <div class="stat-card"><div class="stat-icon amber">⏳</div><div><div class="stat-value">${displayList.filter(p => p.status === 'รอดำเนินการ').length}</div><div class="stat-label">รอดำเนินการ</div></div></div>
        </div>

        <div class="card petition-form-card">
            <div class="card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <path d="M12 18v-6"/><path d="M9 15h6"/>
                </svg>
                ยื่นคำร้องใหม่ <span class="header-en">Submit New Petition</span>
            </div>
            <p class="petition-form-desc">กรอกรายละเอียดคำร้องวิชาการของคุณด้านล่าง ไฟล์แนบรองรับเฉพาะ .pdf เท่านั้น</p>

            <form id="petitionForm" class="petition-form" autocomplete="off">
                <div class="petition-form-grid">
                    <div class="petition-field">
                        <label for="petitionType">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
                            ประเภทคำร้อง <span class="field-required">*</span>
                        </label>
                        <select id="petitionType" name="petitionType" required>
                            <option value="" disabled selected>— เลือกประเภทคำร้อง —</option>
                            <option value="proposal-defense">ยื่นขอสอบหัวข้อโปรเจคจบ (Proposal Defense Request)</option>
                            <option value="final-defense">ยื่นสอบจบปริญญานิพนธ์ (Final Defense Request)</option>
                            <option value="general">คำร้องทั่วไป (General Petition)</option>
                        </select>
                    </div>

                    <div class="petition-field">
                        <label for="petitionTitle">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            ชื่อหัวข้อ / Project Title <span class="field-required">*</span>
                        </label>
                        <input type="text" id="petitionTitle" name="projectTitle" placeholder="ระบุชื่อหัวข้อโปรเจคหรือชื่อเรื่องคำร้อง" required />
                    </div>
                </div>

                <div class="petition-field">
                    <label for="petitionDetails">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                        รายละเอียดเพิ่มเติม / เหตุผล
                    </label>
                    <textarea id="petitionDetails" name="details" rows="4" placeholder="อธิบายรายละเอียดหรือเหตุผลประกอบคำร้อง..."></textarea>
                </div>

                <div class="petition-field">
                    <label for="petitionFile">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                        แนบไฟล์ (PDF เท่านั้น)
                    </label>
                    <div class="petition-file-upload" id="petitionFileDropZone">
                        <input type="file" id="petitionFile" name="attachment" accept=".pdf" />
                        <div class="petition-file-placeholder" id="petitionFilePlaceholder">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            <span>คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่</span>
                            <small>รองรับเฉพาะ .pdf ขนาดไม่เกิน 10 MB</small>
                        </div>
                        <div class="petition-file-selected" id="petitionFileSelected" style="display:none">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            <span id="petitionFileName">file.pdf</span>
                            <button type="button" class="petition-file-remove" id="petitionFileRemove" aria-label="ลบไฟล์">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="petition-form-actions">
                    <button type="reset" class="btn btn-ghost">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
                        ล้างฟอร์ม
                    </button>
                    <button type="submit" class="btn btn-primary btn-submit-petition" id="petitionSubmitBtn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                        ยื่นคำร้อง
                    </button>
                </div>
            </form>
        </div>

        <div class="card">
            <div class="card-title">📋 ประวัติคำร้องที่ผ่านมา <span class="header-en">Petition History</span></div>
            <div class="petition-history-list">
                ${historyCards}
            </div>
        </div>
    `;

    // ── File input UX enhancement ──
    const fileInput = document.getElementById('petitionFile');
    const placeholder = document.getElementById('petitionFilePlaceholder');
    const selectedUI = document.getElementById('petitionFileSelected');
    const fileNameSpan = document.getElementById('petitionFileName');
    const removeBtn = document.getElementById('petitionFileRemove');
    const dropZone = document.getElementById('petitionFileDropZone');

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            fileNameSpan.textContent = fileInput.files[0].name;
            placeholder.style.display = 'none';
            selectedUI.style.display = 'flex';
        }
    });

    removeBtn.addEventListener('click', () => {
        fileInput.value = '';
        placeholder.style.display = 'flex';
        selectedUI.style.display = 'none';
    });

    // Drag-and-drop visual feedback
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('dragover'); });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.type === 'application/pdf') {
                fileInput.files = e.dataTransfer.files;
                fileNameSpan.textContent = file.name;
                placeholder.style.display = 'none';
                selectedUI.style.display = 'flex';
            } else {
                showPetitionToast('error', 'รองรับเฉพาะไฟล์ PDF เท่านั้น');
            }
        }
    });

    // ── Form Submission (Real Spring Boot REST API Integration) ──
    const form = document.getElementById('petitionForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = document.getElementById('petitionSubmitBtn');
        const originalHTML = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="petition-spinner"></span> กำลังส่งคำร้อง...`;

        const typeMap = {
            'proposal-defense': 'ยื่นขอสอบหัวข้อโปรเจคจบ',
            'final-defense': 'ยื่นสอบจบปริญญานิพนธ์',
            'general': 'คำร้องทั่วไป',
        };

        const petitionPayload = {
            type: typeMap[form.petitionType.value] || form.petitionType.value,
            title: form.projectTitle.value.trim(),
            details: form.details.value.trim(),
            attachment: fileInput.files[0] ? fileInput.files[0].name : null,
            studentId: student.studentId || '6421100042',
        };

        try {
            console.log('📤 [Student] Submitting Academic Petition to Spring Boot Backend...', petitionPayload);
            const savedPetition = await fetchAPI('/petitions', 'POST', petitionPayload);
            console.log('✅ [Student] Petition Saved Successfully in PostgreSQL:', savedPetition);

            const now = new Date();
            const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
            const dateStr = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear() + 543} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            const newEntry = {
                id: savedPetition.id,
                studentId: student.studentId || '6421100042',
                studentName: student.nameTh,
                type: savedPetition.type,
                title: savedPetition.title,
                details: savedPetition.details,
                attachment: savedPetition.attachment,
                submittedAt: dateStr,
                status: savedPetition.status || 'รอดำเนินการ',
                adminComment: savedPetition.adminComment || '',
            };
            MOCK_PETITIONS_LOG.unshift(newEntry);

            showPetitionToast('success', `คำร้อง ${savedPetition.id} ถูกบันทึกลงฐานข้อมูลเรียบร้อยแล้ว ✅`);
            renderPetitions(student);
        } catch (err) {
            console.error('❌ [Student] Failed to submit petition to Backend:', err);
            showPetitionToast('error', `ไม่สามารถส่งคำร้องได้: ${err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ'}`);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalHTML;
        }
    });
}

/* ============================================================
   PETITION — Mock API Call
   ============================================================ */
function mockPetitionSubmit(data) {
    return new Promise((resolve) => {
        setTimeout(() => {
            // Simulate 90% success rate
            const success = Math.random() > 0.1;
            if (success) {
                const petitionId = 'PET-' + new Date().getFullYear() + '-' + String(Math.floor(100 + Math.random() * 900));
                resolve({ success: true, petitionId, message: 'Petition submitted successfully' });
            } else {
                resolve({ success: false, message: 'เซิร์ฟเวอร์ไม่สามารถประมวลผลคำร้องได้ในขณะนี้' });
            }
        }, 1500); // Simulate network delay
    });
}

/* ============================================================
   PETITION — Toast Notification
   ============================================================ */
function showPetitionToast(type, message) {
    // Remove existing toast
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
        <div class="petition-toast-icon">${icons[type]}</div>
        <span class="petition-toast-msg">${message}</span>
        <button class="petition-toast-close" aria-label="ปิด">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
    `;
    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('visible'));

    // Close button
    toast.querySelector('.petition-toast-close').addEventListener('click', () => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    });

    // Auto dismiss after 5s
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}
