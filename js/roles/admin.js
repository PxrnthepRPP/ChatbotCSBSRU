import { esc, statusBadge, getBatch, debounce, showToast } from '../utils.js';
import { impersonateStudent } from '../auth.js';
import { fetchAPI } from '../api.js';
import { loadComponentCSS } from '../css-loader.js';
import { renderStatusDonutChart } from '../components/statusChart.js';
import { renderCareerDataList } from '../components/careerList.js';
import { STANDARD_CAREERS, EMPLOYMENT_STATUSES, SALARY_RANGES } from '../components/careerCatalog.js';
import { renderGpaTrendChart, renderStatusStackedBar, renderCareerShiftMatrix } from '../components/yearTrendCharts.js';

export const MOCK_ADVISORS = [
    { id: 'ADV001', nameTh: 'ผศ.ดร.วิชัย เทคโนโลยี', nameEn: 'Asst.Prof.Dr. Wichai Technology', email: 'wichai.t@bsru.ac.th', phone: '02-473-7000 ต่อ 4001', department: 'วิทยาการคอมพิวเตอร์', studentsCount: 12 },
    { id: 'ADV002', nameTh: 'อ.สุภา โปรแกรม', nameEn: 'Supa Program', email: 'supa.p@bsru.ac.th', phone: '02-473-7000 ต่อ 4002', department: 'วิทยาการคอมพิวเตอร์', studentsCount: 10 },
    { id: 'ADV003', nameTh: 'ผศ.มานะ ดาต้า', nameEn: 'Asst.Prof. Mana Data', email: 'mana.d@bsru.ac.th', phone: '02-473-7000 ต่อ 4003', department: 'วิทยาการคอมพิวเตอร์', studentsCount: 8 },
    { id: 'ADV004', nameTh: 'ผศ.ดร.ณัฐ เน็ตเวิร์ค', nameEn: 'Asst.Prof.Dr. Nat Network', email: 'nat.n@bsru.ac.th', phone: '02-473-7000 ต่อ 4004', department: 'วิทยาการคอมพิวเตอร์', studentsCount: 11 },
    { id: 'ADV005', nameTh: 'อ.พิมพ์ เว็บเทค', nameEn: 'Pim Webtech', email: 'pim.w@bsru.ac.th', phone: '02-473-7000 ต่อ 4005', department: 'เทคโนโลยีสารสนเทศ', studentsCount: 9 },
];

export const MOCK_STUDENTS_POOL = [
    { studentId: '6421100042', nameTh: 'สมชาย ใจดี', nameEn: 'Somchai Jaidee', year: 3, gpa: 3.42, status: 'กำลังศึกษา', advisor: 'ADV001' },
    { studentId: '6421100015', nameTh: 'สมหญิง รักเรียน', nameEn: 'Somying Rakrian', year: 3, gpa: 3.78, status: 'กำลังศึกษา', advisor: 'ADV001' },
    { studentId: '6421100023', nameTh: 'วิชัย โปรแกรมเมอร์', nameEn: 'Wichai Programmer', year: 3, gpa: 3.15, status: 'กำลังศึกษา', advisor: 'ADV001' },
    { studentId: '6421100031', nameTh: 'พิมพ์ใจ คอมพิวเตอร์', nameEn: 'Pimjai Computer', year: 3, gpa: 3.88, status: 'กำลังศึกษา', advisor: 'ADV001' },
    { studentId: '6421100058', nameTh: 'อนันต์ ดิจิทัล', nameEn: 'Anan Digital', year: 3, gpa: 2.95, status: 'กำลังศึกษา', advisor: 'ADV001' },
    { studentId: '6421100066', nameTh: 'กานต์ เน็ตเวิร์ค', nameEn: 'Kan Network', year: 3, gpa: 3.55, status: 'กำลังศึกษา', advisor: 'ADV001' },
    { studentId: '6521100010', nameTh: 'ธนา อัลกอริทึม', nameEn: 'Thana Algorithm', year: 2, gpa: 3.20, status: 'กำลังศึกษา', advisor: 'ADV001' },
    { studentId: '6521100028', nameTh: 'ปริญญา ซอฟต์แวร์', nameEn: 'Prinya Software', year: 2, gpa: 3.65, status: 'กำลังศึกษา', advisor: 'ADV001' },
    { studentId: '6521100036', nameTh: 'มานี ฐานข้อมูล', nameEn: 'Manee Database', year: 2, gpa: 2.80, status: 'พักการศึกษา', advisor: 'ADV001' },
    { studentId: '6521100044', nameTh: 'จิตรา เอไอ', nameEn: 'Jittra AI', year: 2, gpa: 3.90, status: 'กำลังศึกษา', advisor: 'ADV004' },
    { studentId: '6521100052', nameTh: 'นภา ไซเบอร์', nameEn: 'Napa Cyber', year: 2, gpa: 3.35, status: 'กำลังศึกษา', advisor: 'ADV001' },
    { studentId: '6521100060', nameTh: 'ศักดิ์ ลินุกซ์', nameEn: 'Sak Linux', year: 2, gpa: 3.10, status: 'กำลังศึกษา', advisor: 'ADV001' },
    { studentId: '6621100001', nameTh: 'ภัทร คลาวด์', nameEn: 'Phat Cloud', year: 1, gpa: 3.60, status: 'กำลังศึกษา', advisor: 'ADV001' },
    { studentId: '6621100009', nameTh: 'กมล แมชชีนเลิร์น', nameEn: 'Kamol MachinLearn', year: 1, gpa: 3.45, status: 'กำลังศึกษา', advisor: 'ADV001' },
    { studentId: '6621100017', nameTh: 'ดวงใจ ฟูลสแตค', nameEn: 'Duangjai Fullstack', year: 1, gpa: 3.80, status: 'กำลังศึกษา', advisor: 'ADV001' },
    { studentId: '6621100025', nameTh: 'อรรถ บล็อกเชน', nameEn: 'Att Blockchain', year: 1, gpa: 2.90, status: 'กำลังศึกษา', advisor: 'ADV001' },
    { studentId: '6621100033', nameTh: 'ปิยะ ดีพเลิร์น', nameEn: 'Piya DeepLearn', year: 1, gpa: 3.25, status: 'กำลังศึกษา', advisor: 'ADV002' },
    { studentId: '6321100005', nameTh: 'ประสิทธิ์ คอมไพล์', nameEn: 'Prasit Compile', year: 4, gpa: 3.50, status: 'จบการศึกษา', advisor: 'ADV002', careerPath: 'Full-Stack Developer' },
    { studentId: '6321100013', nameTh: 'สุรีย์ ดีบัก', nameEn: 'Suree Debug', year: 4, gpa: 3.72, status: 'จบการศึกษา', advisor: 'ADV003', careerPath: 'Data Analyst' },
    { studentId: '6321100021', nameTh: 'วรวุฒิ เซิร์ฟเวอร์', nameEn: 'Worawut Server', year: 4, gpa: 3.30, status: 'จบการศึกษา', advisor: 'ADV004', careerPath: 'DevOps Engineer' },
    { studentId: '6221100008', nameTh: 'พิชญา แอปพลิเคชั่น', nameEn: 'Pitchaya Application', year: 5, gpa: 3.15, status: 'จบการศึกษา', advisor: 'ADV001', careerPath: 'Full-Stack Developer' },
    { studentId: '6221100016', nameTh: 'ธนากร เทสต์เคส', nameEn: 'Thanakorn Testcase', year: 5, gpa: 2.95, status: 'จบการศึกษา', advisor: 'ADV002', careerPath: 'Full-Stack Developer' },
    { studentId: '6221100024', nameTh: 'รัตนา อินเทอร์เฟส', nameEn: 'Rattana Interface', year: 5, gpa: 3.60, status: 'จบการศึกษา', advisor: 'ADV003', careerPath: 'UX/UI Designer' },
    { studentId: '6221100032', nameTh: 'สมพงษ์ เซคิวริตี้', nameEn: 'Sompong Security', year: 5, gpa: 3.40, status: 'จบการศึกษา', advisor: 'ADV004', careerPath: 'Cybersecurity Analyst' },
    { studentId: '6221100040', nameTh: 'กิติพงษ์ สตาร์ทอัพ', nameEn: 'Kitipong Startup', year: 5, gpa: 3.05, status: 'จบการศึกษา', advisor: 'ADV005', careerPath: 'เจ้าของธุรกิจ' },
    { studentId: '6221100058', nameTh: 'อาริยา คลาวด์เนทีฟ', nameEn: 'Ariya CloudNative', year: 5, gpa: 3.82, status: 'จบการศึกษา', advisor: 'ADV001', careerPath: 'DevOps Engineer' },
    { studentId: '6221100066', nameTh: 'พิมลรัตน์ แมชชีนเลิร์นนิ่ง', nameEn: 'Pimonrat MLearning', year: 5, gpa: 3.55, status: 'จบการศึกษา', advisor: 'ADV002', careerPath: 'Data Analyst' },
    { studentId: '6221100074', nameTh: 'ณัฐวุฒิ โนโค้ด', nameEn: 'Nattawut NoCode', year: 5, gpa: 2.45, status: 'จบการศึกษา', advisor: 'ADV003', careerPath: 'ว่างงาน' },
    { studentId: '6221100082', nameTh: 'ศิริลักษณ์ โมไบล์แอป', nameEn: 'Sirilak MobileApp', year: 5, gpa: 2.70, status: 'จบการศึกษา', advisor: 'ADV004', careerPath: 'ว่างงาน' },
    { studentId: '6121100001', nameTh: 'พงศกร คลาวด์อาร์คิเทค', nameEn: 'Pongsakorn CloudArch', year: 6, gpa: 3.65, status: 'จบการศึกษา', advisor: 'ADV001', careerPath: 'Cloud Architect' },
    { studentId: '6121100012', nameTh: 'กุลนันท์ ไอโอเอส', nameEn: 'Kulanan iOS', year: 6, gpa: 3.48, status: 'จบการศึกษา', advisor: 'ADV002', careerPath: 'Mobile Developer' },
    { studentId: '6121100023', nameTh: 'อนันตชัย เอไอโมเดล', nameEn: 'Anantachai AIModel', year: 6, gpa: 3.92, status: 'จบการศึกษา', advisor: 'ADV003', careerPath: 'AI/ML Engineer' },
    { studentId: '6121100034', nameTh: 'ภาวินี ออโตเมชั่น', nameEn: 'Pawinee Automation', year: 6, gpa: 3.28, status: 'จบการศึกษา', advisor: 'ADV004', careerPath: 'QA Engineer' },
    { studentId: '6121100045', nameTh: 'ชยุต ดีบีเอ', nameEn: 'Chayut DBA', year: 6, gpa: 3.10, status: 'จบการศึกษา', advisor: 'ADV005', careerPath: 'Database Administrator' },
    { studentId: '6121100056', nameTh: 'ธนวัฒน์ ซิสแอดมิน', nameEn: 'Thanawat SysAdmin', year: 6, gpa: 3.00, status: 'จบการศึกษา', advisor: 'ADV001', careerPath: 'System Administrator' },
    { studentId: '6121100067', nameTh: 'ธีรเดช เกมเอนจิน', nameEn: 'Teeradet GameEngine', year: 6, gpa: 3.35, status: 'จบการศึกษา', advisor: 'ADV002', careerPath: 'Game Developer' },
    { studentId: '6121100078', nameTh: 'ศศิธร คอนซัลแตนท์', nameEn: 'Sasithorn Consultant', year: 6, gpa: 3.75, status: 'จบการศึกษา', advisor: 'ADV003', careerPath: 'IT Consultant' },
    { studentId: '6421100074', nameTh: 'ชัยวัฒน์ โค้ดดิ้ง', nameEn: 'Chaiwat Coding', year: 3, gpa: 1.85, status: 'พ้นสภาพ', advisor: 'ADV001' },
    { studentId: '6521100078', nameTh: 'ณัฐพล ไฟร์วอลล์', nameEn: 'Nuttapon Firewall', year: 2, gpa: 1.70, status: 'พ้นสภาพ', advisor: 'ADV004' },
];

export const MOCK_PETITIONS_LOG = [
    {
        id: 'PET-2567-001',
        studentId: '6421100042',
        studentName: 'สมชาย ใจดี',
        type: 'ยื่นขอสอบหัวข้อโปรเจคจบ',
        title: 'ระบบจัดการข้อมูลนักศึกษาด้วย AI Chatbot',
        details: 'ขอยื่นสอบหัวข้อโปรเจคจบ สาขาวิทยาการคอมพิวเตอร์ ภาคเรียนที่ 2/2566 โดยมี ผศ.ดร.วิชัย เทคโนโลยี เป็นอาจารย์ที่ปรึกษา',
        attachment: 'proposal_6421100042.pdf',
        submittedAt: '15 ม.ค. 2567 10:30',
        status: 'อนุมัติ',
        adminComment: 'เอกสารครบถ้วน อนุมัติให้สอบหัวข้อได้',
    },
    {
        id: 'PET-2567-002',
        studentId: '6421100015',
        studentName: 'สมหญิง รักเรียน',
        type: 'ยื่นสอบจบปริญญานิพนธ์',
        title: 'ระบบวิเคราะห์การทำนายแนวโน้มอาชีพด้วย Machine Learning',
        details: 'ขอยื่นสอบจบปริญญานิพนธ์ พัฒนาระบบและทดสอบผลการทดลองเรียบร้อยแล้ว',
        attachment: 'final_defense_somying.pdf',
        submittedAt: '20 ม.ค. 2567 14:15',
        status: 'รอดำเนินการ',
        adminComment: '',
    },
    {
        id: 'PET-2567-003',
        studentId: '6521100028',
        studentName: 'ปริญญา ซอฟต์แวร์',
        type: 'คำร้องทั่วไป',
        title: 'ขอเลื่อนสอบปลายภาควิชา CS2301',
        details: 'เนื่องจากติดภารกิจแข่งขันวิชาการระดับชาติของมหาวิทยาลัย แนบหนังสือรับรอง',
        attachment: 'exam_reschedule_doc.pdf',
        submittedAt: '28 ก.พ. 2567 09:00',
        status: 'รอดำเนินการ',
        adminComment: '',
    },
    {
        id: 'PET-2567-004',
        studentId: '6421100023',
        studentName: 'วิชัย โปรแกรมเมอร์',
        type: 'ยื่นขอสอบหัวข้อโปรเจคจบ',
        title: 'แอปพลิเคชันจัดการขยะรีไซเคิลด้วยเทคโนโลยี Computer Vision',
        details: 'ขอยื่นเสนอหัวข้อปริญญานิพนธ์ รอบที่ 2',
        attachment: 'cv_garbage_proposal.pdf',
        submittedAt: '05 มี.ค. 2567 11:20',
        status: 'อนุมัติ',
        adminComment: 'ผ่านการพิจารณาเบื้องต้น',
    },
    {
        id: 'PET-2567-005',
        studentId: '6521100036',
        studentName: 'มานี ฐานข้อมูล',
        type: 'คำร้องทั่วไป',
        title: 'ขอพักการศึกษา ภาคเรียนที่ 2/2566',
        details: 'ขอพักการศึกษาเนื่องจากเหตุผลความจำเป็นทางครอบครัว',
        attachment: 'leave_request_signed.pdf',
        submittedAt: '12 มี.ค. 2567 16:45',
        status: 'ปฏิเสธ',
        adminComment: 'เอกสารลายเซ็นผู้ปกครองไม่ครบถ้วน กรุณายื่นเอกสารเพิ่มเติม',
    },
    {
        id: 'PET-2567-006',
        studentId: '6621100001',
        studentName: 'ภัทร คลาวด์',
        type: 'คำร้องทั่วไป',
        title: 'ขอเทียบโอนรายวิชาหมวดศึกษาทั่วไป',
        details: 'ขอยื่นเทียบโอนรายวิชา GE1101 จากสถาบันเดิม',
        attachment: 'transcript_transfer.pdf',
        submittedAt: '18 มี.ค. 2567 13:10',
        status: 'รอดำเนินการ',
        adminComment: '',
    },
];

let adminDashboardSelectedBatch = 'all';
let adminDashboardSelectedBatches = []; // Multi-select batch chips state
let adminLastSelectedBatch = 'all';
/** true once the student list came from the database: add / edit / delete then go through the API */
let studentsFromDb = false;

/** GET /students row -> the shape this page uses */
function toPoolStudent(s) {
    return {
        studentId: s.studentId,
        nameTh: s.nameTh,
        nameEn: s.nameEn,
        year: s.year,
        gpa: s.gpa ?? 0,
        status: s.status,
        careerPath: s.careerPath || '',
        employmentStatus: s.employmentStatus || undefined,
        companyName: s.companyName || undefined,
        salaryRange: s.salaryRange || undefined,
        studentSection: s.studentSection || null,
        simulated: !!s.simulated,
        advisor: (s.advisor && typeof s.advisor === 'object') ? s.advisor.id : (s.advisor || ''),
    };
}
let adminSearchQuery = '';
let adminStudentsPage = 1;
let adminStudentsPageSize = 15;
let adminPetitionsBatch = 'all';
let adminPetitionsType = 'all';
let adminPetitionsStatus = 'all';
let adminPetitionsSearch = '';
let adminPetitionsPage = 1;
let adminPetitionsPageSize = 5;

export async function initAdminDashboard() {
    // 1. Initial render with local/fallback data
    renderAdminDashboard();
    renderManageAdvisors();
    renderManageStudents();
    renderManagePetitions();

    // 2. Fetch live data from Spring Boot REST API
    try {
        console.log('🔄 [Admin] Connecting to Spring Boot Backend API...');
        const [liveStudents, livePetitions, liveAdvisors] = await Promise.all([
            fetchAPI('/students').catch(() => null),
            fetchAPI('/petitions').catch(() => null),
            fetchAPI('/advisors').catch(() => null),
        ]);

        // Real advisors, so the advisor picked for a student is an id that exists in the database
        if (Array.isArray(liveAdvisors) && liveAdvisors.length > 0) {
            const counts = {};
            (liveStudents || []).forEach(st => { const id = st.advisor?.id; if (id) counts[id] = (counts[id] || 0) + 1; });
            MOCK_ADVISORS.splice(0, MOCK_ADVISORS.length, ...liveAdvisors.map(a => ({
                id: a.id, nameTh: a.nameTh, nameEn: a.nameEn, email: a.email, phone: a.phone,
                department: a.department, studentsCount: counts[a.id] || 0,
            })));
            renderManageAdvisors();
        }

        if (Array.isArray(liveStudents) && liveStudents.length > 0) {
            console.log('✅ [Admin] Loaded Live Students from Backend API:', liveStudents);
            MOCK_STUDENTS_POOL.splice(0, MOCK_STUDENTS_POOL.length, ...liveStudents.map(toPoolStudent));
            studentsFromDb = true;
            renderAdminDashboard();
            renderManageStudents();
        }

        if (Array.isArray(livePetitions) && livePetitions.length > 0) {
            console.log('✅ [Admin] Loaded Live Petitions from Backend API:', livePetitions);
            const formattedPetitions = livePetitions.map(p => {
                const now = p.submittedAt ? new Date(p.submittedAt) : new Date();
                const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
                const dateStr = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear() + 543} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                return {
                    id: p.id,
                    studentId: p.student ? p.student.studentId : '6421100042',
                    studentName: p.student ? p.student.nameTh : 'นักศึกษา',
                    type: p.type,
                    title: p.title,
                    details: p.details,
                    attachment: p.attachment,
                    submittedAt: dateStr,
                    status: p.status || 'รอดำเนินการ',
                    adminComment: p.adminComment || '',
                };
            });
            MOCK_PETITIONS_LOG.splice(0, MOCK_PETITIONS_LOG.length, ...formattedPetitions);
            renderManagePetitions();
        }
    } catch (err) {
        console.warn('⚠️ [Admin] Could not connect to Spring Boot Backend, using fallback dataset:', err);
    }
}

/**
 * Compute active batches for preset ranges (all, last4, last3, active, or single).
 * @param {string} mode
 * @param {string[]} allBatches
 * @param {Array} [pool]
 * @returns {string[]}
 */
function resolveBatchRange(mode, allBatches, pool = MOCK_STUDENTS_POOL) {
    if (mode === 'all') return allBatches;
    if (mode === 'last4') return allBatches.slice(0, 4);
    if (mode === 'last3') return allBatches.slice(0, 3);
    if (mode === 'active') {
        return allBatches.filter(b => pool.some(s => getBatch(s.studentId) === b && s.status === 'กำลังศึกษา'));
    }
    return [mode];
}

/**
 * Render pagination page buttons HTML with ellipsis for large page ranges.
 * @param {number} currentPage
 * @param {number} totalPages
 * @param {string} btnClass
 * @returns {string}
 */
function renderPaginationPagesHtml(currentPage, totalPages, btnClass = 'pagination-page-btn') {
    if (totalPages <= 1) return `<button class="${btnClass} active" data-page="1">1</button>`;
    const pages = [];
    pages.push(1);
    let start = Math.max(2, currentPage - 1);
    let end = Math.min(totalPages - 1, currentPage + 1);

    if (start > 2) pages.push('...');
    for (let i = start; i <= end; i++) {
        pages.push(i);
    }
    if (end < totalPages - 1) pages.push('...');
    if (totalPages > 1 && !pages.includes(totalPages)) pages.push(totalPages);

    return pages.map(p => {
        if (p === '...') return `<span class="pagination-ellipsis">…</span>`;
        const isActive = p === currentPage;
        return `<button class="${btnClass} ${isActive ? 'active' : ''}" data-page="${p}">${p}</button>`;
    }).join('');
}

/**
 * Compute which batches are currently active based on selection mode.
 * @returns {string[]} Array of batch strings
 */
function getActiveBatches() {
    const allBatches = [...new Set(MOCK_STUDENTS_POOL.map(s => getBatch(s.studentId)))].sort().reverse();
    if (adminDashboardSelectedBatch === 'multi') return adminDashboardSelectedBatches;
    return resolveBatchRange(adminDashboardSelectedBatch, allBatches, MOCK_STUDENTS_POOL);
}

function renderAdminDashboard() {
    const container = document.getElementById('adminDashboardContent');
    if (!container) return;

    const allBatches = [...new Set(MOCK_STUDENTS_POOL.map(s => getBatch(s.studentId)))].sort().reverse();
    const activeBatches = getActiveBatches();
    const isMultiMode = activeBatches.length > 1;

    // Build preset options for the dropdown
    const last4Label = allBatches.length >= 4 ? `⏱️ 4 ปีล่าสุด (รุ่น ${allBatches.slice(0, 4).reverse().join('-')})` : null;
    const last3Label = allBatches.length >= 3 ? `⏱️ 3 ปีล่าสุด (รุ่น ${allBatches.slice(0, 3).reverse().join('-')})` : null;
    const activeCount = allBatches.filter(b => MOCK_STUDENTS_POOL.some(s => getBatch(s.studentId) === b && s.status === 'กำลังศึกษา')).length;

    const batchOpts = [
        `<option value="all" ${adminDashboardSelectedBatch === 'all' ? 'selected' : ''}>ทุกรุ่น / ทุกปีการศึกษา (All Batches) — รวม ${MOCK_STUDENTS_POOL.length} คน</option>`,
        last4Label ? `<option value="last4" ${adminDashboardSelectedBatch === 'last4' ? 'selected' : ''}>${last4Label}</option>` : '',
        last3Label ? `<option value="last3" ${adminDashboardSelectedBatch === 'last3' ? 'selected' : ''}>${last3Label}</option>` : '',
        `<option value="active" ${adminDashboardSelectedBatch === 'active' ? 'selected' : ''}>📗 เฉพาะรุ่นที่กำลังศึกษา (${activeCount} รุ่น)</option>`,
        `<option value="multi" ${adminDashboardSelectedBatch === 'multi' ? 'selected' : ''}>🎛️ เลือกเองหลายรุ่น (Multi-Select)</option>`,
        `<option disabled>─── แยกตามรุ่น ───</option>`,
        ...allBatches.map(b => {
            const count = MOCK_STUDENTS_POOL.filter(s => getBatch(s.studentId) === b).length;
            const yearBE = 2500 + parseInt(b, 10);
            return `<option value="${b}" ${adminDashboardSelectedBatch === b ? 'selected' : ''}>รุ่น ${b} (เข้าปีการศึกษา ${yearBE}) — ${count} คน</option>`;
        }),
    ].filter(Boolean).join('');

    // Filter students by active batches
    const filteredStudents = MOCK_STUDENTS_POOL.filter(s => activeBatches.includes(getBatch(s.studentId)));

    const totalStudents = filteredStudents.length;
    const studying = filteredStudents.filter(s => s.status === 'กำลังศึกษา').length;
    const graduated = filteredStudents.filter(s => s.status === 'จบการศึกษา').length;
    const onLeave = filteredStudents.filter(s => s.status === 'พักการศึกษา').length;
    const dismissed = filteredStudents.filter(s => s.status === 'พ้นสภาพ').length;
    
    const advisorsCount = activeBatches.length === allBatches.length
        ? MOCK_ADVISORS.length
        : new Set(filteredStudents.map(s => s.advisor)).size;

    // Build selected text label
    let selectedBatchText;
    if (adminDashboardSelectedBatch === 'all') selectedBatchText = 'ทุกรุ่น / ทุกปีการศึกษา';
    else if (adminDashboardSelectedBatch === 'last4') selectedBatchText = `4 ปีล่าสุด (รุ่น ${activeBatches.slice().reverse().join(', ')})`;
    else if (adminDashboardSelectedBatch === 'last3') selectedBatchText = `3 ปีล่าสุด (รุ่น ${activeBatches.slice().reverse().join(', ')})`;
    else if (adminDashboardSelectedBatch === 'active') selectedBatchText = `เฉพาะรุ่นกำลังศึกษา (${activeBatches.length} รุ่น)`;
    else if (adminDashboardSelectedBatch === 'multi') selectedBatchText = `เลือก ${activeBatches.length} รุ่น (${activeBatches.slice().reverse().join(', ')})`;
    else selectedBatchText = `รุ่น ${adminDashboardSelectedBatch} (เข้าปีการศึกษา 25${adminDashboardSelectedBatch})`;

    // Build multi-select chips (shown when mode is 'multi' or any multi-batch preset)
    const showChips = adminDashboardSelectedBatch === 'multi';
    const chipsHtml = showChips ? `
        <div class="batch-preset-chips" id="adminBatchChips">
            ${allBatches.map(b => {
                const count = MOCK_STUDENTS_POOL.filter(s => getBatch(s.studentId) === b).length;
                const isActive = adminDashboardSelectedBatches.includes(b);
                return `<button class="batch-chip ${isActive ? 'active' : ''}" data-batch="${b}">
                    รุ่น ${b} <span class="chip-count">(${count})</span>
                </button>`;
            }).join('')}
        </div>` : '';

    container.innerHTML = `
        <div class="batch-filter-bar admin-dashboard-filter-bar" style="margin-bottom:20px">
            <label>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                เลือกดูตามรุ่น / ปีการศึกษา
            </label>
            <select class="batch-select" id="adminDashboardBatchSelect">${batchOpts}</select>
            <span class="filter-result-count">
                กำลังแสดงข้อมูล: <strong>${selectedBatchText}</strong> (จำนวน <strong>${totalStudents}</strong> คน)
            </span>
        </div>
        ${chipsHtml}

        <div class="stat-row">
            <div class="stat-card">
                <div class="stat-icon purple">👩‍🏫</div>
                <div>
                    <div class="stat-value">${advisorsCount}</div>
                    <div class="stat-label">อาจารย์ที่ปรึกษา${activeBatches.length < allBatches.length ? ' (ประจำรุ่น)' : ''}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon blue">👨‍🎓</div>
                <div>
                    <div class="stat-value">${totalStudents}</div>
                    <div class="stat-label">นักศึกษา${activeBatches.length < allBatches.length ? ' (รุ่นที่เลือก)' : 'ทั้งหมด'}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon green">✅</div>
                <div>
                    <div class="stat-value">${studying}</div>
                    <div class="stat-label">กำลังศึกษา</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon amber">🎓</div>
                <div>
                    <div class="stat-value">${graduated}</div>
                    <div class="stat-label">จบการศึกษา</div>
                </div>
            </div>
            ${(onLeave > 0 || dismissed > 0) ? `
            <div class="stat-card">
                <div class="stat-icon red">⚠️</div>
                <div>
                    <div class="stat-value">${onLeave + dismissed}</div>
                    <div class="stat-label">พัก/พ้นสภาพ</div>
                </div>
            </div>
            ` : ''}
        </div>

        <div id="adminRegistrationCard"></div>
        <div id="adminEnrollmentRequestsCard"></div>
        <div id="adminSectionsCard"></div>

        <div class="dashboard-grid">
            <div id="statusChartContainer"></div>
            <div id="careerListContainer"></div>
        </div>

        ${isMultiMode ? `
        <div class="analytics-section-header">
            <div class="analytics-section-title">📊 วิเคราะห์เปรียบเทียบข้ามรุ่น (Year-over-Year Analytics)</div>
            <span class="analytics-section-badge">${activeBatches.length} รุ่น</span>
        </div>
        <div class="trend-analytics-grid">
            <div id="gpaTrendContainer"></div>
            <div id="statusStackedContainer"></div>
        </div>
        <div id="careerShiftContainer" style="margin-bottom:20px"></div>
        ` : ''}

        <div class="card">
            <div class="card-title">📊 ภาพรวมระบบ — ${selectedBatchText}</div>
            <p style="font-size:0.88rem;color:var(--text-muted);line-height:1.7">ระบบสารสนเทศนักศึกษา BSRU สาขาวิทยาการคอมพิวเตอร์ — สถิติของ <strong>${selectedBatchText}</strong> รวมทั้งสิ้น <strong>${totalStudents}</strong> คน (กำลังศึกษา ${studying} คน, จบการศึกษา ${graduated} คน, พักการศึกษา ${onLeave} คน, พ้นสภาพ ${dismissed} คน)</p>
        </div>
    `;

    // Event: dropdown change
    document.getElementById('adminDashboardBatchSelect').addEventListener('change', (e) => {
        adminDashboardSelectedBatch = e.target.value;
        // Initialize multi-select chips with all batches if switching to multi mode
        if (adminDashboardSelectedBatch === 'multi' && adminDashboardSelectedBatches.length === 0) {
            adminDashboardSelectedBatches = [...allBatches];
        }
        renderAdminDashboard();
    });

    // Event: multi-select batch chips
    if (showChips) {
        document.querySelectorAll('#adminBatchChips .batch-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const batch = chip.dataset.batch;
                if (adminDashboardSelectedBatches.includes(batch)) {
                    // Prevent deselecting last chip
                    if (adminDashboardSelectedBatches.length > 1) {
                        adminDashboardSelectedBatches = adminDashboardSelectedBatches.filter(b => b !== batch);
                    }
                } else {
                    adminDashboardSelectedBatches.push(batch);
                    adminDashboardSelectedBatches.sort();
                }
                renderAdminDashboard();
            });
        });
    }

    // Load chart CSS and render all components
    Promise.all([
        loadComponentCSS('statusChart'),
        loadComponentCSS('yearTrend'),
    ]).then(() => {
        renderStatusDonutChart('statusChartContainer', filteredStudents);
        renderCareerDataList('careerListContainer', filteredStudents);

        // Render Year-over-Year analytics when multiple batches selected
        if (isMultiMode) {
            const sortedActive = activeBatches.slice().sort();
            renderGpaTrendChart('gpaTrendContainer', MOCK_STUDENTS_POOL, sortedActive);
            renderStatusStackedBar('statusStackedContainer', MOCK_STUDENTS_POOL, sortedActive);
            renderCareerShiftMatrix('careerShiftContainer', MOCK_STUDENTS_POOL, sortedActive);
        }
    });

    renderRegistrationCard();
    renderEnrollmentRequestsCard();
    renderAdminSectionsCard();
}

/* ============================================================
   REGISTRATION PERIODS — when students may add/drop courses
   ============================================================ */

/** "2026-10-05T08:00:00" -> "2026-10-05T08:00" for <input type="datetime-local"> */
const toInputDateTime = (iso) => (iso || '').slice(0, 16);

/** Pull the backend message out of a fetchAPI error ('HTTP 400 (...): {"error":"..."}') */
export function apiErrorText(err) {
    const match = /\{.*\}$/s.exec(err.message || '');
    if (match) {
        try { return JSON.parse(match[0]).error || err.message; } catch (e) { /* not JSON */ }
    }
    return err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
}

async function renderRegistrationCard() {
    const container = document.getElementById('adminRegistrationCard');
    if (!container) return;

    let periods;
    try {
        periods = await fetchAPI('/registration-periods');
        if (!container.isConnected) return;
    } catch (err) {
        container.innerHTML = `<div class="card"><div class="card-title">🗓️ ช่วงลงทะเบียนเรียน</div><p style="color:var(--text-muted)">เชื่อมต่อ backend ไม่ได้ จึงยังจัดการช่วงลงทะเบียนไม่ได้</p></div>`;
        return;
    }

    const rows = periods.map(p => `
        <tr data-year="${p.academicYear}" data-term="${p.term}">
            <td><strong>${p.term}/${p.academicYear}</strong></td>
            <td>${p.open
                ? '<span class="badge badge-green">เปิดอยู่</span>'
                : `<span class="badge badge-red">ปิดอยู่${p.forceClosed ? ' (ปิดด่วน)' : ''}</span>`}</td>
            <td><input type="datetime-local" class="app-input reg-opens" value="${toInputDateTime(p.opensAt)}"></td>
            <td><input type="datetime-local" class="app-input reg-closes" value="${toInputDateTime(p.closesAt)}"></td>
            <td style="white-space:nowrap">
                <button class="btn btn-sm btn-ghost reg-save">บันทึกเวลา</button>
                <button class="btn btn-sm ${p.forceClosed ? 'btn-orange' : 'btn-danger'} reg-toggle" data-force-closed="${!p.forceClosed}">
                    ${p.forceClosed ? 'ยกเลิกปิดด่วน' : 'ปิดด่วน'}
                </button>
            </td>
        </tr>`).join('');

    container.innerHTML = `
        <div class="card">
            <div class="card-title">🗓️ ช่วงลงทะเบียนเรียน (นักศึกษาเพิ่ม/ลบวิชาเองได้เฉพาะช่วงที่เปิด)</div>
            <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px">
                เปิดอยู่ = เวลาปัจจุบันอยู่ในช่วงเปิด–ปิด และไม่ได้กดปิดด่วน · ผู้ดูแลระบบและอาจารย์ผู้สอนแก้ตารางเรียนได้ตลอดเวลา
            </p>
            <div class="table-wrap">
                <table class="data-table">
                    <thead><tr><th>ภาคเรียน</th><th>สถานะ</th><th>เปิด</th><th>ปิด</th><th></th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">ยังไม่มีช่วงลงทะเบียน</td></tr>'}</tbody>
                </table>
            </div>
            <div class="batch-filter-bar" style="margin-top:12px;flex-wrap:wrap;gap:8px">
                <label>สร้างช่วงลงทะเบียนภาคเรียนใหม่</label>
                <input type="number" class="app-input" id="regNewYear" placeholder="ปี เช่น 2569" style="width:120px">
                <select class="batch-select" id="regNewTerm"><option value="1">ภาค 1</option><option value="2">ภาค 2</option><option value="3">ภาคฤดูร้อน</option></select>
                <input type="datetime-local" class="app-input" id="regNewOpens">
                <input type="datetime-local" class="app-input" id="regNewCloses">
                <button class="btn btn-sm btn-orange" id="regCreateBtn">สร้าง</button>
            </div>
        </div>`;

    const save = async (body, successMessage) => {
        try {
            await fetchAPI('/registration-periods', 'PUT', body, 8000);
            showToast('success', successMessage);
            renderRegistrationCard();
        } catch (err) {
            showToast('error', apiErrorText(err));
        }
    };

    container.querySelectorAll('tr[data-year]').forEach(row => {
        const base = { academicYear: Number(row.dataset.year), term: Number(row.dataset.term) };
        const label = `${base.term}/${base.academicYear}`;
        row.querySelector('.reg-save').addEventListener('click', () => save({
            ...base,
            opensAt: row.querySelector('.reg-opens').value,
            closesAt: row.querySelector('.reg-closes').value,
        }, `บันทึกช่วงลงทะเบียนภาคเรียน ${label} แล้ว`));
        const toggle = row.querySelector('.reg-toggle');
        toggle.addEventListener('click', () => {
            const forceClosed = toggle.dataset.forceClosed === 'true';
            save({ ...base, forceClosed },
                forceClosed ? `ปิดลงทะเบียนภาคเรียน ${label} ทันทีแล้ว` : `ยกเลิกปิดด่วน ภาคเรียน ${label} จะเปิดตามช่วงเวลาที่ตั้งไว้`);
        });
    });

    container.querySelector('#regCreateBtn').addEventListener('click', () => {
        const year = Number(document.getElementById('regNewYear').value);
        if (!year) {
            showToast('error', 'กรุณากรอกปีการศึกษา');
            return;
        }
        save({
            academicYear: year,
            term: Number(document.getElementById('regNewTerm').value),
            opensAt: document.getElementById('regNewOpens').value || null,
            closesAt: document.getElementById('regNewCloses').value || null,
            forceClosed: false,
        }, `สร้างช่วงลงทะเบียนภาคเรียนใหม่แล้ว`);
    });
}

/* ============================================================
   CLASS SECTIONS — teachers request, admin approves.
   Students can only register for APPROVED sections.
   ============================================================ */
const SECTION_STATUS = {
    PENDING: { label: 'รออนุมัติ', badge: 'badge-amber' },
    APPROVED: { label: 'อนุมัติแล้ว', badge: 'badge-green' },
    REJECTED: { label: 'ไม่อนุมัติ', badge: 'badge-red' },
};

/** Status badge of a section, with the admin's note as a tooltip (shared with the advisor page) */
export function sectionStatusBadge(section) {
    const st = SECTION_STATUS[section.approvalStatus] || SECTION_STATUS.APPROVED;
    const note = section.reviewNote ? ` title="${esc(section.reviewNote)}"` : '';
    return `<span class="badge ${st.badge}"${note}>${st.label}</span>`;
}

let adminSectionStatusFilter = null;  // null = choose automatically on first render
let adminSectionTermFilter = 'all';

async function renderAdminSectionsCard() {
    const container = document.getElementById('adminSectionsCard');
    if (!container) return;

    let sections;
    try {
        sections = await fetchAPI('/sections/mine');
    } catch (err) {
        container.innerHTML = `<div class="card"><div class="card-title">📚 จัดการกลุ่มเรียน</div><p style="color:var(--text-muted)">เชื่อมต่อ backend ไม่ได้ จึงยังจัดการกลุ่มเรียนไม่ได้</p></div>`;
        return;
    }
    // The dashboard may have re-rendered while waiting for the API
    if (!container.isConnected) return;

    const pendingCount = sections.filter(s => s.approvalStatus === 'PENDING').length;
    if (adminSectionStatusFilter === null) adminSectionStatusFilter = pendingCount > 0 ? 'PENDING' : 'all';

    const terms = [...new Set(sections.map(s => `${s.term}/${s.academicYear}`))];
    const shown = sections.filter(s =>
        (adminSectionStatusFilter === 'all' || s.approvalStatus === adminSectionStatusFilter) &&
        (adminSectionTermFilter === 'all' || `${s.term}/${s.academicYear}` === adminSectionTermFilter));

    const rows = shown.map(s => `
        <tr data-section-id="${s.sectionId}">
            <td><span class="badge badge-blue">${esc(s.courseCode)}</span><div style="font-size:0.82rem">${esc(s.courseName)} (${s.credits} หน่วยกิต)</div></td>
            <td>${s.term}/${s.academicYear}</td>
            <td class="hide-mobile">${esc(s.sectionNo)}</td>
            <td>${esc(s.dayName)} ${esc(s.startTime)}–${esc(s.endTime)}</td>
            <td class="hide-mobile">${esc(s.room || '-')}</td>
            <td class="hide-mobile">${esc(s.instructorName || '-')}</td>
            <td>${s.enrolledCount}${s.capacity ? ' / ' + s.capacity : ''}</td>
            <td>${sectionStatusBadge(s)}${s.reviewNote ? `<div style="font-size:0.75rem;color:var(--text-muted)">${esc(s.reviewNote)}</div>` : ''}</td>
            <td style="white-space:nowrap">
                ${s.approvalStatus !== 'APPROVED' ? '<button class="btn btn-sm btn-orange sec-approve">อนุมัติ</button>' : ''}
                ${s.approvalStatus !== 'REJECTED' ? '<button class="btn btn-sm btn-ghost sec-reject">ไม่อนุมัติ</button>' : ''}
                <button class="btn btn-sm btn-ghost sec-delete" title="ลบกลุ่มเรียน">🗑️</button>
            </td>
        </tr>`).join('');

    const option = (value, label, selected) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`;

    container.innerHTML = `
        <div class="card">
            <div class="card-title">📚 จัดการกลุ่มเรียน
                ${pendingCount > 0 ? `<span class="badge badge-amber" style="font-size:0.75rem">รออนุมัติ ${pendingCount}</span>` : ''}
            </div>
            <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px">
                อาจารย์เป็นผู้เพิ่ม/แก้ไขกลุ่มเรียน แล้วส่งมาให้อนุมัติ · นักศึกษาลงทะเบียนได้เฉพาะกลุ่มที่อนุมัติแล้ว ·
                ถ้าอาจารย์แก้กลุ่มที่อนุมัติไปแล้ว จะกลับมารออนุมัติใหม่ (นักศึกษาที่ลงไว้แล้วยังอยู่ในกลุ่มเดิม)
            </p>
            <div class="batch-filter-bar" style="flex-wrap:wrap;gap:8px;margin-bottom:12px">
                <label>สถานะ</label>
                <select class="batch-select" id="secStatusFilter">
                    ${option('all', 'ทั้งหมด', adminSectionStatusFilter)}
                    ${option('PENDING', 'รออนุมัติ', adminSectionStatusFilter)}
                    ${option('APPROVED', 'อนุมัติแล้ว', adminSectionStatusFilter)}
                    ${option('REJECTED', 'ไม่อนุมัติ', adminSectionStatusFilter)}
                </select>
                <label>ภาคเรียน</label>
                <select class="batch-select" id="secTermFilter">
                    ${option('all', 'ทุกภาคเรียน', adminSectionTermFilter)}
                    ${terms.map(t => option(t, t, adminSectionTermFilter)).join('')}
                </select>
            </div>
            <div class="table-wrap">
                <table class="data-table" id="adminSectionsTable">
                    <thead><tr><th>วิชา</th><th>ภาค</th><th class="hide-mobile">Sec</th><th>วัน-เวลา</th><th class="hide-mobile">ห้อง</th><th class="hide-mobile">อาจารย์</th><th>นักศึกษา</th><th>สถานะ</th><th></th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="9" style="text-align:center;color:var(--text-muted)">ไม่มีกลุ่มเรียนตามเงื่อนไขที่เลือก</td></tr>'}</tbody>
                </table>
            </div>
        </div>`;

    container.querySelector('#secStatusFilter').addEventListener('change', e => {
        adminSectionStatusFilter = e.target.value;
        renderAdminSectionsCard();
    });
    container.querySelector('#secTermFilter').addEventListener('change', e => {
        adminSectionTermFilter = e.target.value;
        renderAdminSectionsCard();
    });

    const review = async (section, status, note, message) => {
        try {
            await fetchAPI(`/sections/${section.sectionId}/review`, 'PATCH', { status, note }, 8000);
            showToast('success', esc(message));
            renderAdminSectionsCard();
        } catch (err) {
            showToast('error', esc(apiErrorText(err)));
        }
    };

    container.querySelectorAll('tr[data-section-id]').forEach(row => {
        const section = sections.find(s => String(s.sectionId) === row.dataset.sectionId);
        const label = `${section.courseCode} กลุ่ม ${section.sectionNo} (${section.term}/${section.academicYear})`;

        row.querySelector('.sec-approve')?.addEventListener('click', () =>
            review(section, 'APPROVED', null, `อนุมัติ ${label} แล้ว นักศึกษาลงทะเบียนได้`));

        row.querySelector('.sec-reject')?.addEventListener('click', () => {
            const note = prompt(`เหตุผลที่ไม่อนุมัติ ${label} (อาจารย์จะเห็นข้อความนี้)`);
            if (note === null) return;
            if (!note.trim()) {
                showToast('error', 'กรุณาระบุเหตุผลที่ไม่อนุมัติ');
                return;
            }
            review(section, 'REJECTED', note.trim(), `ไม่อนุมัติ ${label} แล้ว`);
        });

        row.querySelector('.sec-delete').addEventListener('click', async () => {
            const warning = section.enrolledCount > 0
                ? `\nนักศึกษา ${section.enrolledCount} คนที่ลงกลุ่มนี้จะถูกถอนออกจากตารางเรียนด้วย` : '';
            if (!confirm(`ลบ ${label}?${warning}`)) return;
            try {
                await fetchAPI(`/sections/${section.sectionId}`, 'DELETE', null, 8000);
                showToast('info', esc(`ลบ ${label} แล้ว`));
                renderAdminSectionsCard();
            } catch (err) {
                showToast('error', esc(apiErrorText(err)));
            }
        });
    });
}

/* ============================================================
   REGISTRATION REQUESTS — students send their course cart,
   the admin confirms or rejects each request.
   ============================================================ */
const REQUEST_TIME = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' });

async function renderEnrollmentRequestsCard() {
    const container = document.getElementById('adminEnrollmentRequestsCard');
    if (!container) return;

    let requests;
    try {
        requests = await fetchAPI('/enrollments/pending');
    } catch (err) {
        container.innerHTML = '';
        return;
    }
    // The dashboard may have re-rendered while waiting for the API
    if (!container.isConnected) return;

    const rows = requests.map(r => `
        <tr data-id="${r.enrollmentId}">
            <td><input type="checkbox" class="req-check" value="${r.enrollmentId}"></td>
            <td><strong>${esc(r.studentId)}</strong><div style="font-size:0.82rem">${esc(r.studentName)}</div></td>
            <td><span class="badge badge-purple">${esc(r.studentSection)}</span></td>
            <td><span class="badge badge-blue">${esc(r.section.courseCode)}</span><div style="font-size:0.82rem">${esc(r.section.courseName)}</div></td>
            <td>${r.section.term}/${r.section.academicYear} · ${esc(r.section.sectionNo)}</td>
            <td class="hide-mobile">${esc(r.section.dayName)} ${esc(r.section.startTime)}–${esc(r.section.endTime)}</td>
            <td class="hide-mobile">${r.section.enrolledCount}${r.section.capacity ? ' / ' + r.section.capacity : ''}</td>
            <td class="hide-mobile" style="font-size:0.8rem">${esc(REQUEST_TIME.format(new Date(r.requestedAt)))}</td>
            <td style="white-space:nowrap">
                <button class="btn btn-sm btn-orange req-confirm">ยืนยัน</button>
                <button class="btn btn-sm btn-ghost req-reject">ไม่อนุมัติ</button>
            </td>
        </tr>`).join('');

    container.innerHTML = `
        <div class="card">
            <div class="card-title">📝 คำขอลงทะเบียนของนักศึกษา
                ${requests.length ? `<span class="badge badge-amber" style="font-size:0.75rem">รอยืนยัน ${requests.length}</span>` : ''}
            </div>
            <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px">
                นักศึกษาเลือกวิชาแล้วกดยืนยันลงทะเบียน คำขอจะมารอที่นี่ · คำขอที่รออยู่จองที่นั่งไว้แล้ว · ไม่อนุมัติแล้วที่นั่งจะว่าง และนักศึกษาจะเห็นเหตุผล
            </p>
            ${requests.length ? `
            <div class="batch-filter-bar" style="flex-wrap:wrap;gap:8px;margin-bottom:12px">
                <button class="btn btn-sm btn-orange" id="reqConfirmSelected">ยืนยันที่เลือก</button>
                <button class="btn btn-sm btn-ghost" id="reqRejectSelected">ไม่อนุมัติที่เลือก</button>
            </div>` : ''}
            <div class="table-wrap">
                <table class="data-table">
                    <thead><tr><th><input type="checkbox" id="reqCheckAll" title="เลือกทั้งหมด"></th><th>นักศึกษา</th><th>Sec</th><th>วิชา</th><th>ภาค · กลุ่ม</th><th class="hide-mobile">วัน-เวลา</th><th class="hide-mobile">ที่นั่ง</th><th class="hide-mobile">ส่งเมื่อ</th><th></th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="9" style="text-align:center;color:var(--text-muted)">ไม่มีคำขอที่รอยืนยัน</td></tr>'}</tbody>
                </table>
            </div>
        </div>`;

    const review = async (ids, status) => {
        if (ids.length === 0) {
            showToast('error', 'กรุณาเลือกคำขออย่างน้อย 1 รายการ');
            return;
        }
        let note = null;
        if (status === 'REJECTED') {
            note = prompt(`เหตุผลที่ไม่อนุมัติ ${ids.length} รายการ (นักศึกษาจะเห็นข้อความนี้)`);
            if (note === null) return;
            if (!note.trim()) {
                showToast('error', 'กรุณาระบุเหตุผลที่ไม่อนุมัติ');
                return;
            }
        }
        try {
            const result = await fetchAPI('/enrollments/review', 'PATCH', { enrollmentIds: ids, status, note }, 8000);
            showToast('success', status === 'CONFIRMED'
                ? `ยืนยันการลงทะเบียน ${result.updated} รายการแล้ว`
                : `ไม่อนุมัติ ${result.updated} รายการแล้ว`);
            renderEnrollmentRequestsCard();
            renderAdminSectionsCard();
        } catch (err) {
            showToast('error', esc(apiErrorText(err)));
        }
    };

    const selectedIds = () => [...container.querySelectorAll('.req-check:checked')].map(c => Number(c.value));
    container.querySelector('#reqCheckAll')?.addEventListener('change', e => {
        container.querySelectorAll('.req-check').forEach(c => { c.checked = e.target.checked; });
    });
    container.querySelector('#reqConfirmSelected')?.addEventListener('click', () => review(selectedIds(), 'CONFIRMED'));
    container.querySelector('#reqRejectSelected')?.addEventListener('click', () => review(selectedIds(), 'REJECTED'));
    container.querySelectorAll('tr[data-id]').forEach(row => {
        const id = Number(row.dataset.id);
        row.querySelector('.req-confirm').addEventListener('click', () => review([id], 'CONFIRMED'));
        row.querySelector('.req-reject').addEventListener('click', () => review([id], 'REJECTED'));
    });
}

function renderManageAdvisors() {
    const rows = MOCK_ADVISORS.map((a, i) => `
        <tr>
            <td><strong>${esc(a.id)}</strong></td>
            <td>${esc(a.nameTh)}</td>
            <td class="hide-mobile">${esc(a.email)}</td>
            <td class="hide-mobile">${esc(a.department)}</td>
            <td style="text-align:center">${a.studentsCount}</td>
            <td>
                <div class="action-btns">
                    <button class="btn btn-sm btn-warning edit-advisor-btn" data-idx="${i}">แก้ไข</button>
                    <button class="btn btn-sm btn-danger del-advisor-btn" data-idx="${i}">ลบ</button>
                </div>
            </td>
        </tr>`).join('');

    document.getElementById('manageAdvisorsContent').innerHTML = `
        <div class="card">
            <div class="toolbar">
                <div class="card-title" style="margin-bottom:0">👩‍🏫 รายชื่ออาจารย์ที่ปรึกษา <span class="badge badge-purple">${MOCK_ADVISORS.length} คน</span></div>
                <button class="btn btn-success" id="addAdvisorBtn">เพิ่มอาจารย์</button>
            </div>
            <div class="table-wrap">
                <table class="data-table">
                    <thead><tr><th>รหัส</th><th>ชื่อ-สกุล</th><th class="hide-mobile">Email</th><th class="hide-mobile">สาขา</th><th style="text-align:center">นศ.ที่ดูแล</th><th>จัดการ</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById('addAdvisorBtn').addEventListener('click', () => openAdvisorModal('add'));
    document.querySelectorAll('.edit-advisor-btn').forEach(b => b.addEventListener('click', () => openAdvisorModal('edit', parseInt(b.dataset.idx))));
    document.querySelectorAll('.del-advisor-btn').forEach(b => b.addEventListener('click', () => {
        const idx = parseInt(b.dataset.idx);
        if (confirm(`ต้องการลบ "${MOCK_ADVISORS[idx].nameTh}" หรือไม่?`)) {
            MOCK_ADVISORS.splice(idx, 1);
            renderManageAdvisors();
            renderAdminDashboard();
        }
    }));
}

function openAdvisorModal(mode, idx) {
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const crudModal = document.getElementById('crudModal');
    
    const a = mode === 'edit' ? MOCK_ADVISORS[idx] : {};
    modalTitle.textContent = mode === 'edit' ? 'แก้ไขอาจารย์ที่ปรึกษา' : 'เพิ่มอาจารย์ที่ปรึกษาใหม่';
    modalBody.innerHTML = `
        <div class="modal-field"><label>รหัส</label><input id="mfId" value="${esc(a.id || '')}" ${mode === 'edit' ? 'readonly style="opacity:0.6"' : ''}></div>
        <div class="modal-field"><label>ชื่อ-สกุล (ไทย)</label><input id="mfNameTh" value="${esc(a.nameTh || '')}"></div>
        <div class="modal-field"><label>ชื่อ-สกุล (Eng)</label><input id="mfNameEn" value="${esc(a.nameEn || '')}"></div>
        <div class="modal-field"><label>Email</label><input id="mfEmail" value="${esc(a.email || '')}"></div>
        <div class="modal-field"><label>โทรศัพท์</label><input id="mfPhone" value="${esc(a.phone || '')}"></div>
        <div class="modal-field"><label>สาขา</label><input id="mfDept" value="${esc(a.department || 'วิทยาการคอมพิวเตอร์')}"></div>
    `;
    
    const saveBtn = document.getElementById('modalSave');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    
    newSaveBtn.addEventListener('click', () => {
        const data = {
            id: document.getElementById('mfId').value.trim(),
            nameTh: document.getElementById('mfNameTh').value.trim(),
            nameEn: document.getElementById('mfNameEn').value.trim(),
            email: document.getElementById('mfEmail').value.trim(),
            phone: document.getElementById('mfPhone').value.trim(),
            department: document.getElementById('mfDept').value.trim(),
            studentsCount: a.studentsCount || 0,
        };
        if (!data.id || !data.nameTh) return alert('กรุณากรอกข้อมูลที่จำเป็น');
        if (mode === 'edit') { MOCK_ADVISORS[idx] = data; }
        else { MOCK_ADVISORS.push(data); }
        crudModal.classList.remove('open');
        renderManageAdvisors();
        renderAdminDashboard();
    });
    
    crudModal.classList.add('open');
}

function renderManageStudents() {
    const allBatches = [...new Set(MOCK_STUDENTS_POOL.map(s => getBatch(s.studentId)))].sort().reverse();
    const activeBatches = resolveBatchRange(adminLastSelectedBatch, allBatches, MOCK_STUDENTS_POOL);

    const last4Label = allBatches.length >= 4 ? `⏱️ 4 ปีล่าสุด (รุ่น ${allBatches.slice(0, 4).reverse().join('-')})` : null;
    const last3Label = allBatches.length >= 3 ? `⏱️ 3 ปีล่าสุด (รุ่น ${allBatches.slice(0, 3).reverse().join('-')})` : null;
    const activeCount = allBatches.filter(b => MOCK_STUDENTS_POOL.some(s => getBatch(s.studentId) === b && s.status === 'กำลังศึกษา')).length;

    const filterOpts = [
        `<option value="all" ${adminLastSelectedBatch === 'all' ? 'selected' : ''}>ทุกรุ่น / ทุกปีการศึกษา (All Batches) — รวม ${MOCK_STUDENTS_POOL.length} คน</option>`,
        last4Label ? `<option value="last4" ${adminLastSelectedBatch === 'last4' ? 'selected' : ''}>${last4Label}</option>` : '',
        last3Label ? `<option value="last3" ${adminLastSelectedBatch === 'last3' ? 'selected' : ''}>${last3Label}</option>` : '',
        `<option value="active" ${adminLastSelectedBatch === 'active' ? 'selected' : ''}>📗 เฉพาะรุ่นที่กำลังศึกษา (${activeCount} รุ่น)</option>`,
        `<option disabled>─── แยกตามรุ่น ───</option>`,
        ...allBatches.map(b => {
            const count = MOCK_STUDENTS_POOL.filter(s => getBatch(s.studentId) === b).length;
            const yearBE = 2500 + parseInt(b, 10);
            return `<option value="${b}" ${adminLastSelectedBatch === b ? 'selected' : ''}>รุ่น ${b} (เข้าปีการศึกษา ${yearBE}) — ${count} คน</option>`;
        }),
    ].filter(Boolean).join('');

    let filtered = MOCK_STUDENTS_POOL.filter(s => activeBatches.includes(getBatch(s.studentId)));

    if (adminSearchQuery) {
        const q = adminSearchQuery.toLowerCase();
        filtered = filtered.filter(s => s.studentId.includes(q) || s.nameTh.toLowerCase().includes(q) || (s.nameEn && s.nameEn.toLowerCase().includes(q)));
    }

    // Pagination calculations
    const totalStudents = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalStudents / adminStudentsPageSize));
    if (adminStudentsPage > totalPages) adminStudentsPage = totalPages;
    if (adminStudentsPage < 1) adminStudentsPage = 1;

    const startIndex = (adminStudentsPage - 1) * adminStudentsPageSize;
    const endIndex = Math.min(startIndex + adminStudentsPageSize, totalStudents);
    const pagedStudents = filtered.slice(startIndex, endIndex);

    const rows = pagedStudents.map((s) => {
        const realIdx = MOCK_STUDENTS_POOL.indexOf(s);
        const batch = getBatch(s.studentId);
        return `
        <tr>
            <td><strong>${esc(s.studentId)}</strong></td>
            <td>${esc(s.nameTh)} <span class="batch-tag">รุ่น ${batch}</span>${s.simulated ? ' <span class="badge badge-amber" style="font-size:0.7rem" title="ข้อมูลจำลอง: ไม่มีบัญชีเข้าสู่ระบบและผลการเรียน">จำลอง</span>' : ''}</td>
            <td style="text-align:center" class="hide-mobile">ปี ${s.year}</td>
            <td style="text-align:center"><strong>${s.gpa.toFixed(2)}</strong></td>
            <td>${s.studentSection
                ? `<select class="batch-select student-sec-select" data-sid="${esc(s.studentId)}">${['D1', 'D2'].map(g => `<option value="${g}" ${s.studentSection === g ? 'selected' : ''}>${g}</option>`).join('')}</select>`
                : '-'}</td>
            <td><span class="badge ${statusBadge(s.status)}">${esc(s.status)}</span></td>
            <td>
                <div class="action-btns">
                    <button class="btn btn-sm btn-orange admin-imp-btn" data-sid="${s.studentId}" data-sname="${esc(s.nameTh)}">จำลอง</button>
                    ${s.studentSection && !s.simulated ? `
                    <button class="btn btn-sm btn-ghost audit-dl-btn" data-sid="${esc(s.studentId)}" title="ดาวน์โหลดใบตรวจสอบจบ (ใช้เป็นแม่แบบได้)">⬇ ใบตรวจจบ</button>
                    <button class="btn btn-sm btn-ghost audit-ul-btn" data-sid="${esc(s.studentId)}" title="อัปโหลดใบตรวจสอบจบ (.json)">⬆ อัปโหลด</button>
                    <button class="btn btn-sm btn-ghost reset-pw-btn" data-sid="${esc(s.studentId)}" data-sname="${esc(s.nameTh)}" title="รีเซ็ตรหัสผ่านเป็นรหัสนักศึกษา">🔑 รีเซ็ตรหัส</button>` : ''}
                    <button class="btn btn-sm btn-warning edit-student-btn" data-idx="${realIdx}">แก้ไข</button>
                    <button class="btn btn-sm btn-danger del-student-btn" data-idx="${realIdx}">ลบ</button>
                </div>
            </td>
        </tr>`;
    }).join('');

    let selectedBatchDesc;
    if (adminLastSelectedBatch === 'all') selectedBatchDesc = 'ทุกรุ่น';
    else if (adminLastSelectedBatch === 'last4') selectedBatchDesc = `4 ปีล่าสุด (${activeBatches.slice().reverse().join(', ')})`;
    else if (adminLastSelectedBatch === 'last3') selectedBatchDesc = `3 ปีล่าสุด (${activeBatches.slice().reverse().join(', ')})`;
    else if (adminLastSelectedBatch === 'active') selectedBatchDesc = `รุ่นกำลังศึกษา (${activeBatches.length} รุ่น)`;
    else selectedBatchDesc = `รุ่น ${adminLastSelectedBatch}`;

    const paginationHtml = totalStudents > 0 ? `
        <div class="table-pagination-bar">
            <div class="pagination-info">
                แสดงรายการที่ <strong>${startIndex + 1} - ${endIndex}</strong> จากทั้งหมด <strong>${totalStudents}</strong> คน
                <span class="pagination-size-select">
                    (หน้าละ 
                    <select class="page-size-select" id="adminStudentPageSize">
                        <option value="10" ${adminStudentsPageSize === 10 ? 'selected' : ''}>10</option>
                        <option value="15" ${adminStudentsPageSize === 15 ? 'selected' : ''}>15</option>
                        <option value="25" ${adminStudentsPageSize === 25 ? 'selected' : ''}>25</option>
                        <option value="50" ${adminStudentsPageSize === 50 ? 'selected' : ''}>50</option>
                    </select> คน)
                </span>
            </div>
            <div class="pagination-controls">
                <button class="pagination-btn" id="adminStudentPrevPage" ${adminStudentsPage <= 1 ? 'disabled' : ''}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="15 18 9 12 15 6"/></svg>
                    ก่อนหน้า
                </button>
                <div class="pagination-pages" id="adminStudentPages">
                    ${renderPaginationPagesHtml(adminStudentsPage, totalPages, 'admin-std-page-btn')}
                </div>
                <button class="pagination-btn" id="adminStudentNextPage" ${adminStudentsPage >= totalPages ? 'disabled' : ''}>
                    ถัดไป
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
            </div>
        </div>` : '';

    document.getElementById('manageStudentsContent').innerHTML = `
        <div class="batch-filter-bar">
            <label>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                กรองตามรุ่น / ปีการศึกษา
            </label>
            <select class="batch-select" id="adminBatchFilter">${filterOpts}</select>
            <div class="filter-result-count">
                กรอง: <strong>${selectedBatchDesc}</strong> (พบ <strong>${totalStudents}</strong> คน)
            </div>
            <div class="toolbar-search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" id="adminStudentSearch" placeholder="ค้นหารหัสนักศึกษา, ชื่อ..." value="${esc(adminSearchQuery)}">
            </div>
            <button class="btn btn-success" id="addStudentBtn">เพิ่มนักศึกษา</button>
            <input type="file" id="auditUploadInput" accept=".json,application/json" hidden>
        </div>
        <div class="card" style="padding:0;overflow:hidden">
            <div class="table-wrap">
                <table class="data-table">
                    <thead><tr><th>รหัสนักศึกษา</th><th>ชื่อ-สกุล</th><th style="text-align:center" class="hide-mobile">ชั้นปี</th><th style="text-align:center">GPA</th><th>Sec</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
                    <tbody>${rows.length > 0 ? rows : `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">ไม่พบข้อมูลนักศึกษาที่ตรงกับเงื่อนไขการค้นหา</td></tr>`}</tbody>
                </table>
            </div>
            ${paginationHtml}
        </div>
    `;

    document.getElementById('adminBatchFilter').addEventListener('change', (e) => {
        adminLastSelectedBatch = e.target.value;
        adminStudentsPage = 1;
        renderManageStudents();
    });

    const searchInput = document.getElementById('adminStudentSearch');
    searchInput.addEventListener('input', debounce((e) => {
        adminSearchQuery = e.target.value.trim();
        adminStudentsPage = 1;
        renderManageStudents();
        const newSearchInput = document.getElementById('adminStudentSearch');
        if (newSearchInput) {
            newSearchInput.focus();
            newSearchInput.setSelectionRange(adminSearchQuery.length, adminSearchQuery.length);
        }
    }, 300));

    const pageSizeSelect = document.getElementById('adminStudentPageSize');
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', (e) => {
            adminStudentsPageSize = parseInt(e.target.value, 10);
            adminStudentsPage = 1;
            renderManageStudents();
        });
    }

    const prevBtn = document.getElementById('adminStudentPrevPage');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (adminStudentsPage > 1) {
                adminStudentsPage--;
                renderManageStudents();
            }
        });
    }
    const nextBtn = document.getElementById('adminStudentNextPage');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (adminStudentsPage < totalPages) {
                adminStudentsPage++;
                renderManageStudents();
            }
        });
    }

    document.querySelectorAll('.admin-std-page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = parseInt(btn.dataset.page, 10);
            if (!isNaN(page) && page !== adminStudentsPage) {
                adminStudentsPage = page;
                renderManageStudents();
            }
        });
    });

    document.getElementById('addStudentBtn').addEventListener('click', () => openStudentModal('add'));
    document.querySelectorAll('.edit-student-btn').forEach(b => b.addEventListener('click', () => openStudentModal('edit', parseInt(b.dataset.idx))));
    document.querySelectorAll('.del-student-btn').forEach(b => b.addEventListener('click', async () => {
        const idx = parseInt(b.dataset.idx);
        const st = MOCK_STUDENTS_POOL[idx];
        const warning = studentsFromDb && st.simulated ? '\n(ข้อมูลจำลอง)'
            : studentsFromDb
            ? `\nข้อมูลจะถูกลบออกจากฐานข้อมูลจริง รวมถึงเกรด การลงทะเบียน คำร้อง และใบตรวจสอบจบของนักศึกษาคนนี้ (ย้อนกลับไม่ได้)` : '';
        if (!confirm(`ต้องการลบ "${st.nameTh}" (${st.studentId}) หรือไม่?${warning}`)) return;
        if (studentsFromDb) {
            try {
                await fetchAPI(`/students/${encodeURIComponent(st.studentId)}`, 'DELETE', null, 10000);
            } catch (err) {
                showToast('error', esc(apiErrorText(err)));
                return;
            }
        }
        MOCK_STUDENTS_POOL.splice(idx, 1);
        renderManageStudents();
        renderAdminDashboard();
        showToast('success', esc(`ลบ ${st.nameTh} แล้ว`));
    }));
    document.querySelectorAll('.student-sec-select').forEach(sel => sel.addEventListener('change', async () => {
        const student = MOCK_STUDENTS_POOL.find(s => s.studentId === sel.dataset.sid);
        try {
            await fetchAPI(`/students/${encodeURIComponent(sel.dataset.sid)}/section`, 'PUT', { studentSection: sel.value }, 8000);
            if (student) student.studentSection = sel.value;
            showToast('success', esc(`ย้าย ${sel.dataset.sid} ไป Sec ${sel.value} แล้ว`));
        } catch (err) {
            if (student) sel.value = student.studentSection;
            showToast('error', esc(apiErrorText(err)));
        }
    }));
    bindGraduationAuditButtons();
    document.querySelectorAll('.reset-pw-btn').forEach(b => b.addEventListener('click', async () => {
        const sid = b.dataset.sid;
        if (!confirm(`รีเซ็ตรหัสผ่านของ ${b.dataset.sname} (${sid})?
รหัสผ่านใหม่จะเป็นรหัสนักศึกษา และนักศึกษาต้องตั้งรหัสใหม่เมื่อเข้าสู่ระบบ`)) return;
        try {
            const res = await fetchAPI(`/students/${encodeURIComponent(sid)}/reset-password`, 'POST', {}, 10000);
            showToast('success', esc(res.message));
        } catch (err) {
            showToast('error', esc(apiErrorText(err)));
        }
    }));
    document.querySelectorAll('.admin-imp-btn').forEach(b => {
        b.addEventListener('click', () => impersonateStudent(b.dataset.sid, b.dataset.sname));
    });
}

/* ============================================================
   GRADUATION AUDIT SHEETS — one JSON per student, same format as
   src/main/resources/graduation/<studentId>.json (see README.md there)
   ============================================================ */
const AUDIT_TEMPLATE_STUDENT = '6421100042';

function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function bindGraduationAuditButtons() {
    document.querySelectorAll('.audit-dl-btn').forEach(btn => btn.addEventListener('click', async () => {
        const sid = btn.dataset.sid;
        try {
            downloadJson(await fetchAPI(`/students/${encodeURIComponent(sid)}/graduation-audit/raw`, 'GET', null, 10000), `${sid}.json`);
        } catch (err) {
            if (!/HTTP 404/.test(err.message || '')) {
                showToast('error', esc(apiErrorText(err)));
                return;
            }
            // No sheet yet: hand out an existing one as the template to fill in
            try {
                const template = await fetchAPI(`/students/${AUDIT_TEMPLATE_STUDENT}/graduation-audit/raw`, 'GET', null, 10000);
                downloadJson(template, `${sid}-template.json`);
                showToast('info', esc(`${sid} ยังไม่มีใบตรวจสอบจบ ดาวน์โหลดใบของ ${AUDIT_TEMPLATE_STUDENT} ไปเป็นแม่แบบแทน แก้รายวิชา/เกรดแล้วอัปโหลดกลับได้`));
            } catch (e) {
                showToast('error', esc(apiErrorText(e)));
            }
        }
    }));

    const input = document.getElementById('auditUploadInput');
    document.querySelectorAll('.audit-ul-btn').forEach(btn => btn.addEventListener('click', () => {
        input.dataset.sid = btn.dataset.sid;
        input.value = '';
        input.click();
    }));
    input?.addEventListener('change', async () => {
        const file = input.files[0];
        const sid = input.dataset.sid;
        if (!file || !sid) return;
        let text;
        try {
            text = await file.text();
            JSON.parse(text);
        } catch (e) {
            showToast('error', 'ไฟล์ไม่ใช่ JSON ที่ถูกต้อง');
            return;
        }
        try {
            const summary = await fetchAPI(`/students/${encodeURIComponent(sid)}/graduation-audit`, 'PUT', text, 15000);
            showToast('success', esc(`อัปโหลดใบตรวจสอบจบของ ${sid} แล้ว: ${summary.totalEarnedCredits}/${summary.totalRequiredCredits} หน่วยกิต · GPA ${Number(summary.currentGpa).toFixed(2)} · ผ่าน ${summary.passedCategories}/${summary.totalCategories} หมวด · ${summary.status}`));
        } catch (err) {
            showToast('error', esc(apiErrorText(err)));
        }
    });
}

function openStudentModal(mode, idx) {
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const crudModal = document.getElementById('crudModal');
    
    const s = mode === 'edit' ? MOCK_STUDENTS_POOL[idx] : {};
    const advisorOpts = MOCK_ADVISORS.map(a => `<option value="${a.id}" ${s.advisor === a.id ? 'selected' : ''}>${esc(a.nameTh)}</option>`).join('');
    
    const currentCareer = s.careerPath || '';
    const isStandardCareer = STANDARD_CAREERS.some(c => c.id === currentCareer || c.name === currentCareer);
    const selectedCareerId = isStandardCareer ? currentCareer : (currentCareer ? 'other' : '');
    const customCareerVal = isStandardCareer ? '' : currentCareer;

    const careerOpts = `
        <option value="">-- เลือกสายอาชีพ --</option>
        ${STANDARD_CAREERS.map(c => `<option value="${esc(c.id)}" ${selectedCareerId === c.id ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('')}
    `;

    const empStatusOpts = `
        <option value="">-- เลือกสถานะการทำงาน --</option>
        ${EMPLOYMENT_STATUSES.map(es => `<option value="${esc(es.label)}" ${s.employmentStatus === es.label ? 'selected' : ''}>${esc(es.label)}</option>`).join('')}
    `;

    const salaryOpts = `
        <option value="">-- ไม่ระบุ --</option>
        ${SALARY_RANGES.map(sr => `<option value="${esc(sr)}" ${s.salaryRange === sr ? 'selected' : ''}>${esc(sr)}</option>`).join('')}
    `;

    modalTitle.textContent = mode === 'edit' ? 'แก้ไขนักศึกษา' : 'เพิ่มนักศึกษาใหม่';
    modalBody.innerHTML = `
        <div class="modal-field"><label>รหัสนักศึกษา</label><input id="mfSid" value="${esc(s.studentId || '')}" ${mode === 'edit' ? 'readonly style="opacity:0.6"' : ''}></div>
        <div class="modal-field"><label>ชื่อ-สกุล (ไทย)</label><input id="mfSnameTh" value="${esc(s.nameTh || '')}"></div>
        <div class="modal-field"><label>ชื่อ-สกุล (Eng)</label><input id="mfSnameEn" value="${esc(s.nameEn || '')}"></div>
        <div class="modal-field"><label>ชั้นปี</label><input id="mfSyear" type="number" min="1" max="6" value="${s.year || 1}"></div>
        <div class="modal-field"><label>GPA</label><input id="mfSgpa" type="number" step="0.01" min="0" max="4" value="${s.gpa || 0}"></div>
        <div class="modal-field"><label>สถานะ</label><select id="mfSstatus"><option value="กำลังศึกษา" ${s.status === 'กำลังศึกษา' ? 'selected' : ''}>กำลังศึกษา</option><option value="จบการศึกษา" ${s.status === 'จบการศึกษา' ? 'selected' : ''}>จบการศึกษา</option><option value="พักการศึกษา" ${s.status === 'พักการศึกษา' ? 'selected' : ''}>พักการศึกษา</option><option value="พ้นสภาพ" ${s.status === 'พ้นสภาพ' ? 'selected' : ''}>พ้นสภาพ</option></select></div>
        <div class="modal-field"><label>อาจารย์ที่ปรึกษา</label><select id="mfSadvisor">${advisorOpts}</select></div>
        ${studentsFromDb ? `<div class="modal-field"><label>Sec</label><select id="mfSsection">${['D1', 'D2'].map(g => `<option value="${g}" ${(s.studentSection || 'D1') === g ? 'selected' : ''}>${g}</option>`).join('')}</select></div>` : ''}
        ${studentsFromDb && mode !== 'edit' ? `<label style="display:flex;gap:8px;align-items:center;margin-top:8px;font-size:0.88rem;cursor:pointer"><input type="checkbox" id="mfSsimulated" checked style="width:auto"> เป็นข้อมูลจำลอง (แสดงในแดชบอร์ดอย่างเดียว ไม่มีบัญชีเข้าสู่ระบบและผลการเรียน)</label>` : ''}
        ${studentsFromDb ? '<p style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">💾 บันทึกลงฐานข้อมูลจริง · รหัสนักศึกษาเป็นตัวเลข 10 หลัก · ถ้าไม่ใช่ข้อมูลจำลอง นักศึกษาล็อกอินด้วยรหัสนี้ได้ทันที</p>' : ''}
        
        <div id="mfCareerGroup" style="${s.status === 'จบการศึกษา' ? 'display:block;' : 'display:none;'}margin-top:14px;padding:12px;background:rgba(59,130,246,0.05);border:1px dashed var(--primary);border-radius:var(--radius-md);">
            <div style="font-weight:700;color:var(--primary);margin-bottom:10px;display:flex;align-items:center;gap:6px">
                💼 ข้อมูลสายอาชีพและภาวะการมีงานทำ (บัณฑิต)
            </div>
            <div class="modal-field">
                <label>สถานะการทำงาน</label>
                <select id="mfSempStatus">${empStatusOpts}</select>
            </div>
            <div class="modal-field">
                <label>สายอาชีพหลัก</label>
                <select id="mfScareerSelect">${careerOpts}</select>
            </div>
            <div class="modal-field" id="mfScareerCustomWrap" style="${selectedCareerId === 'other' ? 'display:block;' : 'display:none;'}">
                <label>ระบุสายอาชีพเพิ่มเติม</label>
                <input id="mfScareerCustom" placeholder="พิมพ์ชื่อตำแหน่งหรือสายอาชีพ..." value="${esc(customCareerVal)}">
            </div>
            <div class="modal-field">
                <label>สถานที่ทำงาน / หน่วยงาน (ถ้ามี)</label>
                <input id="mfScompany" placeholder="เช่น Agoda, SCB TechX, ธุรกิจส่วนตัว..." value="${esc(s.companyName || '')}">
            </div>
            <div class="modal-field">
                <label>ช่วงเงินเดือน (ถ้ามี)</label>
                <select id="mfSsalary">${salaryOpts}</select>
            </div>
        </div>
    `;

    // Interactive event listeners
    const statusSelect = document.getElementById('mfSstatus');
    const careerGroup = document.getElementById('mfCareerGroup');
    const careerSelect = document.getElementById('mfScareerSelect');
    const careerCustomWrap = document.getElementById('mfScareerCustomWrap');

    statusSelect.addEventListener('change', () => {
        careerGroup.style.display = statusSelect.value === 'จบการศึกษา' ? 'block' : 'none';
    });

    careerSelect.addEventListener('change', () => {
        careerCustomWrap.style.display = careerSelect.value === 'other' ? 'block' : 'none';
    });
    
    const saveBtn = document.getElementById('modalSave');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    
    newSaveBtn.addEventListener('click', async () => {
        const statusVal = document.getElementById('mfSstatus').value;
        const careerSelectVal = document.getElementById('mfScareerSelect').value;
        const careerCustomVal = document.getElementById('mfScareerCustom').value.trim();
        let finalCareer = careerSelectVal === 'other' ? careerCustomVal : careerSelectVal;
        if (statusVal !== 'จบการศึกษา') {
            finalCareer = undefined;
        }

        const data = {
            studentId: document.getElementById('mfSid').value.trim(),
            nameTh: document.getElementById('mfSnameTh').value.trim(),
            nameEn: document.getElementById('mfSnameEn').value.trim(),
            year: parseInt(document.getElementById('mfSyear').value) || 1,
            gpa: parseFloat(document.getElementById('mfSgpa').value) || 0,
            status: statusVal,
            advisor: document.getElementById('mfSadvisor').value,
            careerPath: finalCareer || undefined,
            employmentStatus: document.getElementById('mfSempStatus').value || undefined,
            companyName: document.getElementById('mfScompany').value.trim() || undefined,
            salaryRange: document.getElementById('mfSsalary').value || undefined,
        };
        if (!data.studentId || !data.nameTh) return alert('กรุณากรอกข้อมูลที่จำเป็น');

        if (studentsFromDb) {
            const body = {
                studentId: data.studentId,
                nameTh: data.nameTh,
                nameEn: data.nameEn,
                year: data.year,
                gpa: data.gpa,
                status: data.status,
                advisorId: data.advisor || '',
                studentSection: document.getElementById('mfSsection')?.value,
                simulated: document.getElementById('mfSsimulated')?.checked ?? undefined,
                // Career fields only apply to graduates; '' clears them
                careerPath: data.careerPath || '',
                employmentStatus: data.status === 'จบการศึกษา' ? (data.employmentStatus || '') : '',
                companyName: data.status === 'จบการศึกษา' ? (data.companyName || '') : '',
                salaryRange: data.status === 'จบการศึกษา' ? (data.salaryRange || '') : '',
            };
            try {
                const saved = mode === 'edit'
                    ? await fetchAPI(`/students/${encodeURIComponent(data.studentId)}`, 'PUT', body, 10000)
                    : await fetchAPI('/students', 'POST', body, 10000);
                if (mode === 'edit') { MOCK_STUDENTS_POOL[idx] = toPoolStudent(saved); }
                else { MOCK_STUDENTS_POOL.push(toPoolStudent(saved)); }
            } catch (err) {
                showToast('error', esc(apiErrorText(err)));
                return;
            }
        } else {
            if (mode === 'edit') { MOCK_STUDENTS_POOL[idx] = data; }
            else { MOCK_STUDENTS_POOL.push(data); }
        }

        crudModal.classList.remove('open');
        renderManageStudents();
        renderAdminDashboard();
        showToast('success', !studentsFromDb ? 'บันทึกข้อมูลนักศึกษาเรียบร้อย (โหมดออฟไลน์ ไม่ได้บันทึกลงฐานข้อมูล)'
            : mode === 'edit' ? 'บันทึกข้อมูลนักศึกษาลงฐานข้อมูลเรียบร้อย'
            : document.getElementById('mfSsimulated')?.checked ? esc(`เพิ่มนักศึกษาจำลอง ${data.studentId} แล้ว`)
            : esc(`เพิ่มนักศึกษาแล้ว · เข้าสู่ระบบด้วยชื่อผู้ใช้ ${data.studentId} รหัสผ่านเริ่มต้น ${data.studentId} (ต้องเปลี่ยนเมื่อเข้าครั้งแรก)`));
    });
    
    crudModal.classList.add('open');
}

// Global modal close logic for any modal
document.addEventListener('DOMContentLoaded', () => {
    const crudModal = document.getElementById('crudModal');
    const modalClose = document.getElementById('modalClose');
    const modalCancel = document.getElementById('modalCancel');

    const closeModal = () => { crudModal.classList.remove('open'); };
    if(modalClose) modalClose.addEventListener('click', closeModal);
    if(modalCancel) modalCancel.addEventListener('click', closeModal);
    if(crudModal) crudModal.addEventListener('click', (e) => { if (e.target === crudModal) closeModal(); });
});

/* ============================================================
   MANAGE PETITIONS (Admin Petition Logs)
   ============================================================ */
function renderManagePetitions() {
    const container = document.getElementById('managePetitionsContent');
    if (!container) return;

    const totalCount = MOCK_PETITIONS_LOG.length;
    const pendingCount = MOCK_PETITIONS_LOG.filter(p => p.status === 'รอดำเนินการ').length;
    const approvedCount = MOCK_PETITIONS_LOG.filter(p => p.status === 'อนุมัติ').length;
    const rejectedCount = MOCK_PETITIONS_LOG.filter(p => p.status === 'ปฏิเสธ').length;

    // Batches from student IDs in petitions
    const allBatches = [...new Set(MOCK_PETITIONS_LOG.map(p => getBatch(p.studentId)))].sort().reverse();
    const activeBatches = resolveBatchRange(adminPetitionsBatch, allBatches, MOCK_PETITIONS_LOG);

    const last4Label = allBatches.length >= 4 ? `⏱️ 4 ปีล่าสุด (รุ่น ${allBatches.slice(0, 4).reverse().join('-')})` : null;
    const last3Label = allBatches.length >= 3 ? `⏱️ 3 ปีล่าสุด (รุ่น ${allBatches.slice(0, 3).reverse().join('-')})` : null;

    const batchFilterOpts = [
        `<option value="all" ${adminPetitionsBatch === 'all' ? 'selected' : ''}>ทุกรุ่น / ทุกปีการศึกษา (All Batches)</option>`,
        last4Label ? `<option value="last4" ${adminPetitionsBatch === 'last4' ? 'selected' : ''}>${last4Label}</option>` : '',
        last3Label ? `<option value="last3" ${adminPetitionsBatch === 'last3' ? 'selected' : ''}>${last3Label}</option>` : '',
        `<option disabled>─── แยกตามรุ่น ───</option>`,
        ...allBatches.map(b => `<option value="${b}" ${adminPetitionsBatch === b ? 'selected' : ''}>รุ่น ${b}</option>`),
    ].filter(Boolean).join('');

    // Types
    const types = [...new Set(MOCK_PETITIONS_LOG.map(p => p.type))];
    const typeFilterOpts = [
        `<option value="all" ${adminPetitionsType === 'all' ? 'selected' : ''}>ทุกประเภทคำร้อง (All Types)</option>`,
        ...types.map(t => `<option value="${t}" ${adminPetitionsType === t ? 'selected' : ''}>${esc(t)}</option>`),
    ].join('');

    // Filter logic
    let filtered = MOCK_PETITIONS_LOG.filter(p => {
        const matchBatch = activeBatches.includes(getBatch(p.studentId));
        const matchType = adminPetitionsType === 'all' || p.type === adminPetitionsType;
        const matchStatus = adminPetitionsStatus === 'all' || p.status === adminPetitionsStatus;
        return matchBatch && matchType && matchStatus;
    });

    if (adminPetitionsSearch) {
        const q = adminPetitionsSearch.toLowerCase();
        filtered = filtered.filter(p =>
            p.id.toLowerCase().includes(q) ||
            p.studentId.includes(q) ||
            p.studentName.toLowerCase().includes(q) ||
            p.title.toLowerCase().includes(q)
        );
    }

    // Pagination calculations
    const totalPetitions = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalPetitions / adminPetitionsPageSize));
    if (adminPetitionsPage > totalPages) adminPetitionsPage = totalPages;
    if (adminPetitionsPage < 1) adminPetitionsPage = 1;

    const startIndex = (adminPetitionsPage - 1) * adminPetitionsPageSize;
    const endIndex = Math.min(startIndex + adminPetitionsPageSize, totalPetitions);
    const pagedPetitions = filtered.slice(startIndex, endIndex);

    const rows = pagedPetitions.map((p) => {
        const realIdx = MOCK_PETITIONS_LOG.indexOf(p);
        const batch = getBatch(p.studentId);
        return `
        <tr>
            <td><strong class="petition-log-id">${esc(p.id)}</strong></td>
            <td class="hide-mobile"><span class="petition-log-date">${esc(p.submittedAt)}</span></td>
            <td>
                <div class="petition-student-info">
                    <strong>${esc(p.studentName)}</strong>
                    <div class="petition-student-meta">
                        <span>${esc(p.studentId)}</span>
                        <span class="batch-tag">รุ่น ${batch}</span>
                    </div>
                </div>
            </td>
            <td><span class="petition-type-badge">${esc(p.type)}</span></td>
            <td class="hide-mobile"><span class="petition-log-title" title="${esc(p.title)}">${esc(p.title)}</span></td>
            <td style="text-align:center" class="hide-mobile">
                ${p.attachment ? `
                    <span class="petition-pdf-badge" title="${esc(p.attachment)}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        PDF
                    </span>
                ` : '<span style="color:var(--g-400)">-</span>'}
            </td>
            <td><span class="badge ${statusBadge(p.status)}">${esc(p.status)}</span></td>
            <td>
                <button class="btn btn-sm btn-info view-petition-btn" data-idx="${realIdx}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    ดู/จัดการ
                </button>
            </td>
        </tr>`;
    }).join('');

    let selectedPetBatchDesc;
    if (adminPetitionsBatch === 'all') selectedPetBatchDesc = 'ทุกรุ่น';
    else if (adminPetitionsBatch === 'last4') selectedPetBatchDesc = `4 ปีล่าสุด (${activeBatches.slice().reverse().join(', ')})`;
    else if (adminPetitionsBatch === 'last3') selectedPetBatchDesc = `3 ปีล่าสุด (${activeBatches.slice().reverse().join(', ')})`;
    else selectedPetBatchDesc = `รุ่น ${adminPetitionsBatch}`;

    const paginationHtml = totalPetitions > 0 ? `
        <div class="table-pagination-bar">
            <div class="pagination-info">
                แสดงรายการที่ <strong>${startIndex + 1} - ${endIndex}</strong> จากทั้งหมด <strong>${totalPetitions}</strong> รายการ
                <span class="pagination-size-select">
                    (หน้าละ 
                    <select class="page-size-select" id="adminPetPageSize">
                        <option value="5" ${adminPetitionsPageSize === 5 ? 'selected' : ''}>5</option>
                        <option value="10" ${adminPetitionsPageSize === 10 ? 'selected' : ''}>10</option>
                        <option value="20" ${adminPetitionsPageSize === 20 ? 'selected' : ''}>20</option>
                    </select> รายการ)
                </span>
            </div>
            <div class="pagination-controls">
                <button class="pagination-btn" id="adminPetPrevPage" ${adminPetitionsPage <= 1 ? 'disabled' : ''}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="15 18 9 12 15 6"/></svg>
                    ก่อนหน้า
                </button>
                <div class="pagination-pages" id="adminPetPages">
                    ${renderPaginationPagesHtml(adminPetitionsPage, totalPages, 'admin-pet-page-btn')}
                </div>
                <button class="pagination-btn" id="adminPetNextPage" ${adminPetitionsPage >= totalPages ? 'disabled' : ''}>
                    ถัดไป
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
            </div>
        </div>` : '';

    container.innerHTML = `
        <div class="stat-row">
            <div class="stat-card">
                <div class="stat-icon purple">📑</div>
                <div>
                    <div class="stat-value">${totalCount}</div>
                    <div class="stat-label">คำร้องทั้งหมด</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon amber">⏳</div>
                <div>
                    <div class="stat-value">${pendingCount}</div>
                    <div class="stat-label">รอดำเนินการ</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon green">✅</div>
                <div>
                    <div class="stat-value">${approvedCount}</div>
                    <div class="stat-label">อนุมัติแล้ว</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon red">❌</div>
                <div>
                    <div class="stat-value">${rejectedCount}</div>
                    <div class="stat-label">ปฏิเสธ/ไม่อนุมัติ</div>
                </div>
            </div>
        </div>

        <div class="batch-filter-bar petition-filter-bar">
            <div class="filter-group">
                <label>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                    รุ่น
                </label>
                <select class="batch-select" id="adminPetBatchFilter">${batchFilterOpts}</select>
            </div>

            <div class="filter-group">
                <label>ประเภท</label>
                <select class="batch-select" id="adminPetTypeFilter">${typeFilterOpts}</select>
            </div>

            <div class="filter-group">
                <label>สถานะ</label>
                <select class="batch-select" id="adminPetStatusFilter">
                    <option value="all" ${adminPetitionsStatus === 'all' ? 'selected' : ''}>ทุกสถานะ (All Status)</option>
                    <option value="รอดำเนินการ" ${adminPetitionsStatus === 'รอดำเนินการ' ? 'selected' : ''}>⏳ รอดำเนินการ</option>
                    <option value="อนุมัติ" ${adminPetitionsStatus === 'อนุมัติ' ? 'selected' : ''}>✅ อนุมัติ</option>
                    <option value="ปฏิเสธ" ${adminPetitionsStatus === 'ปฏิเสธ' ? 'selected' : ''}>❌ ปฏิเสธ</option>
                </select>
            </div>

            <div class="filter-result-count">
                กรอง: <strong>${selectedPetBatchDesc}</strong> (แสดง <strong>${filtered.length}</strong> จาก ${totalCount} รายการ)
            </div>

            <div class="toolbar-search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" id="adminPetSearchInput" placeholder="ค้นหารหัสคำร้อง, นศ., ชื่อเรื่อง..." value="${esc(adminPetitionsSearch)}">
            </div>
        </div>

        <div class="card" style="padding:0;overflow:hidden">
            <div class="table-wrap">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>รหัสคำร้อง</th>
                            <th class="hide-mobile">วันที่ยื่น</th>
                            <th>นักศึกษา</th>
                            <th>ประเภทคำร้อง</th>
                            <th class="hide-mobile">ชื่อหัวข้อ / เรื่อง</th>
                            <th style="text-align:center" class="hide-mobile">เอกสาร</th>
                            <th>สถานะ</th>
                            <th>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.length > 0 ? rows : `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted)">ไม่พบข้อมูลคำร้องที่ตรงกับเงื่อนไขการค้นหา</td></tr>`}
                    </tbody>
                </table>
            </div>
            ${paginationHtml}
        </div>
    `;

    // Event listeners
    document.getElementById('adminPetBatchFilter').addEventListener('change', (e) => {
        adminPetitionsBatch = e.target.value;
        adminPetitionsPage = 1;
        renderManagePetitions();
    });

    document.getElementById('adminPetTypeFilter').addEventListener('change', (e) => {
        adminPetitionsType = e.target.value;
        adminPetitionsPage = 1;
        renderManagePetitions();
    });

    document.getElementById('adminPetStatusFilter').addEventListener('change', (e) => {
        adminPetitionsStatus = e.target.value;
        adminPetitionsPage = 1;
        renderManagePetitions();
    });

    const searchInput = document.getElementById('adminPetSearchInput');
    searchInput.addEventListener('input', debounce((e) => {
        adminPetitionsSearch = e.target.value.trim();
        adminPetitionsPage = 1;
        renderManagePetitions();
        const newSearchInput = document.getElementById('adminPetSearchInput');
        if (newSearchInput) {
            newSearchInput.focus();
            newSearchInput.setSelectionRange(adminPetitionsSearch.length, adminPetitionsSearch.length);
        }
    }, 300));

    const pageSizeSelect = document.getElementById('adminPetPageSize');
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', (e) => {
            adminPetitionsPageSize = parseInt(e.target.value, 10);
            adminPetitionsPage = 1;
            renderManagePetitions();
        });
    }

    const prevBtn = document.getElementById('adminPetPrevPage');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (adminPetitionsPage > 1) {
                adminPetitionsPage--;
                renderManagePetitions();
            }
        });
    }
    const nextBtn = document.getElementById('adminPetNextPage');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (adminPetitionsPage < totalPages) {
                adminPetitionsPage++;
                renderManagePetitions();
            }
        });
    }

    document.querySelectorAll('.admin-pet-page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = parseInt(btn.dataset.page, 10);
            if (!isNaN(page) && page !== adminPetitionsPage) {
                adminPetitionsPage = page;
                renderManagePetitions();
            }
        });
    });

    document.querySelectorAll('.view-petition-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx, 10);
            openPetitionDetailModal(idx);
        });
    });
}

function openPetitionDetailModal(idx) {
    const p = MOCK_PETITIONS_LOG[idx];
    if (!p) return;

    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const crudModal = document.getElementById('crudModal');

    // Find student info if available
    const student = MOCK_STUDENTS_POOL.find(s => s.studentId === p.studentId);
    const advisor = student ? (MOCK_ADVISORS.find(a => a.id === student.advisor)?.nameTh || student.advisor) : '-';

    modalTitle.innerHTML = `<span>รายละเอียดคำร้อง: <strong>${esc(p.id)}</strong></span>`;
    modalBody.innerHTML = `
        <div class="petition-detail-modal">
            <div class="profile-detail-grid" style="margin-bottom:16px">
                <div class="profile-item"><span class="label">รหัสคำร้อง</span><span class="value"><strong>${esc(p.id)}</strong></span></div>
                <div class="profile-item"><span class="label">วันที่ยื่น</span><span class="value">${esc(p.submittedAt)}</span></div>
                <div class="profile-item"><span class="label">นักศึกษา</span><span class="value">${esc(p.studentName)} (${esc(p.studentId)})</span></div>
                <div class="profile-item"><span class="label">อาจารย์ที่ปรึกษา</span><span class="value">${esc(advisor)}</span></div>
                <div class="profile-item" style="grid-column: 1 / -1"><span class="label">ประเภทคำร้อง</span><span class="value">${esc(p.type)}</span></div>
                <div class="profile-item" style="grid-column: 1 / -1"><span class="label">ชื่อหัวข้อ/เรื่อง</span><span class="value"><strong>${esc(p.title)}</strong></span></div>
            </div>

            <div class="modal-field">
                <label>รายละเอียด / เหตุผล</label>
                <div class="petition-detail-box">${esc(p.details || 'ไม่มีรายละเอียดเพิ่มเติม')}</div>
            </div>

            ${p.attachment ? `
            <div class="modal-field">
                <label>ไฟล์แนบ</label>
                <div class="petition-file-selected" style="pointer-events:all;cursor:pointer;" onclick="alert('จำลองการเปิดไฟล์: ${esc(p.attachment)}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span>${esc(p.attachment)}</span>
                    <span class="btn btn-sm btn-ghost" style="margin-left:auto">เปิดดูไฟล์ PDF</span>
                </div>
            </div>
            ` : ''}

            <hr style="border:0;border-top:1px solid var(--g-200);margin:16px 0">

            <div class="modal-field">
                <label for="adminPetitionStatusSelect"><strong>การพิจารณา / ปรับเปลี่ยนสถานะ</strong></label>
                <select id="adminPetitionStatusSelect" style="width:100%;padding:10px 14px;border:2px solid var(--g-200);border-radius:var(--radius-md);font-size:0.9rem">
                    <option value="รอดำเนินการ" ${p.status === 'รอดำเนินการ' ? 'selected' : ''}>⏳ รอดำเนินการ (Pending)</option>
                    <option value="อนุมัติ" ${p.status === 'อนุมัติ' ? 'selected' : ''}>✅ อนุมัติ (Approved)</option>
                    <option value="ปฏิเสธ" ${p.status === 'ปฏิเสธ' ? 'selected' : ''}>❌ ปฏิเสธ (Rejected)</option>
                </select>
            </div>

            <div class="modal-field">
                <label for="adminPetitionComment">หมายเหตุ / ความเห็นของแอดมิน</label>
                <textarea id="adminPetitionComment" rows="3" placeholder="ระบุเหตุผลหรือข้อความแจ้งนักศึกษา..." style="width:100%;padding:10px 14px;border:2px solid var(--g-200);border-radius:var(--radius-md);font-family:inherit;font-size:0.88rem">${esc(p.adminComment || '')}</textarea>
            </div>

            <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
                <button type="button" class="btn btn-success" id="adminQuickApproveBtn" style="flex:1">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><polyline points="20 6 9 17 4 12"/></svg>
                    อนุมัติคำร้อง (Approve)
                </button>
                <button type="button" class="btn btn-danger" id="adminQuickRejectBtn" style="flex:1">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    ปฏิเสธคำร้อง (Reject)
                </button>
            </div>
        </div>
    `;

    const saveBtn = document.getElementById('modalSave');
    const newSaveBtn = saveBtn.cloneNode(true);
    newSaveBtn.textContent = 'บันทึกการพิจารณา';
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

    async function handlePetitionStatusUpdate(newStatus, newComment) {
        newSaveBtn.disabled = true;
        newSaveBtn.innerHTML = `<span class="petition-spinner"></span> กำลังบันทึก...`;

        try {
            console.log(`📤 [Admin] Updating Petition ${p.id} status to "${newStatus}" in PostgreSQL...`);
            const updated = await fetchAPI(`/petitions/${encodeURIComponent(p.id)}/status`, 'PATCH', {
                status: newStatus,
                adminComment: newComment,
            });
            console.log('✅ [Admin] Petition status updated successfully in PostgreSQL:', updated);

            p.status = updated.status || newStatus;
            p.adminComment = (updated.adminComment !== undefined) ? updated.adminComment : newComment;

            crudModal.classList.remove('open');
            renderManagePetitions();
            renderAdminDashboard();

            showToast('success', `อัปเดตสถานะคำร้อง ${p.id} เป็น "${p.status}" สำเร็จแล้ว ✅`);
        } catch (err) {
            console.error('❌ [Admin] Failed to update petition status in Backend:', err);
            showToast('error', `ไม่สามารถอัปเดตสถานะได้: ${err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ'}`);
        } finally {
            newSaveBtn.disabled = false;
            newSaveBtn.textContent = 'บันทึกการพิจารณา';
        }
    }

    newSaveBtn.addEventListener('click', () => {
        const newStatus = document.getElementById('adminPetitionStatusSelect').value;
        const newComment = document.getElementById('adminPetitionComment').value.trim();
        handlePetitionStatusUpdate(newStatus, newComment);
    });

    document.getElementById('adminQuickApproveBtn')?.addEventListener('click', () => {
        const comment = document.getElementById('adminPetitionComment').value.trim() || 'อนุมัติตามที่เสนอ (เอกสารครบถ้วน)';
        document.getElementById('adminPetitionStatusSelect').value = 'อนุมัติ';
        handlePetitionStatusUpdate('อนุมัติ', comment);
    });

    document.getElementById('adminQuickRejectBtn')?.addEventListener('click', () => {
        const comment = document.getElementById('adminPetitionComment').value.trim() || 'ไม่อนุมัติ / เอกสารหรือข้อมูลไม่ครบถ้วน';
        document.getElementById('adminPetitionStatusSelect').value = 'ปฏิเสธ';
        handlePetitionStatusUpdate('ปฏิเสธ', comment);
    });

    crudModal.classList.add('open');
}

