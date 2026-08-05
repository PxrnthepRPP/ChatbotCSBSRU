import { esc, statusBadge, getBatch } from '../main.js';
import { impersonateStudent } from '../auth.js';
import { debounce } from '../utils.js';
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

let adminLastSelectedBatch = 'all';
let adminSearchQuery = '';

export function initAdminDashboard() {
    renderAdminDashboard();
    renderManageAdvisors();
    renderManageStudents();
}

function renderAdminDashboard() {
    const studying = MOCK_STUDENTS_POOL.filter(s => s.status === 'กำลังศึกษา').length;
    const graduated = MOCK_STUDENTS_POOL.filter(s => s.status === 'จบการศึกษา').length;
    const onLeave = MOCK_STUDENTS_POOL.filter(s => s.status === 'พักการศึกษา').length;
    const dismissed = MOCK_STUDENTS_POOL.filter(s => s.status === 'พ้นสภาพ').length;

    document.getElementById('adminDashboardContent').innerHTML = `
        <div class="stat-row">
            <div class="stat-card"><div class="stat-icon purple">👩‍🏫</div><div><div class="stat-value">${MOCK_ADVISORS.length}</div><div class="stat-label">อาจารย์ที่ปรึกษา</div></div></div>
            <div class="stat-card"><div class="stat-icon blue">👨‍🎓</div><div><div class="stat-value">${MOCK_STUDENTS_POOL.length}</div><div class="stat-label">นักศึกษาทั้งหมด</div></div></div>
            <div class="stat-card"><div class="stat-icon green">✅</div><div><div class="stat-value">${studying}</div><div class="stat-label">กำลังศึกษา</div></div></div>
            <div class="stat-card"><div class="stat-icon amber">🎓</div><div><div class="stat-value">${graduated}</div><div class="stat-label">จบการศึกษา</div></div></div>
        </div>
        <div class="dashboard-grid">
            <div id="statusChartContainer"></div>
            <div id="careerListContainer"></div>
        </div>
        <div class="card">
            <div class="card-title">📊 ภาพรวมระบบ</div>
            <p style="font-size:0.88rem;color:var(--text-muted);line-height:1.7">ระบบสารสนเทศนักศึกษา BSRU สาขาวิทยาการคอมพิวเตอร์ — จัดการข้อมูลอาจารย์ที่ปรึกษาและนักศึกษาได้จากเมนูด้านซ้าย ระบบรองรับการเพิ่ม แก้ไข และลบข้อมูล</p>
        </div>
    `;

    // Load chart CSS and render both components
    loadComponentCSS('statusChart').then(() => {
        renderStatusDonutChart('statusChartContainer', MOCK_STUDENTS_POOL);
        renderCareerDataList('careerListContainer', MOCK_STUDENTS_POOL);
    });
}

function renderManageAdvisors() {
    const rows = MOCK_ADVISORS.map((a, i) => `
        <tr>
            <td><strong>${esc(a.id)}</strong></td>
            <td>${esc(a.nameTh)}</td>
            <td>${esc(a.email)}</td>
            <td>${esc(a.department)}</td>
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
                    <thead><tr><th>รหัส</th><th>ชื่อ-สกุล</th><th>Email</th><th>สาขา</th><th style="text-align:center">นศ.ที่ดูแล</th><th>จัดการ</th></tr></thead>
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
            <td style="text-align:center">ปี ${s.year}</td>
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
            <div class="toolbar-search" style="margin-left:auto">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" id="adminStudentSearch" placeholder="ค้นหารหัสนักศึกษา, ชื่อ..." value="${esc(adminSearchQuery)}">
            </div>
            <button class="btn btn-success" id="addStudentBtn" style="margin-left:14px">เพิ่มนักศึกษา</button>
        </div>
        <div class="card">
            <div class="table-wrap">
                <table class="data-table">
                    <thead><tr><th>รหัสนักศึกษา</th><th>ชื่อ-สกุล</th><th style="text-align:center">ชั้นปี</th><th style="text-align:center">GPA</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
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
