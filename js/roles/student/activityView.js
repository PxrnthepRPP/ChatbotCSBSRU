/* ============================================================
   BSRU Student Portal — Student Activity Check & Real BSRU Criteria
   ============================================================
   Implements the 17 official BSRU student activity categories,
   minimum required participation counts, and activity transcript
   table ("ประวัติการเข้าร่วมกิจกรรม").
   ============================================================ */

import { esc } from '../../utils.js';

/**
 * เกณฑ์ประเภทกิจกรรมนักศึกษาจริง มหาวิทยาลัยราชภัฏบ้านสมเด็จเจ้าพระยา (17 ประเภท)
 * minRequired = จำนวนครั้งขั้นต่ำที่ต้องเข้าร่วมจึงจะถือว่า "ผ่าน" ในหมวดนั้น
 */
export const BSRU_ACTIVITY_CRITERIA = [
    { id: 'uni-orient', name: 'ปฐมนิเทศรวม', group: 'มหาวิทยาลัย', minRequired: 1, minYear: 1 },
    { id: 'piralai', name: 'วันพิราลัย', group: 'มหาวิทยาลัย', minRequired: 1, minYear: 1 },
    { id: 'rajabhat-day', name: 'วันสถาปนา ราชภัฏ', group: 'มหาวิทยาลัย', minRequired: 1, minYear: 1 },
    { id: 'public-mind', name: 'จิตสาธารณะ', group: 'จิตสาธารณะ/ชมรม', minRequired: 2, minYear: 1 },
    { id: 'club', name: 'ชมรม/ชุมนุม', group: 'จิตสาธารณะ/ชมรม', minRequired: 3, minYear: 1 },
    { id: 'uni-elective', name: 'กิจกรรมเลือก (มหาวิทยาลัย)', group: 'มหาวิทยาลัย', minRequired: 10, minYear: 1 },
    { id: 'life-skill-y2', name: 'อบรมทักษะชีวิต ชั้นปี 2', group: 'ทักษะชีวิตและคุณธรรม', minRequired: 1, minYear: 2 },
    { id: 'ethics', name: 'อบรมคุณธรรมจริยธรรม', group: 'ทักษะชีวิตและคุณธรรม', minRequired: 1, minYear: 1 },
    { id: 'life-skill-y3', name: 'อบรมทักษะชีวิต ชั้นปี 3', group: 'ทักษะชีวิตและคุณธรรม', minRequired: 1, minYear: 3 },
    { id: 'digital-work', name: 'พัฒนาทักษะดิจิทัลเพื่อรองรับการทำงาน', group: 'ทักษะดิจิทัล', minRequired: 1, minYear: 3 },
    { id: 'fac-mandatory', name: 'กิจกรรมบังคับ (คณะ)', group: 'คณะ', minRequired: 5, minYear: 1 },
    { id: 'fac-orient', name: 'ปฐมนิเทศคณะ', group: 'คณะ', minRequired: 1, minYear: 1 },
    { id: 'thonburi-study', name: 'ศึกษาแหล่งเรียนรู้กรุงธนบุรีศึกษา', group: 'มหาวิทยาลัย', minRequired: 1, minYear: 1 },
    { id: 'exit-orient', name: 'ปัจฉิมนิเทศ', group: 'ปัจฉิม/ชั้นปีสุดท้าย', minRequired: 1, minYear: 4, finalYearOnly: true },
    { id: 'digital-new', name: 'ทักษะดิจิทัลสำหรับนักศึกษาใหม่', group: 'ทักษะดิจิทัล', minRequired: 1, minYear: 1 },
    { id: 'digital-final', name: 'ทักษะดิจิทัลสำหรับนักศึกษาชั้นปีสุดท้าย', group: 'ทักษะดิจิทัล', minRequired: 1, minYear: 4, finalYearOnly: true },
    { id: 'fac-elective', name: 'กิจกรรมเลือก (คณะ)', group: 'คณะ', minRequired: 5, minYear: 1 },
];

/**
 * รายการประวัติการเข้าร่วมกิจกรรมตามรูปแบบจริงของระบบกิจกรรมนักศึกษา มบส.
 */
const BASE_ACTIVITY_RECORDS = {
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

function buildStudentActivityTranscript(student) {
    const isGraduated = student && student.status === 'จบการศึกษา';
    const studentYear = Number(student?.year) || 4;

    return BSRU_ACTIVITY_CRITERIA.map(cat => {
        let records = [...(BASE_ACTIVITY_RECORDS[cat.id] || [])];

        if (isGraduated && cat.finalYearOnly && records.length === 0) {
            records = [
                cat.id === 'exit-orient'
                    ? { academicYear: '2569', date: '15/2/2570', title: 'ปัจฉิมนิเทศนักศึกษาชั้นปีสุดท้าย ประจำปีการศึกษา 2569', count: 1, hours: null, status: 'ผ่าน' }
                    : { academicYear: '2569', date: '20/1/2570', title: 'การทดสอบทักษะดิจิทัลสำหรับนักศึกษาชั้นปีสุดท้ายก่อนสำเร็จการศึกษา', count: 1, hours: null, status: 'ผ่าน' },
            ];
        } else if (!isGraduated && studentYear < cat.minYear && !cat.finalYearOnly) {
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

let _activityStatusFilter = 'ALL';
let _activityGroupFilter = 'ALL';
let _activitySearchQuery = '';
let _collapsedCatIds = new Set();

export function renderActivity(student = null) {
    const container = document.getElementById('activityContent');
    if (!container) return;

    const categories = buildStudentActivityTranscript(student);
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
                            <div style="font-size:0.82rem;color:var(--text-muted);margin-top:2px">เข้าร่วมสะสมรวม ${totalParticipations} ครั้ง (เกณฑ์ขั้นต่ำรวม ${totalMinRequired} ครั้ง)</div>
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

        const categoryBlocks = filteredCats.map(cat => {
            const isCollapsed = _collapsedCatIds.has(cat.id);
            const statusHtml = cat.passed
                ? '<span class="badge badge-green">ผ่าน</span>'
                : `<span class="badge badge-red">ไม่ผ่าน (ขาด ${cat.remaining})</span>`;

            const rowsHtml = cat.records.length > 0
                ? cat.records.map((rec, idx) => `
                    <tr>
                        <td style="text-align:center;width:56px;color:var(--text-muted)">${idx + 1}</td>
                        <td style="text-align:center;width:96px">${esc(rec.academicYear)}</td>
                        <td style="text-align:center;width:110px">${esc(rec.date || '-')}</td>
                        <td>${esc(rec.title)}</td>
                        <td style="text-align:center;width:76px">${rec.count ?? 1}</td>
                        <td style="text-align:center;width:76px">${rec.hours != null ? rec.hours : '-'}</td>
                        <td style="text-align:center;width:96px"><span class="badge ${rec.status === 'ผ่าน' ? 'badge-green' : 'badge-amber'}">${esc(rec.status)}</span></td>
                    </tr>`).join('')
                : `<tr>
                        <td colspan="7" style="text-align:center;padding:18px;color:var(--text-muted);font-size:0.84rem">
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
                            <span style="font-size:0.78rem;color:var(--text-muted)">เกณฑ์ขั้นต่ำ ${cat.minRequired} ครั้ง</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
                            ${cat.totalHours > 0 ? `<span style="font-size:0.78rem;color:var(--text-muted)">⏱️ ${cat.totalHours} ชม.</span>` : ''}
                            ${statusHtml}
                        </div>
                    </div>
                    ${isCollapsed ? '' : `
                    <div class="table-wrap" style="margin:0">
                        <table class="data-table" style="margin:0">
                            <thead>
                                <tr>
                                    <th style="text-align:center;width:56px">ลำดับ</th>
                                    <th style="text-align:center;width:96px">ปีการศึกษา</th>
                                    <th style="text-align:center;width:110px">วันที่</th>
                                    <th>กิจกรรม</th>
                                    <th style="text-align:center;width:76px">จำนวน</th>
                                    <th style="text-align:center;width:76px">ชั่วโมง</th>
                                    <th style="text-align:center;width:96px">สถานะ</th>
                                </tr>
                            </thead>
                            <tbody>${rowsHtml}</tbody>
                        </table>
                    </div>`}
                </div>`;
        }).join('');

        container.innerHTML = `
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

            ${criteriaSummaryBanner}

            <div class="batch-filter-bar" style="flex-wrap:wrap;gap:10px;margin-bottom:14px">
                <label>สถานะเกณฑ์</label>
                <select class="batch-select" id="actStatusFilter" aria-label="à¸à¸£à¸­à¸à¸à¸²à¸¡à¸ªà¸à¸²à¸à¸°">
                    <option value="ALL" ${_activityStatusFilter === 'ALL' ? 'selected' : ''}>ทุกประเภท (${totalCategories})</option>
                    <option value="FAILED" ${_activityStatusFilter === 'FAILED' ? 'selected' : ''}>ยังไม่ผ่านเกณฑ์ (${failedCategories})</option>
                    <option value="PASSED" ${_activityStatusFilter === 'PASSED' ? 'selected' : ''}>ผ่านเกณฑ์แล้ว (${passedCategories})</option>
                </select>
                <label>กลุ่มกิจกรรม</label>
                <select class="batch-select" id="actGroupFilter" aria-label="à¸à¸£à¸­à¸à¸à¸²à¸¡à¸à¸¥à¸¸à¹à¸¡à¸à¸´à¸à¸à¸£à¸£à¸¡">
                    <option value="ALL" ${_activityGroupFilter === 'ALL' ? 'selected' : ''}>ทุกกลุ่ม</option>
                    ${groups.map(g => `<option value="${esc(g)}" ${_activityGroupFilter === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}
                </select>
                <div class="toolbar-search" style="margin-left:auto">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" id="actSearchInput" aria-label="à¸à¹à¸à¸«à¸²à¸à¸´à¸à¸à¸£à¸£à¸¡" placeholder="ค้นหาประเภทกิจกรรม หรือชื่อกิจกรรม..." value="${esc(_activitySearchQuery)}">
                </div>
                <button type="button" class="btn btn-sm btn-ghost" id="actToggleCollapseAll">
                    ${_collapsedCatIds.size === categories.length ? '▼ ขยายทั้งหมด' : '▲ ย่อทั้งหมด'}
                </button>
            </div>

            <div id="actTranscriptList">
                ${categoryBlocks || '<div class="card" style="text-align:center;padding:36px;color:var(--text-muted)">ไม่พบหมวดกิจกรรมตามเงื่อนไขที่เลือก</div>'}
            </div>
        `;

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

