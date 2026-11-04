import { esc, statusBadge, getBatch, debounce, showToast } from '../../utils.js';
import { fetchAPI, viewPdfAttachmentAPI } from '../../api.js';
import { MOCK_ADVISORS, MOCK_STUDENTS_POOL, MOCK_PETITIONS_LOG } from './mockData.js';
import { resolveBatchRange, renderPaginationPagesHtml } from './shared.js';
import { renderAdminDashboard } from './dashboard.js';

/* ============================================================
   MANAGE PETITIONS (Admin Petition Logs)
   ============================================================ */
let adminPetitionsBatch = 'all';
let adminPetitionsType = 'all';
let adminPetitionsStatus = 'all';
let adminPetitionsSearch = '';
let adminPetitionsPage = 1;
let adminPetitionsPageSize = 5;

export function renderManagePetitions() {
    const container = document.getElementById('managePetitionsContent');
    if (!container) return;

    const totalCount = MOCK_PETITIONS_LOG.length;
    const pendingCount = MOCK_PETITIONS_LOG.filter(p => p.status === 'รอดำเนินการ' || p.status === 'รออาจารย์ที่ปรึกษาพิจารณา' || p.status === 'รอผู้ดูแลระบบอนุมัติ').length;
    const approvedCount = MOCK_PETITIONS_LOG.filter(p => p.status === 'อนุมัติ').length;
    const rejectedCount = MOCK_PETITIONS_LOG.filter(p => p.status === 'ปฏิเสธ' || p.status === 'ไม่อนุมัติ').length;

    // Batches from student IDs in petitions
    const allBatches = [...new Set(MOCK_PETITIONS_LOG.map(p => getBatch(p.studentId)))].sort().reverse();
    const activeBatches = resolveBatchRange(adminPetitionsBatch, allBatches, MOCK_PETITIONS_LOG);

    const last4Label = allBatches.length >= 4 ? '⏱️ 4 ปีล่าสุด' : null;

    const batchFilterOpts = [
        `<option value="all" ${adminPetitionsBatch === 'all' ? 'selected' : ''}>ทุกรุ่น / ทุกปีการศึกษา (All Batches)</option>`,
        last4Label ? `<option value="last4" ${adminPetitionsBatch === 'last4' ? 'selected' : ''}>${last4Label}</option>` : '',
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
                        <span class="batch-tag batch-${batch}">รุ่น ${batch}</span>
                    </div>
                </div>
            </td>
            <td><span class="petition-type-badge">${esc(p.type)}</span></td>
            <td class="hide-mobile"><span class="petition-log-title" title="${esc(p.title)}">${esc(p.title)}</span></td>
            <td style="text-align:center" class="hide-mobile">
                ${(p.attachment || p.attachmentPath) ? `
                    <span class="petition-pdf-badge admin-table-pdf-btn" data-pid="${esc(p.id)}" title="${esc(p.attachment || 'PDF')}" style="cursor:pointer">
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
    else if (adminPetitionsBatch === 'last4' || adminPetitionsBatch === 'last3') selectedPetBatchDesc = '4 ปีล่าสุด';
    else selectedPetBatchDesc = `รุ่น ${adminPetitionsBatch}`;

    const paginationHtml = totalPetitions > 0 ? `
        <div class="table-pagination-bar">
            <div class="pagination-info">
                แสดงรายการที่ <strong>${startIndex + 1} - ${endIndex}</strong> จากทั้งหมด <strong>${totalPetitions}</strong> รายการ
                <span class="pagination-size-select">
                    (หน้าละ 
                    <select class="page-size-select" id="adminPetPageSize" aria-label="à¸à¸³à¸à¸§à¸à¹à¸à¸§à¸à¹à¸­à¸«à¸à¹à¸²">
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
                <select class="batch-select" id="adminPetBatchFilter" aria-label="à¸à¸£à¸­à¸à¸à¸²à¸¡à¸£à¸¸à¹à¸">${batchFilterOpts}</select>
            </div>

            <div class="filter-group">
                <label>ประเภท</label>
                <select class="batch-select" id="adminPetTypeFilter" aria-label="à¸à¸£à¸­à¸à¸à¸²à¸¡à¸à¸£à¸°à¹à¸ à¸à¸à¸³à¸£à¹à¸­à¸">${typeFilterOpts}</select>
            </div>

            <div class="filter-group">
                <label>สถานะ</label>
                <select class="batch-select" id="adminPetStatusFilter" aria-label="à¸à¸£à¸­à¸à¸à¸²à¸¡à¸ªà¸à¸²à¸à¸°à¸à¸³à¸£à¹à¸­à¸">
                    <option value="all" ${adminPetitionsStatus === 'all' ? 'selected' : ''}>ทุกสถานะ (All Status)</option>
                    <option value="รออาจารย์ที่ปรึกษาพิจารณา" ${adminPetitionsStatus === 'รออาจารย์ที่ปรึกษาพิจารณา' ? 'selected' : ''}>⏳ รออาจารย์ที่ปรึกษาพิจารณา</option>
                    <option value="รอผู้ดูแลระบบอนุมัติ" ${adminPetitionsStatus === 'รอผู้ดูแลระบบอนุมัติ' ? 'selected' : ''}>📋 รอผู้ดูแลระบบอนุมัติ</option>
                    <option value="อนุมัติ" ${adminPetitionsStatus === 'อนุมัติ' ? 'selected' : ''}>✅ อนุมัติ</option>
                    <option value="ไม่อนุมัติ" ${adminPetitionsStatus === 'ไม่อนุมัติ' ? 'selected' : ''}>❌ ไม่อนุมัติ</option>
                    <option value="รอดำเนินการ" ${adminPetitionsStatus === 'รอดำเนินการ' ? 'selected' : ''}>⏳ รอดำเนินการ (เดิม)</option>
                    <option value="ปฏิเสธ" ${adminPetitionsStatus === 'ปฏิเสธ' ? 'selected' : ''}>❌ ปฏิเสธ (เดิม)</option>
                </select>
            </div>

            <div class="filter-result-count">
                กรอง: <strong>${selectedPetBatchDesc}</strong> (แสดง <strong>${filtered.length}</strong> จาก ${totalCount} รายการ)
            </div>

            <div class="toolbar-search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" id="adminPetSearchInput" aria-label="à¸à¹à¸à¸«à¸²à¸à¸³à¸£à¹à¸­à¸" placeholder="ค้นหารหัสคำร้อง, นศ., ชื่อเรื่อง..." value="${esc(adminPetitionsSearch)}">
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

    document.querySelectorAll('.admin-table-pdf-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                await viewPdfAttachmentAPI(btn.dataset.pid);
            } catch (err) {
                showToast('error', `ไม่สามารถเปิดไฟล์แนบได้: ${err.message}`);
            }
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

            ${(p.attachment || p.attachmentPath) ? `
            <div class="modal-field">
                <label>ไฟล์แนบ (PDF)</label>
                <div class="petition-file-selected" id="adminModalViewPdfBtn" style="pointer-events:all;cursor:pointer;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span>${esc(p.attachment || 'เอกสารแนบ.pdf')}</span>
                    <span class="btn btn-sm btn-ghost" style="margin-left:auto">📄 เปิดดูไฟล์ PDF</span>
                </div>
            </div>
            ` : ''}

            ${p.advisorComment ? `
            <div class="modal-field">
                <label>ความเห็นของอาจารย์ที่ปรึกษา</label>
                <div style="font-size:0.88rem;background:var(--brand-50, #eff6ff);padding:10px 14px;border-radius:var(--radius-md);color:var(--brand-700, #1d4ed8);border-left:4px solid #3b82f6">
                    👨‍🏫 <strong>ความเห็นอาจารย์:</strong> ${esc(p.advisorComment)}
                    ${p.advisorReviewedAt ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">พิจารณาเมื่อ: ${esc(p.advisorReviewedAt)}</div>` : ''}
                </div>
            </div>
            ` : ''}

            <hr style="border:0;border-top:1px solid var(--g-200);margin:16px 0">

            <div class="modal-field">
                <label for="adminPetitionStatusSelect"><strong>การพิจารณา / ปรับเปลี่ยนสถานะ</strong></label>
                <select id="adminPetitionStatusSelect" style="width:100%;padding:10px 14px;border:2px solid var(--g-200);border-radius:var(--radius-md);font-size:0.9rem">
                    <option value="รออาจารย์ที่ปรึกษาพิจารณา" ${p.status === 'รออาจารย์ที่ปรึกษาพิจารณา' ? 'selected' : ''}>⏳ รออาจารย์ที่ปรึกษาพิจารณา (Advisor Review)</option>
                    <option value="รอผู้ดูแลระบบอนุมัติ" ${p.status === 'รอผู้ดูแลระบบอนุมัติ' ? 'selected' : ''}>📋 รอผู้ดูแลระบบอนุมัติ (Pending Admin)</option>
                    <option value="อนุมัติ" ${p.status === 'อนุมัติ' ? 'selected' : ''}>✅ อนุมัติ (Approved)</option>
                    <option value="ไม่อนุมัติ" ${p.status === 'ไม่อนุมัติ' ? 'selected' : ''}>❌ ไม่อนุมัติ (Not Approved)</option>
                    ${p.status === 'รอดำเนินการ' ? `<option value="รอดำเนินการ" selected>⏳ รอดำเนินการ (Legacy Pending)</option>` : ''}
                    ${p.status === 'ปฏิเสธ' ? `<option value="ปฏิเสธ" selected>❌ ปฏิเสธ (Legacy Rejected)</option>` : ''}
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
                    ไม่อนุมัติคำร้อง (Reject)
                </button>
            </div>
        </div>
    `;

    document.getElementById('adminModalViewPdfBtn')?.addEventListener('click', async () => {
        try {
            await viewPdfAttachmentAPI(p.id);
        } catch (err) {
            showToast('error', `ไม่สามารถเปิดไฟล์แนบได้: ${err.message}`);
        }
    });

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
                comment: newComment,
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
        document.getElementById('adminPetitionStatusSelect').value = 'ไม่อนุมัติ';
        handlePetitionStatusUpdate('ไม่อนุมัติ', comment);
    });

    crudModal.classList.add('open');
}
