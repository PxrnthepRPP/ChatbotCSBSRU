import { esc, statusBadge, getBatch, debounce, showToast } from '../utils.js';
import { impersonateStudent } from '../auth.js';
import { fetchAPI } from '../api.js';
import { loadComponentCSS } from '../css-loader.js';
import { renderStatusDonutChart } from '../components/statusChart.js';
import { renderCareerDataList } from '../components/careerList.js';

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
let adminLastSelectedBatch = 'all';
let adminSearchQuery = '';
let adminPetitionsBatch = 'all';
let adminPetitionsType = 'all';
let adminPetitionsStatus = 'all';
let adminPetitionsSearch = '';

export async function initAdminDashboard() {
    // 1. Initial render with local/fallback data
    renderAdminDashboard();
    renderManageAdvisors();
    renderManageStudents();
    renderManagePetitions();

    // 2. Fetch live data from Spring Boot REST API
    try {
        console.log('🔄 [Admin] Connecting to Spring Boot Backend API...');
        const [liveStudents, livePetitions] = await Promise.all([
            fetchAPI('/students').catch(() => null),
            fetchAPI('/petitions').catch(() => null),
        ]);

        if (Array.isArray(liveStudents) && liveStudents.length > 0) {
            console.log('✅ [Admin] Loaded Live Students from Backend API:', liveStudents);
            const formatted = liveStudents.map(s => ({
                studentId: s.studentId,
                nameTh: s.nameTh,
                nameEn: s.nameEn,
                year: s.year,
                gpa: s.gpa,
                status: s.status,
                careerPath: s.careerPath || '',
                advisor: (s.advisor && typeof s.advisor === 'object') ? s.advisor.id : (s.advisor || 'ADV001'),
            }));
            MOCK_STUDENTS_POOL.splice(0, MOCK_STUDENTS_POOL.length, ...formatted);
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

function renderAdminDashboard() {
    const container = document.getElementById('adminDashboardContent');
    if (!container) return;

    const batches = [...new Set(MOCK_STUDENTS_POOL.map(s => getBatch(s.studentId)))].sort().reverse();
    
    const batchOpts = [
        `<option value="all" ${adminDashboardSelectedBatch === 'all' ? 'selected' : ''}>ทุกรุ่น / ทุกปีการศึกษา (All Batches) — รวม ${MOCK_STUDENTS_POOL.length} คน</option>`,
        ...batches.map(b => {
            const count = MOCK_STUDENTS_POOL.filter(s => getBatch(s.studentId) === b).length;
            const yearBE = 2500 + parseInt(b, 10);
            return `<option value="${b}" ${adminDashboardSelectedBatch === b ? 'selected' : ''}>รุ่น ${b} (เข้าปีการศึกษา ${yearBE}) — ${count} คน</option>`;
        }),
    ].join('');

    const filteredStudents = adminDashboardSelectedBatch === 'all'
        ? MOCK_STUDENTS_POOL
        : MOCK_STUDENTS_POOL.filter(s => getBatch(s.studentId) === adminDashboardSelectedBatch);

    const totalStudents = filteredStudents.length;
    const studying = filteredStudents.filter(s => s.status === 'กำลังศึกษา').length;
    const graduated = filteredStudents.filter(s => s.status === 'จบการศึกษา').length;
    const onLeave = filteredStudents.filter(s => s.status === 'พักการศึกษา').length;
    const dismissed = filteredStudents.filter(s => s.status === 'พ้นสภาพ').length;
    
    const advisorsCount = adminDashboardSelectedBatch === 'all'
        ? MOCK_ADVISORS.length
        : new Set(filteredStudents.map(s => s.advisor)).size;

    const selectedBatchText = adminDashboardSelectedBatch === 'all'
        ? 'ทุกรุ่น / ทุกปีการศึกษา (All Batches)'
        : `รุ่น ${adminDashboardSelectedBatch} (เข้าปีการศึกษา 25${adminDashboardSelectedBatch})`;

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

        <div class="stat-row">
            <div class="stat-card">
                <div class="stat-icon purple">👩‍🏫</div>
                <div>
                    <div class="stat-value">${advisorsCount}</div>
                    <div class="stat-label">อาจารย์ที่ปรึกษา${adminDashboardSelectedBatch !== 'all' ? ' (ประจำรุ่น)' : ''}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon blue">👨‍🎓</div>
                <div>
                    <div class="stat-value">${totalStudents}</div>
                    <div class="stat-label">นักศึกษา${adminDashboardSelectedBatch !== 'all' ? 'รุ่นนี้' : 'ทั้งหมด'}</div>
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

        <div class="dashboard-grid">
            <div id="statusChartContainer"></div>
            <div id="careerListContainer"></div>
        </div>

        <div class="card">
            <div class="card-title">📊 ภาพรวมระบบ — ${selectedBatchText}</div>
            <p style="font-size:0.88rem;color:var(--text-muted);line-height:1.7">ระบบสารสนเทศนักศึกษา BSRU สาขาวิทยาการคอมพิวเตอร์ — สถิติของ <strong>${selectedBatchText}</strong> รวมทั้งสิ้น <strong>${totalStudents}</strong> คน (กำลังศึกษา ${studying} คน, จบการศึกษา ${graduated} คน, พักการศึกษา ${onLeave} คน, พ้นสภาพ ${dismissed} คน)</p>
        </div>
    `;

    document.getElementById('adminDashboardBatchSelect').addEventListener('change', (e) => {
        adminDashboardSelectedBatch = e.target.value;
        renderAdminDashboard();
    });

    // Load chart CSS and render both components
    loadComponentCSS('statusChart').then(() => {
        renderStatusDonutChart('statusChartContainer', filteredStudents);
        renderCareerDataList('careerListContainer', filteredStudents);
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
    const batches = [...new Set(MOCK_STUDENTS_POOL.map(s => getBatch(s.studentId)))].sort().reverse();

    const filterOpts = [
        `<option value="all" ${adminLastSelectedBatch === 'all' ? 'selected' : ''}>ทั้งหมด (All Batches)</option>`,
        ...batches.map(b => {
            const count = MOCK_STUDENTS_POOL.filter(s => getBatch(s.studentId) === b).length;
            return `<option value="${b}" ${adminLastSelectedBatch === b ? 'selected' : ''}>รุ่น ${b} (Batch ${b}) — ${count} คน</option>`;
        }),
    ].join('');

    let filtered = adminLastSelectedBatch === 'all'
        ? MOCK_STUDENTS_POOL
        : MOCK_STUDENTS_POOL.filter(s => getBatch(s.studentId) === adminLastSelectedBatch);

    if (adminSearchQuery) {
        const q = adminSearchQuery.toLowerCase();
        filtered = filtered.filter(s => s.studentId.includes(q) || s.nameTh.toLowerCase().includes(q) || (s.nameEn && s.nameEn.toLowerCase().includes(q)));
    }

    const rows = filtered.map((s) => {
        const realIdx = MOCK_STUDENTS_POOL.indexOf(s);
        const batch = getBatch(s.studentId);
        return `
        <tr>
            <td><strong>${esc(s.studentId)}</strong></td>
            <td>${esc(s.nameTh)} <span class="batch-tag">รุ่น ${batch}</span></td>
            <td style="text-align:center" class="hide-mobile">ปี ${s.year}</td>
            <td style="text-align:center"><strong>${s.gpa.toFixed(2)}</strong></td>
            <td><span class="badge ${statusBadge(s.status)}">${esc(s.status)}</span></td>
            <td>
                <div class="action-btns">
                    <button class="btn btn-sm btn-orange admin-imp-btn" data-sid="${s.studentId}" data-sname="${esc(s.nameTh)}">จำลอง</button>
                    <button class="btn btn-sm btn-warning edit-student-btn" data-idx="${realIdx}">แก้ไข</button>
                    <button class="btn btn-sm btn-danger del-student-btn" data-idx="${realIdx}">ลบ</button>
                </div>
            </td>
        </tr>`;
    }).join('');

    document.getElementById('manageStudentsContent').innerHTML = `
        <div class="batch-filter-bar">
            <label>กรองตามรุ่น</label>
            <select class="batch-select" id="adminBatchFilter">${filterOpts}</select>
            <div class="filter-result-count">แสดง <strong>${filtered.length}</strong> จาก ${MOCK_STUDENTS_POOL.length} คน</div>
            <div class="toolbar-search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" id="adminStudentSearch" placeholder="ค้นหารหัสนักศึกษา, ชื่อ..." value="${esc(adminSearchQuery)}">
            </div>
            <button class="btn btn-success" id="addStudentBtn">เพิ่มนักศึกษา</button>
        </div>
        <div class="card">
            <div class="table-wrap">
                <table class="data-table">
                    <thead><tr><th>รหัสนักศึกษา</th><th>ชื่อ-สกุล</th><th style="text-align:center" class="hide-mobile">ชั้นปี</th><th style="text-align:center">GPA</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById('adminBatchFilter').addEventListener('change', (e) => {
        adminLastSelectedBatch = e.target.value;
        renderManageStudents();
    });

    const searchInput = document.getElementById('adminStudentSearch');
    searchInput.addEventListener('input', debounce((e) => {
        adminSearchQuery = e.target.value.trim();
        renderManageStudents();
        // Restore focus to input after re-render
        const newSearchInput = document.getElementById('adminStudentSearch');
        if (newSearchInput) {
            newSearchInput.focus();
            newSearchInput.setSelectionRange(adminSearchQuery.length, adminSearchQuery.length);
        }
    }, 300));

    document.getElementById('addStudentBtn').addEventListener('click', () => openStudentModal('add'));
    document.querySelectorAll('.edit-student-btn').forEach(b => b.addEventListener('click', () => openStudentModal('edit', parseInt(b.dataset.idx))));
    document.querySelectorAll('.del-student-btn').forEach(b => b.addEventListener('click', () => {
        const idx = parseInt(b.dataset.idx);
        if (confirm(`ต้องการลบ "${MOCK_STUDENTS_POOL[idx].nameTh}" หรือไม่?`)) {
            MOCK_STUDENTS_POOL.splice(idx, 1);
            renderManageStudents();
            renderAdminDashboard();
        }
    }));
    document.querySelectorAll('.admin-imp-btn').forEach(b => {
        b.addEventListener('click', () => impersonateStudent(b.dataset.sid, b.dataset.sname));
    });
}

function openStudentModal(mode, idx) {
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const crudModal = document.getElementById('crudModal');
    
    const s = mode === 'edit' ? MOCK_STUDENTS_POOL[idx] : {};
    const advisorOpts = MOCK_ADVISORS.map(a => `<option value="${a.id}" ${s.advisor === a.id ? 'selected' : ''}>${esc(a.nameTh)}</option>`).join('');
    modalTitle.textContent = mode === 'edit' ? 'แก้ไขนักศึกษา' : 'เพิ่มนักศึกษาใหม่';
    modalBody.innerHTML = `
        <div class="modal-field"><label>รหัสนักศึกษา</label><input id="mfSid" value="${esc(s.studentId || '')}" ${mode === 'edit' ? 'readonly style="opacity:0.6"' : ''}></div>
        <div class="modal-field"><label>ชื่อ-สกุล (ไทย)</label><input id="mfSnameTh" value="${esc(s.nameTh || '')}"></div>
        <div class="modal-field"><label>ชื่อ-สกุล (Eng)</label><input id="mfSnameEn" value="${esc(s.nameEn || '')}"></div>
        <div class="modal-field"><label>ชั้นปี</label><input id="mfSyear" type="number" min="1" max="6" value="${s.year || 1}"></div>
        <div class="modal-field"><label>GPA</label><input id="mfSgpa" type="number" step="0.01" min="0" max="4" value="${s.gpa || 0}"></div>
        <div class="modal-field"><label>สถานะ</label><select id="mfSstatus"><option value="กำลังศึกษา" ${s.status === 'กำลังศึกษา' ? 'selected' : ''}>กำลังศึกษา</option><option value="จบการศึกษา" ${s.status === 'จบการศึกษา' ? 'selected' : ''}>จบการศึกษา</option><option value="พักการศึกษา" ${s.status === 'พักการศึกษา' ? 'selected' : ''}>พักการศึกษา</option><option value="พ้นสภาพ" ${s.status === 'พ้นสภาพ' ? 'selected' : ''}>พ้นสภาพ</option></select></div>
        <div class="modal-field"><label>อาจารย์ที่ปรึกษา</label><select id="mfSadvisor">${advisorOpts}</select></div>
        <div class="modal-field"><label>สายอาชีพ (เฉพาะจบการศึกษา)</label><input id="mfScareer" placeholder="เช่น Full-Stack Developer, DevOps..." value="${esc(s.careerPath || '')}"></div>
    `;
    
    const saveBtn = document.getElementById('modalSave');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    
    newSaveBtn.addEventListener('click', () => {
        const data = {
            studentId: document.getElementById('mfSid').value.trim(),
            nameTh: document.getElementById('mfSnameTh').value.trim(),
            nameEn: document.getElementById('mfSnameEn').value.trim(),
            year: parseInt(document.getElementById('mfSyear').value) || 1,
            gpa: parseFloat(document.getElementById('mfSgpa').value) || 0,
            status: document.getElementById('mfSstatus').value,
            advisor: document.getElementById('mfSadvisor').value,
            careerPath: document.getElementById('mfScareer').value.trim() || undefined,
        };
        if (!data.studentId || !data.nameTh) return alert('กรุณากรอกข้อมูลที่จำเป็น');
        if (mode === 'edit') { MOCK_STUDENTS_POOL[idx] = data; }
        else { MOCK_STUDENTS_POOL.push(data); }
        crudModal.classList.remove('open');
        renderManageStudents();
        renderAdminDashboard();
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
    const batches = [...new Set(MOCK_PETITIONS_LOG.map(p => getBatch(p.studentId)))].sort().reverse();
    const batchFilterOpts = [
        `<option value="all" ${adminPetitionsBatch === 'all' ? 'selected' : ''}>ทุกรุ่น (All Batches)</option>`,
        ...batches.map(b => `<option value="${b}" ${adminPetitionsBatch === b ? 'selected' : ''}>รุ่น ${b}</option>`),
    ].join('');

    // Types
    const types = [...new Set(MOCK_PETITIONS_LOG.map(p => p.type))];
    const typeFilterOpts = [
        `<option value="all" ${adminPetitionsType === 'all' ? 'selected' : ''}>ทุกประเภทคำร้อง (All Types)</option>`,
        ...types.map(t => `<option value="${t}" ${adminPetitionsType === t ? 'selected' : ''}>${esc(t)}</option>`),
    ].join('');

    // Filter logic
    let filtered = MOCK_PETITIONS_LOG.filter(p => {
        const matchBatch = adminPetitionsBatch === 'all' || getBatch(p.studentId) === adminPetitionsBatch;
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

    const rows = filtered.map((p) => {
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
                แสดง <strong>${filtered.length}</strong> จาก ${totalCount} รายการ
            </div>

            <div class="toolbar-search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" id="adminPetSearchInput" placeholder="ค้นหารหัสคำร้อง, นศ., ชื่อเรื่อง..." value="${esc(adminPetitionsSearch)}">
            </div>
        </div>

        <div class="card">
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
        </div>
    `;

    // Event listeners
    document.getElementById('adminPetBatchFilter').addEventListener('change', (e) => {
        adminPetitionsBatch = e.target.value;
        renderManagePetitions();
    });

    document.getElementById('adminPetTypeFilter').addEventListener('change', (e) => {
        adminPetitionsType = e.target.value;
        renderManagePetitions();
    });

    document.getElementById('adminPetStatusFilter').addEventListener('change', (e) => {
        adminPetitionsStatus = e.target.value;
        renderManagePetitions();
    });

    const searchInput = document.getElementById('adminPetSearchInput');
    searchInput.addEventListener('input', debounce((e) => {
        adminPetitionsSearch = e.target.value.trim();
        renderManagePetitions();
        const newSearchInput = document.getElementById('adminPetSearchInput');
        if (newSearchInput) {
            newSearchInput.focus();
            newSearchInput.setSelectionRange(adminPetitionsSearch.length, adminPetitionsSearch.length);
        }
    }, 300));

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

