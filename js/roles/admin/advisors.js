/* ============================================================
   BSRU Student Portal — Admin: Manage Advisors (จัดการอาจารย์ที่ปรึกษา)
   ============================================================ */

import { esc } from '../../utils.js';
import { MOCK_ADVISORS } from './mockData.js';
import { renderAdminDashboard } from './dashboard.js';

export function renderManageAdvisors() {
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
