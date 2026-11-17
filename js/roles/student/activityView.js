/* ============================================================
   BSRU Student Portal — Student Activity Check & Real BSRU Criteria
   ============================================================
   Implements the 17 official BSRU student activity categories,
   minimum required participation counts, volunteer hour tracking,
   self-registration with criteria validation, and activity transcript table.
   ============================================================ */

import { esc, showToast, admissionYearFromId, currentAcademicYearBE } from '../../utils.js';
import { fetchAPI } from '../../api.js';
import { MOCK_STUDENTS_POOL } from '../admin/mockData.js';

/**
 * เกณฑ์ประเภทกิจกรรมนักศึกษาจริง มหาวิทยาลัยราชภัฏบ้านสมเด็จเจ้าพระยา (17 ประเภท)
 * minRequired = จำนวนครั้งขั้นต่ำที่ต้องเข้าร่วมจึงจะถือว่า "ผ่าน" ในหมวดนั้น
 * minYear     = ชั้นปีขั้นต่ำที่มีสิทธิ์เข้าร่วม
 * isPublicMind= หมวดจิตสาธารณะที่ต้องระบุจำนวนชั่วโมงสะสม
 */
export const BSRU_ACTIVITY_CRITERIA = [
    { id: 'uni-orient', name: 'ปฐมนิเทศรวม', group: 'มหาวิทยาลัย', minRequired: 1, minYear: 1, isPublicMind: false },
    { id: 'piralai', name: 'วันพิราลัย', group: 'มหาวิทยาลัย', minRequired: 1, minYear: 1, isPublicMind: false },
    { id: 'rajabhat-day', name: 'วันสถาปนา ราชภัฏ', group: 'มหาวิทยาลัย', minRequired: 1, minYear: 1, isPublicMind: false },
    { id: 'public-mind', name: 'จิตสาธารณะ', group: 'จิตสาธารณะ/ชมรม', minRequired: 2, minYear: 1, isPublicMind: true },
    { id: 'club', name: 'ชมรม/ชุมนุม', group: 'จิตสาธารณะ/ชมรม', minRequired: 3, minYear: 1, isPublicMind: false },
    { id: 'uni-elective', name: 'กิจกรรมเลือก (มหาวิทยาลัย)', group: 'มหาวิทยาลัย', minRequired: 10, minYear: 1, isPublicMind: false },
    { id: 'life-skill-y2', name: 'อบรมทักษะชีวิต ชั้นปี 2', group: 'ทักษะชีวิตและคุณธรรม', minRequired: 1, minYear: 2, isPublicMind: false },
    { id: 'ethics', name: 'อบรมคุณธรรมจริยธรรม', group: 'ทักษะชีวิตและคุณธรรม', minRequired: 1, minYear: 1, isPublicMind: false },
    { id: 'life-skill-y3', name: 'อบรมทักษะชีวิต ชั้นปี 3', group: 'ทักษะชีวิตและคุณธรรม', minRequired: 1, minYear: 3, isPublicMind: false },
    { id: 'digital-work', name: 'พัฒนาทักษะดิจิทัลเพื่อรองรับการทำงาน', group: 'ทักษะดิจิทัล', minRequired: 1, minYear: 3, isPublicMind: false },
    { id: 'fac-mandatory', name: 'กิจกรรมบังคับ (คณะ)', group: 'คณะ', minRequired: 5, minYear: 1, isPublicMind: false },
    { id: 'fac-orient', name: 'ปฐมนิเทศคณะ', group: 'คณะ', minRequired: 1, minYear: 1, isPublicMind: false },
    { id: 'thonburi-study', name: 'ศึกษาแหล่งเรียนรู้กรุงธนบุรีศึกษา', group: 'มหาวิทยาลัย', minRequired: 1, minYear: 1, isPublicMind: false },
    { id: 'exit-orient', name: 'ปัจฉิมนิเทศ', group: 'ปัจฉิม/ชั้นปีสุดท้าย', minRequired: 1, minYear: 4, finalYearOnly: true, isPublicMind: false },
    { id: 'digital-new', name: 'ทักษะดิจิทัลสำหรับนักศึกษาใหม่', group: 'ทักษะดิจิทัล', minRequired: 1, minYear: 1, isPublicMind: false },
    { id: 'digital-final', name: 'ทักษะดิจิทัลสำหรับนักศึกษาชั้นปีสุดท้าย', group: 'ทักษะดิจิทัล', minRequired: 1, minYear: 4, finalYearOnly: true, isPublicMind: false },
    { id: 'fac-elective', name: 'กิจกรรมเลือก (คณะ)', group: 'คณะ', minRequired: 5, minYear: 1, isPublicMind: false },
];

/**
 * รายการประวัติการเข้าร่วมกิจกรรมเริ่มต้น (Baseline records for offline/demo fallback)
 */
export const BASE_ACTIVITY_RECORDS = {
    'uni-orient': [
        { academicYear: '2566', date: '1/7/2566', title: 'ปฐมนิเทศนักศึกษาใหม่ ประจำปีการศึกษา 2566', count: 1, hours: null, status: 'ผ่าน' },
    ],
    'piralai': [
        { academicYear: '2566', date: '19/1/2567', title: 'วันคล้ายวันพิราลัย พ.ศ. 2567', count: 1, hours: null, status: 'ผ่าน' },
    ],
    'rajabhat-day': [
        { academicYear: '2566', date: '14/2/2567', title: 'พิธีอัญเชิญตราราชภัฏ (วันสถาปนาราชภัฏ)', count: 1, hours: null, status: 'ผ่าน' },
    ],
    'public-mind': [
        { academicYear: '2566', date: '27/9/2566', title: 'บริจาคโลหิตช่วยเหลือชีวิต สร้างจิตสำนึกการเป็นผู้ให้ ครั้งที่ 26 (ผ่าน)', count: 1, hours: 6, status: 'ผ่าน' },
        { academicYear: '2566', date: '31/10/2566', title: 'จิตอาสา-Big Cleaning Day ติดตาม "ราชภัฏเพื่อการพัฒนา สู่ท้องถิ่น"', count: 1, hours: 3, status: 'ผ่าน' },
        { academicYear: '2566', date: '30/11/2566', title: 'การเปิดสนามกีฬาเพื่อการแข่งขันกีฬาสร้างความสามัคคี', count: 1, hours: null, status: 'ผ่าน' },
        { academicYear: '2566', date: '12/2/2567', title: 'บริจาคโลหิตช่วยเหลือชีวิต สร้างจิตสำนึกการเป็นผู้ให้ ครั้งที่ 27 (ผ่าน)', count: 1, hours: 6, status: 'ผ่าน' },
    ],
    'club': [
        { academicYear: '2566', date: '-', title: 'ชมรม ชีวะออนทัวร์', count: 1, hours: null, status: 'ผ่าน' },
        { academicYear: '2566', date: '-', title: 'ชมรม Board Games (บอร์ดเกม)', count: 1, hours: null, status: 'ผ่าน' },
        { academicYear: '2567', date: '-', title: 'ชมรม Backup Product 2567', count: 1, hours: null, status: 'ผ่าน' },
    ],
    'uni-elective': [
        { academicYear: '2566', date: '15/7/2566', title: 'บายศรีสู่ขวัญและรับน้องใหม่ ประจำปี 2566', count: 1, hours: null, status: 'ผ่าน' },
        { academicYear: '2566', date: '17/1/2567', title: 'การแสดงนิทรรศการและการเสวนาทางวิชาการ วันพิราลัย 2567', count: 1, hours: null, status: 'ผ่าน' },
        { academicYear: '2566', date: '18/1/2567', title: 'การแสดงหน้าเวที อาคาร 1 (18 มกราคม 67)', count: 1, hours: null, status: 'ผ่าน' },
        { academicYear: '2566', date: '19/1/2567', title: 'การแสดงฑูตกิจกรรม [วันพิราลัย]', count: 1, hours: null, status: 'ผ่าน' },
        { academicYear: '2566', date: '19/1/2567', title: 'ประกวดร้องเพลงลูกทุ่ง [วันคล้ายวันพิราลัย]', count: 1, hours: null, status: 'ผ่าน' },
        { academicYear: '2566', date: '19/1/2567', title: 'การประกวดพูดสุนทรพจน์ [วันคล้ายวันพิราลัย]', count: 1, hours: null, status: 'ผ่าน' },
        { academicYear: '2566', date: '22/3/2567', title: 'แข่งขันกีฬาภายในประจำปีการศึกษา 2566 "ชงโคเกมส์ 2024"', count: 1, hours: null, status: 'ผ่าน' },
        { academicYear: '2566', date: '2/4/2567', title: 'กิจกรรมที่ ๑ อบรมเชิงปฏิบัติการ "การเสริมสร้างพลังผู้นำแห่งอนาคตเพื่อการพัฒนาที่ยั่งยืน"', count: 1, hours: null, status: 'ผ่าน' },
        { academicYear: '2566', date: '3/4/2567', title: 'เรียนรู้เข้าใจใช้เป็น สิทธิ์บัตรทอง', count: 1, hours: null, status: 'ผ่าน' },
        { academicYear: '2566', date: '5/4/2567', title: 'เลือกตั้งนายกองค์การนักศึกษา ประจำปีการศึกษา 2567', count: 1, hours: null, status: 'ผ่าน' },
        { academicYear: '2567', date: '14/3/2568', title: 'เลือกตั้งนายกองค์การนักศึกษา ประจำปี 2568', count: 1, hours: null, status: 'ผ่าน' },
        { academicYear: '2568', date: '4/3/2569', title: 'โครงการพัฒนาทักษะภาษาอังกฤษเพื่อยกระดับภาษาอังกฤษ CEFR (ออนไลน์) ปีการศึกษา ๒๕๖๘', count: 1, hours: null, status: 'ผ่าน' },
    ],
    'life-skill-y2': [
        { academicYear: '2567', date: '14/12/2567', title: 'อบรมทักษะชีวิต นักศึกษา ชั้นปี 2', count: 1, hours: null, status: 'ผ่าน' },
    ],
    'ethics': [
        { academicYear: '2566', date: '5/7/2566', title: 'อบรมคุณธรรมและจริยธรรม', count: 1, hours: null, status: 'ผ่าน' },
    ],
    'life-skill-y3': [
        { academicYear: '2568', date: '1/2/2569', title: 'อบรมทักษะชีวิตสำหรับนักศึกษา ชั้นปีที่ 3 ประจำปีการศึกษา 2568', count: 1, hours: null, status: 'ผ่าน' },
    ],
    'digital-work': [
        { academicYear: '2568', date: '25/8/2568', title: 'การพัฒนาและการทดสอบทักษะด้านดิจิทัลสำหรับนักศึกษาชั้นปีที่ 3', count: 1, hours: null, status: 'ผ่าน' },
    ],
    'fac-mandatory': [
        { academicYear: '2566', date: '10/8/2566', title: 'พิธีไหว้ครู สืบสานวัฒนธรรมไทย ปีการศึกษา 2566', count: 1, hours: null, status: 'ผ่าน' },
        { academicYear: '2566', date: '16/2/2567', title: 'พัฒนาซอฟต์สกิลด้วยกระบวนการวิศวกรสังคม (คณะวิทยาศาสตร์ฯ)', count: 1, hours: null, status: 'ผ่าน' },
        { academicYear: '2566', date: '16/2/2567', title: 'ปรับพื้นฐานทางวิชาการคณะวิทยาศาสตร์และเทคโนโลยี', count: 1, hours: null, status: 'ผ่าน' },
        { academicYear: '2566', date: '4/3/2567', title: '[บังคับคณะ] กิจกรรมกีฬาวิทยาศาสตร์และเทคโนโลยีสัมพันธ์ ประจำปีการศึกษา 2566', count: 1, hours: null, status: 'ผ่าน' },
        { academicYear: '2566', date: '5/4/2567', title: 'เลือกตั้งนายกสโมสรนักศึกษา คณะ ประจำปีการศึกษา 2567', count: 1, hours: null, status: 'ผ่าน' },
        { academicYear: '2566', date: '-', title: 'กิจกรรมเสริมสร้างสมรรถนะความเป็นครู', count: 1, hours: null, status: 'ผ่าน' },
        { academicYear: '2567', date: '14/3/2568', title: 'เลือกตั้งนายกสโมสรนักศึกษาคณะ ประจำปี 2568', count: 1, hours: null, status: 'ผ่าน' },
    ],
    'fac-orient': [
        { academicYear: '2566', date: '4/7/2566', title: 'ปฐมนิเทศนักศึกษาใหม่: ก้าวแรกสู่รั้วมหาวิทยาลัยยุคดิจิทัล ปีการศึกษา 2566 วันเริ่มกิจกรรม', count: 1, hours: null, status: 'ผ่าน' },
    ],
    'thonburi-study': [
        { academicYear: '2569', date: '15/7/2569', title: 'แหล่งเรียนรู้กรุงธนบุรีศึกษา', count: 1, hours: null, status: 'ผ่าน' },
    ],
    'exit-orient': [],
    'digital-new': [
        { academicYear: '2566', date: '22/7/2566', title: 'พัฒนาทักษะดิจิทัลและการทดสอบดิจิทัลสำหรับนักศึกษาใหม่ ประจำปีการศึกษา 2566', count: 1, hours: null, status: 'ผ่าน' },
    ],
    'digital-final': [],
    'fac-elective': [
        { academicYear: '2566', date: '7/7/2566', title: 'ถวายเทียนพรรษา สืบสานวัฒนธรรมไทย ประจำปี 2566', count: 1, hours: null, status: 'ผ่าน' },
        { academicYear: '2566', date: '21/11/2566', title: 'แฟชั่นโชว์เพื่อผลสัมฤทธิ์ทางการเรียน', count: 1, hours: null, status: 'ผ่าน' },
        { academicYear: '2566', date: '17/1/2567', title: 'ละครนอก ขุนช้างขุนแผน [งานวันพิราลัย]', count: 1, hours: null, status: 'ผ่าน' },
        { academicYear: '2566', date: '18/1/2567', title: 'การประกวดแฟชั่นโชว์ [งานวันพิราลัย]', count: 1, hours: null, status: 'ผ่าน' },
        { academicYear: '2566', date: '18/1/2567', title: 'เปิดบ้านวิทยาการ [วันคล้ายวันพิราลัย]', count: 1, hours: null, status: 'ผ่าน' },
        { academicYear: '2566', date: '19/1/2567', title: 'เภสัชกรรมไทย, หมอยาไทย, สาธิตการทำสมุนไพร [วันคล้ายวันพิราลัย]', count: 1, hours: null, status: 'ผ่าน' },
    ],
};

/** Backward-compatible flattened list export */
export const MOCK_ACTIVITIES = Object.entries(BASE_ACTIVITY_RECORDS).flatMap(([catId, items]) => {
    const cat = BSRU_ACTIVITY_CRITERIA.find(c => c.id === catId);
    return items.map(it => ({
        name: it.title,
        date: it.date,
        type: cat ? cat.name : 'กิจกรรม',
        hours: it.hours || 0,
        status: it.status,
    }));
});

/* ============================================================
   STATE CACHE
   ============================================================ */
let _activityRecordsCache = {}; // studentId -> { [catId]: [records...] }
let _currentStudentId = null;
let _activityStatusFilter = 'ALL';
let _activityGroupFilter = 'ALL';
let _activitySearchQuery = '';
let _collapsedCatIds = new Set();
let _isFormOpen = false;

/**
 * Load student activities from REST API or fallback to local storage / base records.
 */
async function loadStudentActivities(studentId) {
    if (_activityRecordsCache[studentId]) {
        return _activityRecordsCache[studentId];
    }

    try {
        const data = await fetchAPI(`/students/${studentId}/activities`);
        if (Array.isArray(data) && data.length > 0) {
            const mapped = {};
            BSRU_ACTIVITY_CRITERIA.forEach(c => { mapped[c.id] = []; });
            for (const item of data) {
                const catId = item.activityCategoryId;
                if (!mapped[catId]) mapped[catId] = [];
                mapped[catId].push({
                    id: item.id,
                    academicYear: item.academicYear,
                    date: item.activityDate || '-',
                    title: item.title,
                    count: item.count || 1,
                    hours: item.hours,
                    status: item.status || 'ผ่าน',
                    isSelfRegistered: true,
                });
            }
            _activityRecordsCache[studentId] = mapped;
            return mapped;
        }
    } catch (err) {
        console.warn('[ActivityView] Could not load activities from API, using local storage fallback:', err.message);
    }

    // LocalStorage fallback for offline / mock students
    let stored = null;
    try {
        const raw = localStorage.getItem('bsru_activities_' + studentId);
        if (raw) stored = JSON.parse(raw);
    } catch (e) {}

    if (stored) {
        _activityRecordsCache[studentId] = stored;
        return stored;
    }

    // Default clone of BASE_ACTIVITY_RECORDS
    const fallback = {};
    for (const [k, v] of Object.entries(BASE_ACTIVITY_RECORDS)) {
        fallback[k] = v.map(item => ({ ...item }));
    }
    _activityRecordsCache[studentId] = fallback;
    return fallback;
}

/**
 * Save updated records to local storage fallback
 */
function saveLocalFallback(studentId, records) {
    try {
        localStorage.setItem('bsru_activities_' + studentId, JSON.stringify(records));
    } catch (e) {}
}

/**
 * Build student activity transcript combining criteria with records
 */
function buildStudentActivityTranscript(student, activityMap) {
    const isGraduated = student && student.status === 'จบการศึกษา';
    const studentYear = Number(student?.year) || 4;

    return BSRU_ACTIVITY_CRITERIA.map(cat => {
        let records = [...(activityMap[cat.id] || [])];

        if (isGraduated && cat.finalYearOnly && records.length === 0) {
            records = [
                cat.id === 'exit-orient'
                    ? { academicYear: '2569', date: '15/2/2570', title: 'ปัจฉิมนิเทศนักศึกษาชั้นปีสุดท้าย ประจำปีการศึกษา 2569', count: 1, hours: null, status: 'ผ่าน' }
                    : { academicYear: '2569', date: '20/1/2570', title: 'การทดสอบทักษะดิจิทัลสำหรับนักศึกษาชั้นปีสุดท้ายก่อนสำเร็จการศึกษา', count: 1, hours: null, status: 'ผ่าน' },
            ];
        } else if (!isGraduated && studentYear < cat.minYear && !cat.finalYearOnly && records.length === 0) {
            records = [];
        }

        const earnedCount = records
            .filter(r => r.status === 'ผ่าน')
            .reduce((sum, r) => sum + (Number(r.count) || 1), 0);
        const totalHours = records.reduce((sum, r) => sum + (Number(r.hours) || 0), 0);
        const passed = earnedCount >= cat.minRequired;

        return {
            ...cat,
            records,
            earnedCount,
            totalHours,
            passed,
            remaining: Math.max(0, cat.minRequired - earnedCount),
        };
    });
}

/**
 * Format date input string YYYY-MM-DD into D/M/YYYY Thai Buddhist era
 */
function formatToThaiDate(dateStr) {
    if (!dateStr) return '-';
    if (dateStr.includes('/')) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        const thaiYear = y < 2400 ? y + 543 : y;
        return `${d}/${m}/${thaiYear}`;
    }
    return dateStr;
}

/**
 * คำนวณรายการปีการศึกษาตามข้อมูลนักศึกษาของแอดมินในระบบ
 * กำหนดเริ่มต้นตั้งแต่ปี 2561 (ปี 61 ตามข้อมูลของแอดมิน) จนถึงปีล่าสุดที่มีนักศึกษาในระบบ
 * และเมื่อมีการเพิ่มนักศึกษาที่มีปีใหม่เข้ามา ตัวเลือกจะเพิ่มปีให้อัตโนมัติ
 */
export function getAvailableAcademicYears(currentStudent = null) {
    const minYear = 2561; // ตั้งแต่ปี 61 ตามข้อมูลของแอดมิน
    let maxYear = 2561;

    // 1. ดึงปีจากนักศึกษาทั้งหมดในระบบของแอดมิน (MOCK_STUDENTS_POOL)
    if (typeof MOCK_STUDENTS_POOL !== 'undefined' && Array.isArray(MOCK_STUDENTS_POOL)) {
        for (const s of MOCK_STUDENTS_POOL) {
            const sid = s?.studentId || s?.id;
            const y = admissionYearFromId(sid);
            if (y && y > maxYear) {
                maxYear = y;
            }
        }
    }

    // 2. ดึงปีจากนักศึกษาปัจจุบันที่กำลังเปิดดู
    if (currentStudent) {
        const curId = currentStudent.studentId || currentStudent.id;
        const curY = admissionYearFromId(curId);
        if (curY && curY > maxYear) {
            maxYear = curY;
        }
    }

    // 3. ตรวจสอบปีการศึกษาปัจจุบันตามปฏิทินมหาวิทยาลัย
    const currentBE = currentAcademicYearBE();
    if (currentBE > maxYear) {
        maxYear = currentBE;
    }

    // สร้างรายการปีการศึกษาตั้งแต่ปีล่าสุด (maxYear) ถอยหลังลงไปจนถึงปี 2561 (minYear)
    const years = [];
    for (let y = maxYear; y >= minYear; y--) {
        years.push(y);
    }
    return years;
}

/**
 * Main Render Function
 */
export async function renderActivity(student = null) {
    const container = document.getElementById('activityContent');
    if (!container) return;

    const studentId = student?.studentId || student?.id || '6621100042';
    _currentStudentId = studentId;
    const studentYear = Number(student?.year) || 4;

    // Show initial loading if first time fetching
    if (!_activityRecordsCache[studentId]) {
        container.innerHTML = `
            <div class="card" style="text-align:center;padding:48px;color:var(--text-muted)">
                <div style="font-size:1.8rem;margin-bottom:12px">⏳</div>
                <div style="font-weight:600">กำลังโหลดประวัติการเข้าร่วมกิจกรรมนักศึกษา...</div>
                <div style="font-size:0.8rem;margin-top:4px">เชื่อมต่อฐานข้อมูลสารสนเทศกิจกรรม มหาวิทยาลัยราชภัฏบ้านสมเด็จเจ้าพระยา</div>
            </div>`;
    }

    const activityMap = await loadStudentActivities(studentId);
    const categories = buildStudentActivityTranscript(student, activityMap);

    const totalCategories = categories.length;
    const passedCategories = categories.filter(c => c.passed).length;
    const failedCategories = totalCategories - passedCategories;
    const totalParticipations = categories.reduce((s, c) => s + c.earnedCount, 0);
    const totalMinRequired = categories.reduce((s, c) => s + c.minRequired, 0);
    const totalHours = categories.reduce((s, c) => s + c.totalHours, 0);
    const allPassed = failedCategories === 0;

    const groups = [...new Set(BSRU_ACTIVITY_CRITERIA.map(c => c.group))];

    const renderBody = () => {
        const q = _activitySearchQuery.toLowerCase();
        const filteredCats = categories.filter(cat => {
            if (_activityStatusFilter === 'PASSED' && !cat.passed) return false;
            if (_activityStatusFilter === 'FAILED' && cat.passed) return false;
            if (_activityGroupFilter !== 'ALL' && cat.group !== _activityGroupFilter) return false;
            if (!q) return true;
            return cat.name.toLowerCase().includes(q)
                || cat.group.toLowerCase().includes(q)
                || cat.records.some(r => r.title.toLowerCase().includes(q) || String(r.academicYear).includes(q));
        });

        const missingPills = categories
            .filter(c => !c.passed)
            .map(c => `<span class="badge badge-red" style="font-size:0.78rem;padding:5px 10px">❌ ${esc(c.name)} (${c.earnedCount}/${c.minRequired} — ขาดอีก ${c.remaining} ครั้ง)</span>`)
            .join(' ');

        const criteriaSummaryBanner = allPassed
            ? `<div class="card" style="margin-bottom:16px;border-left:4px solid var(--green-500)">
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                        <div>
                            <div style="font-weight:700;font-size:0.95rem">🎉 ผ่านเกณฑ์กิจกรรมนักศึกษาครบทุกประเภทแล้ว (${passedCategories}/${totalCategories} ประเภท)</div>
                            <div style="font-size:0.82rem;color:var(--text-muted);margin-top:2px">เข้าร่วมสะสมรวม ${totalParticipations} ครั้ง (เกณฑ์ขั้นต่ำรวม ${totalMinRequired} ครั้ง) • ชั่วโมงจิตสาธารณะ ${totalHours} ชม.</div>
                        </div>
                        <span class="badge badge-green">ผ่านเกณฑ์ครบถ้วน</span>
                    </div>
               </div>`
            : `<div class="card" style="margin-bottom:16px;border-left:4px solid #ef4444">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:8px">
                        <div>
                            <div style="font-weight:700;font-size:0.95rem">⚠️ ประเภทกิจกรรมที่ยังไม่ผ่านเกณฑ์ (${failedCategories} ประเภท จาก ${totalCategories} ประเภท)</div>
                            <div style="font-size:0.82rem;color:var(--text-muted);margin-top:2px">นักศึกษาต้องเข้าร่วมให้ครบทุกประเภทกิจกรรมตามเกณฑ์ขั้นต่ำของมหาวิทยาลัยและคณะก่อนสำเร็จการศึกษา</div>
                        </div>
                        <span class="badge badge-amber">รอเก็บให้ครบเกณฑ์</span>
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:6px">${missingPills}</div>
               </div>`;

        // Render Category Blocks
        const categoryBlocks = filteredCats.map(cat => {
            const isCollapsed = _collapsedCatIds.has(cat.id);
            const statusHtml = cat.passed
                ? '<span class="badge badge-green">ผ่าน</span>'
                : `<span class="badge badge-red">ไม่ผ่าน (ขาด ${cat.remaining})</span>`;

            const rowsHtml = cat.records.length > 0
                ? cat.records.map((rec, idx) => {
                    const isPassed = rec.status === 'ผ่าน';
                    const badgeClass = isPassed ? 'badge-green' : 'badge-amber';
                    const canDelete = rec.id != null || rec.isSelfRegistered;

                    return `
                    <tr>
                        <td style="text-align:center;width:52px;color:var(--text-muted)">${idx + 1}</td>
                        <td style="text-align:center;width:96px">${esc(rec.academicYear)}</td>
                        <td style="text-align:center;width:110px">${esc(rec.date || '-')}</td>
                        <td>
                            <strong>${esc(rec.title)}</strong>
                            ${rec.hours ? `<span style="display:inline-block;margin-left:6px;font-size:0.75rem;color:var(--brand-600);background:var(--brand-50, #eff6ff);padding:1px 6px;border-radius:4px">⏱️ ${rec.hours} ชม.</span>` : ''}
                        </td>
                        <td style="text-align:center;width:76px">${rec.count ?? 1}</td>
                        <td style="text-align:center;width:76px">${rec.hours != null ? rec.hours : '-'}</td>
                        <td style="text-align:center;width:140px">
                            <span class="badge ${badgeClass}" title="${esc(rec.status)}">${esc(rec.status)}</span>
                        </td>
                        <td style="text-align:center;width:60px">
                            ${canDelete ? `
                                <button type="button" class="btn btn-sm btn-ghost act-delete-btn" 
                                    data-act-id="${esc(rec.id || '')}" 
                                    data-cat-id="${esc(cat.id)}" 
                                    data-title="${esc(rec.title)}"
                                    title="ลบกิจกรรมนี้" 
                                    style="color:var(--red-500);padding:3px 8px;font-size:0.85rem">🗑️</button>
                            ` : `<span style="color:var(--text-muted);font-size:0.75rem">-</span>`}
                        </td>
                    </tr>`;
                }).join('')
                : `<tr>
                        <td colspan="8" style="text-align:center;padding:18px;color:var(--text-muted);font-size:0.84rem">
                            ยังไม่มีประวัติการเข้าร่วมในประเภทนี้ — เกณฑ์ขั้นต่ำต้องเข้าร่วมอย่างน้อย <strong>${cat.minRequired}</strong> ครั้ง
                        </td>
                   </tr>`;

            return `
                <div class="card" style="padding:0;overflow:hidden;margin-bottom:12px;border-left:4px solid ${cat.passed ? '#22c55e' : '#ef4444'}">
                    <div class="act-cat-header" data-cat-id="${esc(cat.id)}" style="padding:12px 18px;display:flex;justify-content:space-between;align-items:center;gap:10px;cursor:pointer;user-select:none;background:var(--bg-muted, rgba(148,163,184,0.08))">
                        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                            <span style="font-size:0.8rem;color:var(--text-muted);width:16px;display:inline-block">${isCollapsed ? '▶' : '▼'}</span>
                            <strong style="font-size:0.94rem">${esc(cat.name)} (${cat.earnedCount}/${cat.minRequired})</strong>
                            <span class="badge badge-blue" style="font-size:0.7rem">${esc(cat.group)}</span>
                            <span style="font-size:0.78rem;color:var(--text-muted)">เกณฑ์ขั้นต่ำ ${cat.minRequired} ครั้ง ${cat.minYear > 1 ? `(สำหรับปี ${cat.minYear}+)` : ''}</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
                            ${cat.totalHours > 0 ? `<span style="font-size:0.78rem;font-weight:600;color:var(--brand-600)">⏱️ สะสม ${cat.totalHours} ชม.</span>` : ''}
                            ${statusHtml}
                        </div>
                    </div>
                    ${isCollapsed ? '' : `
                    <div class="table-wrap" style="margin:0">
                        <table class="data-table" style="margin:0">
                            <thead>
                                <tr>
                                    <th style="text-align:center;width:52px">ลำดับ</th>
                                    <th style="text-align:center;width:96px">ปีการศึกษา</th>
                                    <th style="text-align:center;width:110px">วันที่</th>
                                    <th>ชื่อกิจกรรม</th>
                                    <th style="text-align:center;width:76px">จำนวน</th>
                                    <th style="text-align:center;width:76px">ชั่วโมง</th>
                                    <th style="text-align:center;width:140px">สถานะ</th>
                                    <th style="text-align:center;width:60px">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody>${rowsHtml}</tbody>
                        </table>
                    </div>`}
                </div>`;
        }).join('');

        // Build category dropdown options for registration form
        const categoryOptionsHtml = BSRU_ACTIVITY_CRITERIA.map(c => {
            const isEligible = studentYear >= c.minYear && (!c.finalYearOnly || studentYear >= 4);
            const badge = c.isPublicMind ? ' [⏱️ ต้องระบุชั่วโมง]' : '';
            const yearReq = c.minYear > 1 ? ` (ชั้นปีที่ ${c.minYear}+)` : '';
            return `<option value="${esc(c.id)}" data-group="${esc(c.group)}" data-minyear="${c.minYear}" data-final="${c.finalYearOnly ? '1' : '0'}" data-public="${c.isPublicMind ? '1' : '0'}" data-minreq="${c.minRequired}">
                ${esc(c.name)}${badge}${yearReq} — เกณฑ์ ${c.minRequired} ครั้ง (${esc(c.group)})
            </option>`;
        }).join('');

        // Build academic year dropdown options: from 2561 (ปี 61 ตามข้อมูลของแอดมิน) up to latest student year in system
        const availableYears = getAvailableAcademicYears(student);
        const admitYear = admissionYearFromId(studentId);
        const defaultSelectedYear = (admitYear && availableYears.includes(admitYear))
            ? admitYear
            : (availableYears.includes(currentAcademicYearBE()) ? currentAcademicYearBE() : availableYears[0]);

        const yearOptionsHtml = availableYears.map(y => {
            const isSelected = y === defaultSelectedYear;
            return `<option value="${y}" ${isSelected ? 'selected' : ''}>${y}</option>`;
        }).join('');

        // Render full container HTML
        container.innerHTML = `
            <!-- Top Summary Cards -->
            <div class="stat-row">
                <div class="stat-card">
                    <div class="stat-icon ${allPassed ? 'green' : 'purple'}">📋</div>
                    <div>
                        <div class="stat-value">${passedCategories} / ${totalCategories}</div>
                        <div class="stat-label">ประเภทกิจกรรมที่ผ่านเกณฑ์</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon ${failedCategories > 0 ? 'amber' : 'green'}">${failedCategories > 0 ? '⚠️' : '✅'}</div>
                    <div>
                        <div class="stat-value">${failedCategories}</div>
                        <div class="stat-label">ประเภทที่ยังไม่ผ่านเกณฑ์</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon blue">🏆</div>
                    <div>
                        <div class="stat-value">${totalParticipations}</div>
                        <div class="stat-label">ครั้งที่เข้าร่วม (เกณฑ์รวม ${totalMinRequired})</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon green">⏱️</div>
                    <div>
                        <div class="stat-value">${totalHours}</div>
                        <div class="stat-label">ชั่วโมงจิตสาธารณะสะสม</div>
                    </div>
                </div>
            </div>

            <!-- Criteria Status Banner -->
            ${criteriaSummaryBanner}

            <!-- Action Bar with Self-Registration Trigger -->
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;padding:12px 18px;background:var(--card-bg, #fff);border-radius:var(--radius-lg, 12px);border:1px solid var(--border-color, rgba(0,0,0,0.08));box-shadow:0 1px 3px rgba(0,0,0,0.03)">
                <div>
                    <h3 style="font-size:1.05rem;font-weight:700;color:var(--text-main);margin:0;display:flex;align-items:center;gap:8px">
                        <span>🎯</span> เกณฑ์และการเข้าร่วมกิจกรรมนักศึกษา มบส. (17 ประเภท)
                    </h3>
                    <div style="font-size:0.82rem;color:var(--text-muted);margin-top:3px">
                        ระบบบันทึกกิจกรรมสะสมสำหรับสำเร็จการศึกษา และเชื่อมโยงกับการวิเคราะห์คำถามของ AI Chatbot
                    </div>
                </div>
                <button type="button" class="btn btn-primary" id="actToggleRegFormBtn" style="display:flex;align-items:center;gap:8px;font-weight:600;padding:8px 16px">
                    <span>${_isFormOpen ? '✖️ ปิดแบบฟอร์ม' : '➕ ลงทะเบียนกิจกรรมด้วยตนเอง'}</span>
                </button>
            </div>

            <!-- Self-Registration Form Panel (Collapsible) -->
            <div class="app-form-panel" id="actRegFormPanel" style="display: ${_isFormOpen ? 'block' : 'none'}; margin-bottom: 20px;">
                <div class="app-form-header">
                    <div>
                        <div class="app-form-title">
                            <span style="font-size:1.2rem">📝</span>
                            <span>แบบฟอร์มลงทะเบียนเข้าร่วมกิจกรรมนักศึกษาด้วยตนเอง</span>
                        </div>
                        <div class="app-form-subtitle">
                            กรอกข้อมูลกิจกรรมตามหัวข้อที่กำหนด โดยระบบจะตรวจสอบเงื่อนไขเกณฑ์และส่งต่อให้ AI วิเคราะห์การจบการศึกษา
                        </div>
                    </div>
                    <button type="button" class="btn btn-sm btn-ghost" id="actCloseFormBtn" style="font-size:1.2rem;line-height:1;padding:4px 8px" title="ปิดฟอร์ม">✕</button>
                </div>

                <form id="actSelfRegForm" autocomplete="off">
                    <div class="app-form-grid" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px;">
                        
                        <!-- 1. หมวดหมู่ / หัวข้อกิจกรรม (17 ประเภท) -->
                        <div class="app-form-group" style="grid-column: 1 / -1;">
                            <label class="app-form-label" for="actRegCategory">
                                📂 หัวข้อ / หมวดหมู่กิจกรรมที่เกี่ยวข้อง <span class="req">*</span>
                            </label>
                            <select class="app-select" id="actRegCategory" required>
                                <option value="">-- กรุณาเลือกหัวข้อกิจกรรม (17 ประเภท) --</option>
                                ${categoryOptionsHtml}
                            </select>
                            <div id="actCategoryHintBox" style="font-size:0.8rem;padding:8px 12px;border-radius:6px;background:var(--bg-muted, #f1f5f9);display:none;align-items:center;gap:8px;margin-top:4px">
                            </div>
                        </div>

                        <!-- 2. ชื่อกิจกรรม -->
                        <div class="app-form-group" style="grid-column: 1 / -1;">
                            <label class="app-form-label" for="actRegTitle">
                                🏷️ ชื่อของกิจกรรม <span class="req">*</span>
                            </label>
                            <input type="text" class="app-input" id="actRegTitle" placeholder="เช่น บริจาคโลหิตช่วยเหลือชีวิต ครั้งที่ 28, Big Cleaning Day, อบรมทักษะดิจิทัล..." required>
                        </div>

                        <!-- 3. ปีที่ผ่านกิจกรรม -->
                        <div class="app-form-group">
                            <label class="app-form-label" for="actRegYear">
                                📅 ปีการศึกษาที่ผ่านกิจกรรม <span class="req">*</span>
                            </label>
                            <select class="app-select" id="actRegYear" required>
                                ${yearOptionsHtml}
                            </select>
                            <span style="font-size:0.75rem;color:var(--text-muted)">* ครอบคลุมตั้งแต่ปีการศึกษา 2561 จนถึงปีล่าสุดที่มีนักศึกษาในระบบ</span>
                        </div>

                        <!-- 4. วันที่เดือนปีเท่าไหร่ -->
                        <div class="app-form-group">
                            <label class="app-form-label" for="actRegDate">
                                🗓️ วันที่เข้าร่วมกิจกรรม (วัน/เดือน/ปี) <span class="req">*</span>
                            </label>
                            <input type="date" class="app-input" id="actRegDate" required>
                        </div>

                        <!-- 5. จำนวน -->
                        <div class="app-form-group">
                            <label class="app-form-label" for="actRegCount">
                                🔢 จำนวน (ครั้ง) <span class="req">*</span>
                            </label>
                            <input type="number" class="app-input" id="actRegCount" value="1" min="1" max="50" required>
                        </div>

                        <!-- 6. ส่วนชั่วโมง (พิเศษสำหรับเฉพาะหัวข้อจิตสาธารณะเท่านั้น) -->
                        <div class="app-form-group" id="actHoursGroup" style="display:none;">
                            <label class="app-form-label" for="actRegHours">
                                ⏱️ จำนวนชั่วโมงจิตสาธารณะ <span class="req">* (พิเศษเฉพาะหัวข้อจิตสาธารณะ)</span>
                            </label>
                            <input type="number" class="app-input" id="actRegHours" placeholder="เช่น 3 หรือ 6 ชม." min="1" max="100">
                            <span style="font-size:0.75rem;color:var(--text-muted)">* ระบุจำนวนชั่วโมงสะสม (อย่างน้อย 1 ชั่วโมง)</span>
                        </div>
                    </div>

                    <!-- Condition & Eligibility Notice Box -->
                    <div id="actEligibilityNotice" style="margin-top:14px;padding:12px 16px;border-radius:8px;font-size:0.85rem;display:none">
                    </div>

                    <div style="display:flex;justify-content:flex-end;align-items:center;gap:10px;margin-top:18px;padding-top:14px;border-top:1px solid var(--g-100)">
                        <button type="button" class="btn btn-ghost" id="actResetBtn">ล้างข้อมูล</button>
                        <button type="submit" class="btn btn-primary" id="actSubmitBtn" style="display:flex;align-items:center;gap:6px">
                            <span>💾</span> บันทึกกิจกรรม
                        </button>
                    </div>
                </form>
            </div>

            <!-- Filter & Search Bar -->
            <div class="batch-filter-bar" style="flex-wrap:wrap;gap:10px;margin-bottom:14px">
                <label>สถานะเกณฑ์</label>
                <select class="batch-select" id="actStatusFilter" aria-label="กรองตามสถานะ">
                    <option value="ALL" ${_activityStatusFilter === 'ALL' ? 'selected' : ''}>ทุกประเภท (${totalCategories})</option>
                    <option value="FAILED" ${_activityStatusFilter === 'FAILED' ? 'selected' : ''}>ยังไม่ผ่านเกณฑ์ (${failedCategories})</option>
                    <option value="PASSED" ${_activityStatusFilter === 'PASSED' ? 'selected' : ''}>ผ่านเกณฑ์แล้ว (${passedCategories})</option>
                </select>
                <label>กลุ่มกิจกรรม</label>
                <select class="batch-select" id="actGroupFilter" aria-label="กรองตามกลุ่มกิจกรรม">
                    <option value="ALL" ${_activityGroupFilter === 'ALL' ? 'selected' : ''}>ทุกกลุ่ม</option>
                    ${groups.map(g => `<option value="${esc(g)}" ${_activityGroupFilter === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}
                </select>
                <div class="toolbar-search" style="margin-left:auto">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" id="actSearchInput" aria-label="ค้นหากิจกรรม" placeholder="ค้นหาประเภทกิจกรรม หรือชื่อกิจกรรม..." value="${esc(_activitySearchQuery)}">
                </div>
                <button type="button" class="btn btn-sm btn-ghost" id="actToggleCollapseAll">
                    ${_collapsedCatIds.size === categories.length ? '▼ ขยายทั้งหมด' : '▲ ย่อทั้งหมด'}
                </button>
            </div>

            <!-- Transcript List -->
            <div id="actTranscriptList">
                ${categoryBlocks || '<div class="card" style="text-align:center;padding:36px;color:var(--text-muted)">ไม่พบหมวดกิจกรรมตามเงื่อนไขที่เลือก</div>'}
            </div>
        `;

        // ── Event Handlers ──

        // Toggle Form
        container.querySelector('#actToggleRegFormBtn')?.addEventListener('click', () => {
            _isFormOpen = !_isFormOpen;
            const panel = container.querySelector('#actRegFormPanel');
            const btn = container.querySelector('#actToggleRegFormBtn span');
            if (panel) {
                panel.style.display = _isFormOpen ? 'block' : 'none';
                if (_isFormOpen) {
                    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    // Set default date to today
                    const dateInput = panel.querySelector('#actRegDate');
                    if (dateInput && !dateInput.value) {
                        dateInput.value = new Date().toISOString().split('T')[0];
                    }
                }
            }
            if (btn) {
                btn.textContent = _isFormOpen ? '✖️ ปิดแบบฟอร์ม' : '➕ ลงทะเบียนกิจกรรมด้วยตนเอง';
            }
        });

        // Close Form
        container.querySelector('#actCloseFormBtn')?.addEventListener('click', () => {
            _isFormOpen = false;
            const panel = container.querySelector('#actRegFormPanel');
            const btn = container.querySelector('#actToggleRegFormBtn span');
            if (panel) panel.style.display = 'none';
            if (btn) btn.textContent = '➕ ลงทะเบียนกิจกรรมด้วยตนเอง';
        });

        // Reset Form
        container.querySelector('#actResetBtn')?.addEventListener('click', () => {
            const form = container.querySelector('#actSelfRegForm');
            if (form) form.reset();
            const hoursGroup = container.querySelector('#actHoursGroup');
            if (hoursGroup) hoursGroup.style.display = 'none';
            const hint = container.querySelector('#actCategoryHintBox');
            if (hint) hint.style.display = 'none';
            const notice = container.querySelector('#actEligibilityNotice');
            if (notice) notice.style.display = 'none';
        });

        // Auto-select academic year based on selected date
        const dateInputEl = container.querySelector('#actRegDate');
        const yearSelectEl = container.querySelector('#actRegYear');
        dateInputEl?.addEventListener('change', () => {
            if (dateInputEl.value && yearSelectEl) {
                const parts = dateInputEl.value.split('-');
                if (parts.length === 3) {
                    const y = parseInt(parts[0], 10);
                    const m = parseInt(parts[1], 10); // 1-12
                    // In Thai universities (BSRU): academic year starts in June.
                    // Month < 6 (Jan-May) belongs to the previous academic year.
                    const acadYear = (y + 543) - (m < 6 ? 1 : 0);
                    let found = Array.from(yearSelectEl.options).find(o => o.value === String(acadYear));
                    if (!found) {
                        const opt = document.createElement('option');
                        opt.value = String(acadYear);
                        opt.textContent = String(acadYear);
                        const nextOpt = Array.from(yearSelectEl.options).find(o => parseInt(o.value, 10) < acadYear);
                        if (nextOpt) {
                            yearSelectEl.insertBefore(opt, nextOpt);
                        } else {
                            yearSelectEl.appendChild(opt);
                        }
                    }
                    yearSelectEl.value = String(acadYear);
                }
            }
        });

        // Category Selection Change
        const categorySelect = container.querySelector('#actRegCategory');
        const hoursGroup = container.querySelector('#actHoursGroup');
        const hoursInput = container.querySelector('#actRegHours');
        const hintBox = container.querySelector('#actCategoryHintBox');
        const noticeBox = container.querySelector('#actEligibilityNotice');

        const updateCategoryState = () => {
            if (!categorySelect) return;
            const selectedVal = categorySelect.value;
            const selectedOpt = categorySelect.selectedOptions[0];

            if (!selectedVal || !selectedOpt) {
                if (hoursGroup) hoursGroup.style.display = 'none';
                if (hoursInput) { hoursInput.required = false; hoursInput.value = ''; }
                if (hintBox) hintBox.style.display = 'none';
                if (noticeBox) noticeBox.style.display = 'none';
                return;
            }

            const isPublic = selectedOpt.dataset.public === '1' || selectedVal === 'public-mind';
            const minYear = parseInt(selectedOpt.dataset.minyear, 10) || 1;
            const isFinalOnly = selectedOpt.dataset.final === '1';
            const minReq = selectedOpt.dataset.minreq || '1';
            const groupName = selectedOpt.dataset.group || '';

            // Hours field: only visible and required for public mind
            if (isPublic) {
                if (hoursGroup) hoursGroup.style.display = 'flex';
                if (hoursInput) {
                    hoursInput.required = true;
                    if (!hoursInput.value) hoursInput.value = '3';
                }
            } else {
                if (hoursGroup) hoursGroup.style.display = 'none';
                if (hoursInput) {
                    hoursInput.required = false;
                    hoursInput.value = '';
                }
            }

            // Hint box
            if (hintBox) {
                hintBox.style.display = 'flex';
                hintBox.innerHTML = `
                    <span>📌</span>
                    <span><strong>กลุ่ม:</strong> ${esc(groupName)} • <strong>เกณฑ์ขั้นต่ำ:</strong> ${minReq} ครั้ง ${isPublic ? '• <strong>ต้องระบุชั่วโมงจิตสาธารณะ</strong>' : ''} ${minYear > 1 ? `• <strong>กำหนดชั้นปี:</strong> ปีที่ ${minYear} ขึ้นไป` : ''}</span>
                `;
            }

            // Eligibility Condition Notice
            if (noticeBox) {
                noticeBox.style.display = 'block';
                const meetsMinYear = studentYear >= minYear;
                const meetsFinalYear = !isFinalOnly || studentYear >= 4 || student?.status === 'จบการศึกษา';

                if (!meetsMinYear) {
                    noticeBox.style.background = '#fffbeb';
                    noticeBox.style.borderLeft = '4px solid #f59e0b';
                    noticeBox.style.color = '#92400e';
                    noticeBox.innerHTML = `
                        <div style="font-weight:700;margin-bottom:2px">⚠️ เงื่อนไขชั้นปียังไม่ตรงเกณฑ์</div>
                        <div>หมวดนี้กำหนดสำหรับนักศึกษาชั้นปีที่ <strong>${minYear}</strong> ขึ้นไป (ปัจจุบันคุณอยู่ชั้นปีที่ <strong>${studentYear}</strong>) เมื่อบันทึกแล้วระบบจะให้สถานะ <strong>"รอตรวจสอบ (เงื่อนไข: ต้องเป็นนักศึกษาชั้นปีที่ ${minYear} ขึ้นไป)"</strong> และยังไม่นับผลการผ่านเกณฑ์</div>
                    `;
                } else if (!meetsFinalYear) {
                    noticeBox.style.background = '#fffbeb';
                    noticeBox.style.borderLeft = '4px solid #f59e0b';
                    noticeBox.style.color = '#92400e';
                    noticeBox.innerHTML = `
                        <div style="font-weight:700;margin-bottom:2px">⚠️ สำหรับนักศึกษาชั้นปีสุดท้ายเท่านั้น</div>
                        <div>หมวดนี้สำหรับนักศึกษาชั้นปีที่ 4 หรือชั้นปีสุดท้าย เมื่อบันทึกแล้วระบบจะให้สถานะ <strong>"รอตรวจสอบ"</strong></div>
                    `;
                } else {
                    noticeBox.style.background = '#f0fdf4';
                    noticeBox.style.borderLeft = '4px solid #22c55e';
                    noticeBox.style.color = '#166534';
                    noticeBox.innerHTML = `
                        <div style="font-weight:700;margin-bottom:2px">✅ ตรงตามเงื่อนไขทุกประการ</div>
                        <div>คุณสมบัติของคุณตรงตามเกณฑ์ของหมวดนี้ เมื่อบันทึกแล้วระบบจะแสดงสถานะ <strong>"ผ่าน"</strong> และสะสมผลการผ่านเกณฑ์ทันที</div>
                    `;
                }
            }
        };

        categorySelect?.addEventListener('change', updateCategoryState);

        // Form Submit Handler
        const selfRegForm = container.querySelector('#actSelfRegForm');
        selfRegForm?.addEventListener('submit', async (e) => {
            e.preventDefault();

            const catId = categorySelect?.value;
            const title = container.querySelector('#actRegTitle')?.value?.trim();
            const academicYear = container.querySelector('#actRegYear')?.value?.trim();
            const dateVal = container.querySelector('#actRegDate')?.value;
            const count = parseInt(container.querySelector('#actRegCount')?.value, 10) || 1;
            const hoursVal = container.querySelector('#actRegHours')?.value;
            const isPublic = catId === 'public-mind';
            const hours = isPublic ? (parseInt(hoursVal, 10) || null) : null;

            if (!catId) {
                showToast('กรุณาเลือกหัวข้อ/หมวดหมู่กิจกรรม', 'warning');
                categorySelect?.focus();
                return;
            }

            if (!title) {
                showToast('กรุณากรอกชื่อกิจกรรม', 'warning');
                container.querySelector('#actRegTitle')?.focus();
                return;
            }

            if (isPublic && (!hours || hours <= 0)) {
                showToast('กิจกรรมหมวดจิตสาธารณะ ต้องระบุจำนวนชั่วโมงสะสมอย่างน้อย 1 ชั่วโมง', 'warning');
                container.querySelector('#actRegHours')?.focus();
                return;
            }

            const formattedDate = formatToThaiDate(dateVal);
            const submitBtn = container.querySelector('#actSubmitBtn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span>⏳</span> กำลังบันทึก...';
            }

            const payload = {
                activityCategoryId: catId,
                title,
                academicYear,
                activityDate: formattedDate,
                count,
                hours,
            };

            let savedItem = null;
            let successStatus = 'ผ่าน';

            try {
                // Call Spring Boot REST API
                const res = await fetchAPI(`/students/${studentId}/activities`, 'POST', payload);
                if (res && res.id) {
                    savedItem = res;
                    successStatus = res.status || 'ผ่าน';
                }
            } catch (err) {
                console.warn('[ActivityView] API save failed, creating local fallback record:', err.message);
                // Offline fallback evaluation
                const catDef = BSRU_ACTIVITY_CRITERIA.find(c => c.id === catId);
                const meetsMinYear = catDef ? studentYear >= catDef.minYear : true;
                const meetsFinalYear = !catDef?.finalYearOnly || studentYear >= 4 || student?.status === 'จบการศึกษา';
                if (!meetsMinYear) {
                    successStatus = `รอตรวจสอบ (เงื่อนไข: ต้องเป็นนักศึกษาชั้นปีที่ ${catDef.minYear} ขึ้นไป)`;
                } else if (!meetsFinalYear) {
                    successStatus = 'รอตรวจสอบ (เงื่อนไข: สำหรับนักศึกษาชั้นปีสุดท้ายเท่านั้น)';
                } else {
                    successStatus = 'ผ่าน';
                }

                savedItem = {
                    id: Date.now(),
                    studentId,
                    activityCategoryId: catId,
                    categoryName: catDef?.name || catId,
                    categoryGroup: catDef?.group || 'กิจกรรม',
                    title,
                    academicYear,
                    activityDate: formattedDate,
                    count,
                    hours,
                    status: successStatus,
                    isSelfRegistered: true,
                };
            }

            // Update cache
            if (!_activityRecordsCache[studentId]) {
                _activityRecordsCache[studentId] = {};
            }
            if (!_activityRecordsCache[studentId][catId]) {
                _activityRecordsCache[studentId][catId] = [];
            }
            _activityRecordsCache[studentId][catId].unshift({
                id: savedItem.id,
                academicYear: savedItem.academicYear,
                date: savedItem.activityDate || formattedDate,
                title: savedItem.title,
                count: savedItem.count || count,
                hours: savedItem.hours,
                status: savedItem.status || successStatus,
                isSelfRegistered: true,
            });

            saveLocalFallback(studentId, _activityRecordsCache[studentId]);

            // Notify user
            if (successStatus === 'ผ่าน') {
                showToast(`🎉 บันทึกกิจกรรม "${title}" สำเร็จ (สถานะ: ผ่าน)`, 'success');
            } else {
                showToast(`📝 บันทึกกิจกรรม "${title}" สำเร็จ (${successStatus})`, 'warning');
            }

            // Dispatch global event so AI and other views know
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('bsru:activity-updated', { detail: { studentId, activity: savedItem } }));
            }

            // Keep form closed and re-render
            _isFormOpen = false;
            renderActivity(student);
        });

        // Delete Activity Handler
        container.querySelectorAll('.act-delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const actId = btn.dataset.actId;
                const catId = btn.dataset.catId;
                const title = btn.dataset.title || 'กิจกรรมนี้';

                if (!confirm(`คุณต้องการลบกิจกรรม "${title}" หรือไม่?`)) {
                    return;
                }

                try {
                    if (actId && !isNaN(Number(actId))) {
                        await fetchAPI(`/students/${studentId}/activities/${actId}`, 'DELETE');
                    }
                } catch (err) {
                    console.warn('[ActivityView] API delete failed, deleting from local cache:', err.message);
                }

                // Delete from cache
                if (_activityRecordsCache[studentId] && _activityRecordsCache[studentId][catId]) {
                    _activityRecordsCache[studentId][catId] = _activityRecordsCache[studentId][catId].filter(r => {
                        if (actId && r.id != null) return String(r.id) !== String(actId);
                        return r.title !== title;
                    });
                    saveLocalFallback(studentId, _activityRecordsCache[studentId]);
                }

                showToast(`ลบกิจกรรม "${title}" เรียบร้อยแล้ว`, 'info');

                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('bsru:activity-updated', { detail: { studentId } }));
                }

                renderActivity(student);
            });
        });

        // Filter Handlers
        container.querySelector('#actStatusFilter')?.addEventListener('change', (e) => {
            _activityStatusFilter = e.target.value;
            renderBody();
        });

        container.querySelector('#actGroupFilter')?.addEventListener('change', (e) => {
            _activityGroupFilter = e.target.value;
            renderBody();
        });

        const searchEl = container.querySelector('#actSearchInput');
        if (searchEl) {
            searchEl.addEventListener('input', (e) => {
                const pos = e.target.selectionStart;
                _activitySearchQuery = e.target.value;
                renderBody();
                const nextEl = container.querySelector('#actSearchInput');
                if (nextEl) {
                    nextEl.focus();
                    nextEl.setSelectionRange(pos, pos);
                }
            });
        }

        container.querySelector('#actToggleCollapseAll')?.addEventListener('click', () => {
            if (_collapsedCatIds.size === categories.length) {
                _collapsedCatIds.clear();
            } else {
                categories.forEach(c => _collapsedCatIds.add(c.id));
            }
            renderBody();
        });

        container.querySelectorAll('.act-cat-header').forEach(hdr => {
            hdr.addEventListener('click', () => {
                const cid = hdr.dataset.catId;
                if (_collapsedCatIds.has(cid)) _collapsedCatIds.delete(cid);
                else _collapsedCatIds.add(cid);
                renderBody();
            });
        });
    };

    renderBody();
}
