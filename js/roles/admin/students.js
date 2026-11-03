/* ============================================================
   BSRU Student Portal — Admin: Manage Students (จัดการนักศึกษา)
   list / filter / paginate, CSV export & import, add / edit / delete,
   Sec change, password reset, impersonation
   ============================================================ */

import { confirmDialog } from '../../components/confirmDialog.js';
import { esc, statusBadge, getBatch, debounce, showToast } from '../../utils.js';
import { impersonateStudent } from '../../auth.js';
import { fetchAPI, API_BASE_URL } from '../../api.js';
import { STANDARD_CAREERS, EMPLOYMENT_STATUSES, SALARY_RANGES } from '../../components/careerCatalog.js';
import { MOCK_ADVISORS, MOCK_STUDENTS_POOL } from './mockData.js';
import { resolveBatchRange, renderPaginationPagesHtml, apiErrorText } from './shared.js';
import { renderAdminDashboard } from './dashboard.js';
import { bindGraduationAuditButtons } from './graduationAudit.js';

let adminLastSelectedBatch = 'all';
/** true once the student list came from the database: add / edit / delete then go through the API */
let studentsFromDb = false;

/** Called by initAdminDashboard() once the student list was loaded from the database */
export function setStudentsFromDb(value) {
    studentsFromDb = value;
}

/** GET /students row -> the shape this page uses */
export function toPoolStudent(s) {
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

export function renderManageStudents() {
    const allBatches = [...new Set(MOCK_STUDENTS_POOL.map(s => getBatch(s.studentId)))].sort().reverse();
    const activeBatches = resolveBatchRange(adminLastSelectedBatch, allBatches, MOCK_STUDENTS_POOL);

    const last4Label = allBatches.length >= 4 ? '⏱️ 4 ปีล่าสุด' : null;

    const filterOpts = [
        `<option value="all" ${adminLastSelectedBatch === 'all' ? 'selected' : ''}>ทุกรุ่น / ทุกปีการศึกษา (All Batches) — รวม ${MOCK_STUDENTS_POOL.length} คน</option>`,
        last4Label ? `<option value="last4" ${adminLastSelectedBatch === 'last4' ? 'selected' : ''}>${last4Label}</option>` : '',
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
            <td>${esc(s.nameTh)} <span class="batch-tag batch-${batch}">รุ่น ${batch}</span>${s.simulated ? ' <span class="badge badge-amber" style="font-size:0.7rem" title="ข้อมูลจำลอง: ไม่มีบัญชีเข้าสู่ระบบและผลการเรียน">จำลอง</span>' : ''}</td>
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
    else if (adminLastSelectedBatch === 'last4' || adminLastSelectedBatch === 'last3') selectedBatchDesc = '4 ปีล่าสุด';
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
            <button class="btn btn-primary" id="exportStudentCsvBtn" title="ส่งออกข้อมูลนักศึกษาเป็นไฟล์ CSV (UTF-8 with BOM)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;vertical-align:text-bottom;margin-right:4px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                ส่งออก CSV
            </button>
            <button class="btn btn-secondary" id="importStudentCsvBtn" title="นำเข้าข้อมูลนักศึกษาแบบกลุ่มจากไฟล์ CSV">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;vertical-align:text-bottom;margin-right:4px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                นำเข้า CSV
            </button>
            <input type="file" id="importStudentCsvInput" accept=".csv,text/csv" hidden>
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

    document.getElementById('exportStudentCsvBtn')?.addEventListener('click', async () => {
        try {
            let blob;
            try {
                const token = localStorage.getItem('bsru_token') || sessionStorage.getItem('bsru_token') || sessionStorage.getItem('token') || localStorage.getItem('token');
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                const baseUrl = (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) ? API_BASE_URL : '/api';
                const res = await fetch(`${baseUrl}/students/export-csv`, { headers });
                if (res.ok) {
                    blob = await res.blob();
                }
            } catch (netErr) { /* fallback to client-side generation */ }

            if (!blob) {
                let csv = 'studentId,nameTh,nameEn,email,phone,faculty,major,year,status,advisorId,gpa,careerPath\n';
                const exportList = (typeof filtered !== 'undefined' && filtered && filtered.length)
                    ? filtered
                    : (typeof filteredStudents !== 'undefined' && filteredStudents && filteredStudents.length
                        ? filteredStudents
                        : (Array.isArray(MOCK_STUDENTS_POOL) ? MOCK_STUDENTS_POOL : []));
                exportList.forEach(s => {
                    const escField = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
                    csv += `${s.studentId},${escField(s.nameTh)},${escField(s.nameEn)},${escField(s.email || `${s.studentId}@bsru.ac.th`)},${escField(s.phone)},${escField(s.faculty || 'คณะวิทยาศาสตร์และเทคโนโลยี')},${escField(s.department || 'สาขาวิทยาการคอมพิวเตอร์')},${s.year || 1},${escField(s.status || 'กำลังศึกษา')},${escField(s.advisor || '')},${s.gpa != null ? Number(s.gpa).toFixed(2) : '0.00'},${escField(s.careerPath || '')}\n`;
                });
                blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
            }

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bsru_students_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('success', 'ส่งออกข้อมูลนักศึกษาเป็นไฟล์ CSV (UTF-8 with BOM) เรียบร้อย');
        } catch (err) {
            showToast('error', 'ส่งออก CSV ล้มเหลว: ' + esc(err.message));
        }
    });

    const importBtn = document.getElementById('importStudentCsvBtn');
    const importInput = document.getElementById('importStudentCsvInput');
    if (importBtn && importInput) {
        importBtn.addEventListener('click', () => importInput.click());
        importInput.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const res = await fetchAPI('/students/import-csv', 'POST', text, 20000);
                showToast('success', res.message || 'นำเข้าข้อมูลนักศึกษาสำเร็จ');
                const liveStudents = await fetchAPI('/students').catch(() => null);
                if (Array.isArray(liveStudents)) {
                    MOCK_STUDENTS_POOL.splice(0, MOCK_STUDENTS_POOL.length, ...liveStudents.map(toPoolStudent));
                    studentsFromDb = true;
                }
                renderManageStudents();
                renderAdminDashboard();
            } catch (err) {
                showToast('error', 'นำเข้า CSV ไม่สำเร็จ: ' + esc(apiErrorText(err)));
            } finally {
                importInput.value = '';
            }
        });
    }
    document.querySelectorAll('.edit-student-btn').forEach(b => b.addEventListener('click', () => openStudentModal('edit', parseInt(b.dataset.idx))));
    document.querySelectorAll('.del-student-btn').forEach(b => b.addEventListener('click', async () => {
        const idx = parseInt(b.dataset.idx);
        const st = MOCK_STUDENTS_POOL[idx];
        const warning = studentsFromDb && st.simulated ? '\n(ข้อมูลจำลอง)'
            : studentsFromDb
            ? `\nข้อมูลจะถูกลบออกจากฐานข้อมูลจริง รวมถึงเกรด การลงทะเบียน คำร้อง และใบตรวจสอบจบของนักศึกษาคนนี้ (ย้อนกลับไม่ได้)` : '';
        if (!await confirmDialog(`ต้องการลบ "${st.nameTh}" (${st.studentId}) หรือไม่?${warning}`)) return;
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
        if (!await confirmDialog(`รีเซ็ตรหัสผ่านของ ${b.dataset.sname} (${sid})?
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

/* ── Student form validation: one inline message per field, same limits as StudentAdminService ── */
const YEAR_MIN = 1;
const YEAR_MAX = 8;

const fieldError = id => `<div class="app-field-error" id="${id}Err" role="alert"></div>`;

function setFieldError(id, message) {
    const input = document.getElementById(id);
    const box = document.getElementById(`${id}Err`);
    if (!input || !box) return;
    input.classList.toggle('is-invalid', !!message);
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (message) input.setAttribute('aria-describedby', box.id); else input.removeAttribute('aria-describedby');
    box.textContent = message || '';
    box.classList.toggle('visible', !!message);
}

/** Checks every field, marks the wrong ones and focuses the first; true when the form can be sent */
function validateStudentForm(mode) {
    const val = id => document.getElementById(id)?.value.trim() ?? '';
    const errors = {};
    if (mode !== 'edit') {
        if (!val('mfSid')) errors.mfSid = 'กรุณากรอกรหัสนักศึกษา';
        else if (!/^\d{10}$/.test(val('mfSid'))) errors.mfSid = 'รหัสนักศึกษาต้องเป็นตัวเลข 10 หลัก';
    }
    if (!val('mfSnameTh')) errors.mfSnameTh = 'กรุณากรอกชื่อ-สกุล (ไทย)';
    else if (!/^[฀-๿\s.]+$/.test(val('mfSnameTh'))) errors.mfSnameTh = 'ใช้ตัวอักษรภาษาไทยเท่านั้น';
    if (val('mfSnameEn') && !/^[A-Za-z\s.]+$/.test(val('mfSnameEn'))) errors.mfSnameEn = 'ใช้ตัวอักษรภาษาอังกฤษเท่านั้น';
    const year = Number(val('mfSyear'));
    if (!Number.isInteger(year) || year < YEAR_MIN || year > YEAR_MAX) errors.mfSyear = `ชั้นปีต้องอยู่ระหว่าง ${YEAR_MIN}–${YEAR_MAX}`;
    const gpa = Number(val('mfSgpa'));
    if (val('mfSgpa') === '' || Number.isNaN(gpa) || gpa < 0 || gpa > 4) errors.mfSgpa = 'GPA ต้องอยู่ระหว่าง 0.00–4.00';

    ['mfSid', 'mfSnameTh', 'mfSnameEn', 'mfSyear', 'mfSgpa'].forEach(id => setFieldError(id, errors[id]));
    const first = Object.keys(errors)[0];
    if (first) document.getElementById(first)?.focus();
    return !first;
}

/** Put a backend validation message under the field it is about (it is still shown as a toast too) */
function showServerFieldError(message) {
    const map = [[/รหัสนักศึกษา/, 'mfSid'], [/ภาษาไทย|\(ไทย\)/, 'mfSnameTh'], [/English|Eng/, 'mfSnameEn'], [/ชั้นปี/, 'mfSyear'], [/GPA/, 'mfSgpa']];
    const hit = map.find(([re]) => re.test(message));
    if (hit) { setFieldError(hit[1], message); document.getElementById(hit[1])?.focus(); }
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
        <p style="font-size:0.78rem;color:var(--text-muted);margin:0 0 8px"><span class="req" style="color:var(--red-500);font-weight:700">*</span> ช่องที่ต้องกรอก</p>
        <div class="modal-field"><label for="mfSid">รหัสนักศึกษา <span class="req" style="color:var(--red-500);font-weight:700">*</span></label><input id="mfSid" inputmode="numeric" maxlength="10" value="${esc(s.studentId || '')}" ${mode === 'edit' ? 'readonly style="opacity:0.6"' : 'required'}>${fieldError('mfSid')}</div>
        <div class="modal-field"><label for="mfSnameTh">ชื่อ-สกุล (ไทย) <span class="req" style="color:var(--red-500);font-weight:700">*</span></label><input id="mfSnameTh" required value="${esc(s.nameTh || '')}">${fieldError('mfSnameTh')}</div>
        <div class="modal-field"><label for="mfSnameEn">ชื่อ-สกุล (Eng)</label><input id="mfSnameEn" value="${esc(s.nameEn || '')}">${fieldError('mfSnameEn')}</div>
        <div class="modal-field"><label for="mfSyear">ชั้นปี (${YEAR_MIN}–${YEAR_MAX})</label><input id="mfSyear" type="number" min="${YEAR_MIN}" max="${YEAR_MAX}" value="${s.year || 1}">${fieldError('mfSyear')}</div>
        <div class="modal-field"><label for="mfSgpa">GPA (0.00–4.00)</label><input id="mfSgpa" type="number" step="0.01" min="0" max="4" value="${s.gpa || 0}">${fieldError('mfSgpa')}</div>
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
        if (!validateStudentForm(mode)) return;

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
                showServerFieldError(apiErrorText(err));
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
