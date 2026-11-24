/* ============================================================
   BSRU Student Portal — Admin: Manage Advisors (จัดการอาจารย์ที่ปรึกษา)
   ============================================================ */

import { confirmDialog } from '../../components/confirmDialog.js';
import { esc, showToast, titleCaseEn } from '../../utils.js';
import { fetchAPI } from '../../api.js';
import { MOCK_ADVISORS, MOCK_STUDENTS_POOL } from './mockData.js';
import { apiErrorText } from './shared.js';
import { renderManageStudents, toPoolStudent } from './students.js';
import { renderAdminDashboard } from './dashboard.js';
import { attachFormDraft } from '../../components/formDraft.js';

export function renderManageAdvisors() {
    const rows = MOCK_ADVISORS.map((a, i) => `
        <tr>
            <td><strong>${esc(a.id)}</strong></td>
            <td>${esc(a.nameTh)}</td>
            <td class="hide-mobile">${esc(a.email)}</td>
            <td style="text-align:center">${a.studentsCount}</td>
            <td style="text-align:center">
                <select class="batch-select advisor-admin-toggle" data-id="${esc(a.id)}" data-idx="${i}" aria-label="สิทธิ์แอดมินของ ${esc(a.nameTh)}" style="min-width:130px;padding:5px 10px;font-size:0.8rem">
                    <option value="false" ${!a.canAdmin ? 'selected' : ''}>ทั่วไป</option>
                    <option value="true" ${a.canAdmin ? 'selected' : ''}>มีสิทธิ์แอดมิน</option>
                </select>
            </td>
            <td>
                <div class="action-btns">
                    <button class="btn btn-sm btn-warning edit-advisor-btn" data-idx="${i}">แก้ไข</button>
                    <button class="btn btn-sm btn-danger del-advisor-btn" data-idx="${i}">ลบ</button>
                </div>
            </td>
        </tr>`).join('');

    document.getElementById('manageAdvisorsContent').innerHTML = `
        <div id="adminCohortAdvisorsCard"></div>
        <div class="card">
            <div class="toolbar">
                <div class="card-title" style="margin-bottom:0">👩‍🏫 รายชื่ออาจารย์ที่ปรึกษา <span class="badge badge-purple">${MOCK_ADVISORS.length} คน</span></div>
                <button class="btn btn-success" id="addAdvisorBtn">เพิ่มอาจารย์</button>
            </div>
            <div class="table-wrap">
                <table class="data-table">
                    <thead><tr><th>รหัส</th><th>ชื่อ-สกุล</th><th class="hide-mobile">Email</th><th style="text-align:center">นศ.ที่ดูแล</th><th style="text-align:center">สิทธิ์แอดมิน</th><th>จัดการ</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    `;

    renderCohortAdvisorsCard();
    document.getElementById('addAdvisorBtn').addEventListener('click', () => openAdvisorModal('add'));
    document.querySelectorAll('.edit-advisor-btn').forEach(b => b.addEventListener('click', () => openAdvisorModal('edit', parseInt(b.dataset.idx))));
    document.querySelectorAll('.advisor-admin-toggle').forEach(sel => sel.addEventListener('change', async () => {
        const id = sel.dataset.id;
        const newStatus = sel.value === 'true';
        const idx = parseInt(sel.dataset.idx);
        try {
            await fetchAPI(`/advisors/${encodeURIComponent(id)}/admin-privilege`, 'PUT', { canAdmin: newStatus }, 8000);
            if (MOCK_ADVISORS[idx]) MOCK_ADVISORS[idx].canAdmin = newStatus;
            showToast('success', newStatus ? `มอบสิทธิ์แอดมินให้อาจารย์ ${esc(MOCK_ADVISORS[idx]?.nameTh || id)} แล้ว` : `ยกเลิกสิทธิ์แอดมินของ ${esc(MOCK_ADVISORS[idx]?.nameTh || id)} แล้ว`);
            renderManageAdvisors();
        } catch (err) {
            sel.value = String(!newStatus);
            showToast('error', esc(apiErrorText(err)));
        }
    }));
    document.querySelectorAll('.del-advisor-btn').forEach(b => b.addEventListener('click', async () => {
        const idx = parseInt(b.dataset.idx);
        const adv = MOCK_ADVISORS[idx];
        if (!adv) return;
        if (await confirmDialog(`ต้องการลบ "${adv.nameTh}" (${adv.id}) หรือไม่?`)) {
            try {
                await fetchAPI(`/advisors/${encodeURIComponent(adv.id)}`, 'DELETE', null, 8000);
                MOCK_ADVISORS.splice(idx, 1);
                showToast('success', `ลบอาจารย์ ${esc(adv.nameTh)} เรียบร้อยแล้ว`);
                renderManageAdvisors();
                renderAdminDashboard();
            } catch (err) {
                showToast('error', esc(apiErrorText(err)));
            }
        }
    }));
}

/** Advisor of each cohort (admission year): one advisor per cohort, applied to every real student in it */
async function renderCohortAdvisorsCard() {
    const container = document.getElementById('adminCohortAdvisorsCard');
    if (!container) return;
    let cohorts;
    try {
        cohorts = await fetchAPI('/cohort-advisors');
    } catch (err) {
        container.innerHTML = '';
        return;
    }
    if (!container.isConnected) return;

    const advisorOptions = (selected) => `<option value="">— ยังไม่มีที่ปรึกษา —</option>` + MOCK_ADVISORS.map(a =>
        `<option value="${esc(a.id)}" ${a.id === selected ? 'selected' : ''}>${esc(a.id)} · ${esc(a.nameTh)}</option>`).join('');
    const rows = cohorts.map(c => `
        <tr data-year="${c.admissionYear}">
            <td><strong>รุ่น ${c.admissionYear}</strong><div style="font-size:0.8rem;color:var(--text-muted)">รหัส ${String(c.admissionYear).slice(2)}xxxxxxxx</div></td>
            <td>${c.realStudents} คน${c.simulatedStudents ? `<div style="font-size:0.8rem;color:var(--text-muted)">+ จำลอง ${c.simulatedStudents} (ไม่นับ)</div>` : ''}</td>
            <td><select class="batch-select cohort-advisor">${advisorOptions(c.advisorId)}</select></td>
            <td>${c.advisorId ? '<span class="badge badge-green">มีที่ปรึกษา</span>' : '<span class="badge badge-amber">ยังไม่มี</span>'}</td>
            <td><button class="btn btn-sm btn-orange cohort-save">บันทึก</button></td>
        </tr>`).join('');

    container.innerHTML = `
        <div class="card">
            <div class="card-title">🎓 อาจารย์ที่ปรึกษาประจำรุ่น</div>
            <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px">
                1 รุ่น (ปีที่เข้าศึกษา) มีอาจารย์ที่ปรึกษา 1 คน อาจารย์ 1 คนดูแลได้หลายรุ่น · นักศึกษาจริงทุกคนในรุ่นจะได้ที่ปรึกษาคนนี้ (รวมคนที่เพิ่มเข้ามาภายหลัง) · นักศึกษาจำลองไม่นับ
            </p>
            <div class="table-wrap">
                <table class="data-table">
                    <thead><tr><th>รุ่น</th><th>นักศึกษาจริง</th><th>อาจารย์ที่ปรึกษา</th><th>สถานะ</th><th></th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">ยังไม่มีนักศึกษา</td></tr>'}</tbody>
                </table>
            </div>
            <div class="batch-filter-bar" style="flex-wrap:wrap;gap:8px;margin-top:12px;align-items:center">
                <span style="font-size:0.85rem">เพิ่มรุ่นใหม่ (ยังไม่มีนักศึกษา):</span>
                <input type="number" id="cohortNewYear" class="batch-select" placeholder="เช่น 2569" min="2500" max="2700" style="width:120px">
                <select id="cohortNewAdvisor" class="batch-select">${advisorOptions(null)}</select>
                <button class="btn btn-sm btn-orange" id="cohortNewSave">บันทึก</button>
            </div>
        </div>`;

    const save = async (year, advisorId) => {
        try {
            await fetchAPI(`/cohort-advisors/${encodeURIComponent(year)}`, 'PUT', { advisorId }, 8000);
            const name = MOCK_ADVISORS.find(a => a.id === advisorId)?.nameTh;
            showToast('success', advisorId ? `ตั้ง ${esc(name || advisorId)} เป็นที่ปรึกษารุ่น ${year} แล้ว` : `ยกเลิกที่ปรึกษารุ่น ${year} แล้ว`);
            // Students' advisors changed: reload them so the student list and counts match
            const live = await fetchAPI('/students').catch(() => null);
            if (Array.isArray(live)) {
                MOCK_STUDENTS_POOL.splice(0, MOCK_STUDENTS_POOL.length, ...live.map(toPoolStudent));
                const counts = {};
                live.forEach(st => { const id = st.advisor?.id; if (id) counts[id] = (counts[id] || 0) + 1; });
                MOCK_ADVISORS.forEach(a => { a.studentsCount = counts[a.id] || 0; });
                renderManageStudents();
            }
            renderManageAdvisors();
        } catch (err) {
            showToast('error', esc(apiErrorText(err)));
        }
    };
    container.querySelectorAll('tr[data-year]').forEach(row => {
        row.querySelector('.cohort-save').addEventListener('click', () =>
            save(row.dataset.year, row.querySelector('.cohort-advisor').value));
    });
    container.querySelector('#cohortNewSave').addEventListener('click', () => {
        const year = parseInt(container.querySelector('#cohortNewYear').value, 10);
        if (!(year >= 2500 && year <= 2700)) {
            showToast('error', 'กรุณาใส่ปีที่เข้าศึกษาเป็นปี พ.ศ. เช่น 2569');
            return;
        }
        save(year, container.querySelector('#cohortNewAdvisor').value);
    });
}

function openAdvisorModal(mode, idx) {
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const crudModal = document.getElementById('crudModal');
    
    const a = mode === 'edit' ? MOCK_ADVISORS[idx] : {};
    modalTitle.textContent = mode === 'edit' ? 'แก้ไขอาจารย์ที่ปรึกษา' : 'เพิ่มอาจารย์ที่ปรึกษาใหม่';
    modalBody.innerHTML = `
        <div class="modal-field">
            <label>รหัสอาจารย์ <span style="color:var(--red-500)">*</span></label>
            <input id="mfId" value="${esc(a.id || '')}" placeholder="เช่น ADV-08" ${mode === 'edit' ? 'readonly style="opacity:0.6"' : ''}>
        </div>
        <div class="modal-field">
            <label>ชื่อ-สกุล (ไทย) <span style="color:var(--red-500)">*</span></label>
            <input id="mfNameTh" value="${esc(a.nameTh || '')}" placeholder="เช่น ผศ.ดร.วรรณภา สมบูรณ์">
        </div>
        <div class="modal-field">
            <label>ชื่อ-สกุล (Eng)</label>
            <input id="mfNameEn" value="${esc(a.nameEn || '')}" placeholder="เช่น Wannapha Somboon">
        </div>
        <div class="modal-field">
            <label>Email</label>
            <input id="mfEmail" value="${esc(a.email || '')}" placeholder="เช่น wannapha.s@bsru.ac.th">
        </div>
        <div class="modal-field">
            <label>โทรศัพท์ (ใช้เป็นรหัสผ่านแรกเข้า) <span style="color:var(--red-500)">*</span></label>
            <input id="mfPhone" value="${esc(a.phone || '')}" placeholder="เช่น 0891234567">
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:3px">⚠️ เบอร์โทรศัพท์นี้จะถูกใช้เป็นรหัสผ่านเริ่มต้นสำหรับเข้าสู่ระบบ <strong>(ไม่ต้องใส่ขีดหรือ - เช่น 0891234567)</strong> และระบบจะให้อาจารย์เปลี่ยนรหัสผ่านใหม่ทันทีเมื่อเข้าสู่ระบบสำเร็จ</div>
        </div>
    `;
    
    const saveBtn = document.getElementById('modalSave');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    
    newSaveBtn.addEventListener('click', async () => {
        const id = document.getElementById('mfId').value.trim();
        const nameTh = document.getElementById('mfNameTh').value.trim();
        const nameEn = titleCaseEn(document.getElementById('mfNameEn').value.trim());
        const email = document.getElementById('mfEmail').value.trim();
        const phone = document.getElementById('mfPhone').value.trim();
        
        if (!id || !nameTh) {
            showToast('error', 'กรุณากรอกรหัสและชื่ออาจารย์');
            return;
        }
        if (!phone) {
            showToast('error', 'กรุณาระบุเบอร์โทรศัพท์สำหรับใช้เป็นรหัสผ่านแรกเข้า');
            return;
        }

        const payload = {
            id,
            nameTh,
            nameEn,
            email,
            phone,
            department: a.department || 'วิทยาการคอมพิวเตอร์',
            canAdmin: !!a.canAdmin,
        };

        try {
            newSaveBtn.disabled = true;
            newSaveBtn.textContent = 'กำลังบันทึก...';
            if (mode === 'edit') {
                const updated = await fetchAPI(`/advisors/${encodeURIComponent(id)}`, 'PUT', payload, 10000);
                const item = { ...a, ...payload, ...updated };
                MOCK_ADVISORS[idx] = item;
                showToast('success', `แก้ไขข้อมูลอาจารย์ ${esc(nameTh)} เรียบร้อยแล้ว`);
            } else {
                const created = await fetchAPI('/advisors', 'POST', payload, 10000);
                const item = { ...payload, ...created, studentsCount: 0 };
                MOCK_ADVISORS.push(item);
                const phoneDigits = phone.replace(/\D/g, '') || phone;
                showToast('success', `เพิ่มอาจารย์ ${esc(nameTh)} สำเร็จ! รหัสผ่านแรกเข้า: ${esc(phoneDigits)} (ไม่ต้องใส่ขีดหรือ -)`);
            }
            advisorDraft.clear();
            crudModal.classList.remove('open');
            renderManageAdvisors();
            renderAdminDashboard();
        } catch (err) {
            showToast('error', esc(apiErrorText(err)));
        } finally {
            newSaveBtn.disabled = false;
            newSaveBtn.textContent = 'บันทึก';
        }
    });

    // Unsaved input survives closing the form by mistake; cleared once saved
    const advisorDraft = attachFormDraft(modalBody, mode === 'edit' ? `advisor:edit:${a.id}` : 'advisor:add');

    crudModal.classList.add('open');
}
