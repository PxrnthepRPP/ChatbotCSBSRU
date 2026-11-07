/* ============================================================
   BSRU Student Portal — Advisor: My Advisees list (นักศึกษาในที่ปรึกษา)
   live advisee loading, filter/search, simulated students
   ============================================================ */

import { confirmDialog } from '../../components/confirmDialog.js';
import { esc, statusBadge, getBatch, debounce, fetchAPI, NAME_PREFIXES, withNamePrefix, joinFirstLast } from '../../utils.js';
import { apiErrorText } from '../admin.js';
import { impersonateStudent } from '../../auth.js';
import { liveAdvisees, setLiveAdvisees, currentAdvisees, riskBadge, riskChips } from './risk.js';
import { bindAdviseeButtons } from './history.js';
import { showAdvisorModal, showAdvisorToast } from './ui.js';
import { renderAdvisorDashboard } from './dashboard.js';

let lastSelectedBatch = 'all';
let advisorSearchQuery = '';

export async function loadLiveAdvisees() {
    try {
        setLiveAdvisees(await fetchAPI('/advisors/me/advisees', 'GET', null, 10000));
    } catch (err) {
        console.warn('[Advisor] Backend unavailable, showing sample advisees:', err.message);
        return;
    }
    renderAdvisorDashboard();
    renderMyAdvisees();
}

export function renderMyAdvisees() {
    const myStudents = currentAdvisees();
    const batches = [...new Set(myStudents.map(s => getBatch(s.studentId)))].sort().reverse();
    const filterOpts = [
        `<option value="all" ${lastSelectedBatch === 'all' ? 'selected' : ''}>ทั้งหมด (All Batches)</option>`,
        ...batches.map(b => `<option value="${b}" ${lastSelectedBatch === b ? 'selected' : ''}>รุ่น ${b} (Batch ${b})</option>`)
    ].join('');
    
    let filtered = lastSelectedBatch === 'all' ? myStudents : myStudents.filter(s => getBatch(s.studentId) === lastSelectedBatch);

    if (advisorSearchQuery) {
        const q = advisorSearchQuery.toLowerCase();
        filtered = filtered.filter(s => s.studentId.includes(q) || s.nameTh.toLowerCase().includes(q) || (s.nameEn && s.nameEn.toLowerCase().includes(q)));
    }

    const cards = filtered.map(s => `
        <div class="advisee-card">
            <div class="advisee-avatar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div class="advisee-info">
                <div class="advisee-name">${esc(s.studentId)} ${esc(s.nameTh)} ${s.risk?.simulated ? '<span class="badge badge-amber" style="font-size:0.7rem" title="ข้อมูลจำลอง: ไม่มีบัญชีเข้าสู่ระบบและผลการเรียน">จำลอง</span> ' : ''}${s.risk ? riskBadge(s.risk) + ' ' + riskChips(s.risk) : ''}</div>
                <div class="advisee-detail">ปี ${s.year} · GPA: ${s.gpa.toFixed(2)} · ${esc(s.nameEn)}</div>
            </div>
            <span class="badge ${statusBadge(s.status)}">${esc(s.status)}</span>
            <div class="advisee-actions">
                <button class="btn btn-sm btn-primary adv-imp-btn" data-sid="${s.studentId}" data-sname="${esc(s.nameTh)}" title="เข้าดูระบบในมุมมองของนักศึกษาคนนี้">👁 เข้าใช้แทน</button>
                ${s.risk
                    ? `<button class="btn btn-sm btn-ghost adv-history-btn" data-sid="${esc(s.studentId)}">ดูประวัติ</button>
                       <button class="btn btn-sm btn-ghost adv-ai-one-btn" data-sid="${esc(s.studentId)}" title="ให้ AI วิเคราะห์ความเสี่ยงรายบุคคล">🤖 วิเคราะห์ความเสี่ยง</button>
                       ${s.risk.simulated ? `<button class="btn btn-sm btn-ghost adv-del-sim-btn" data-sid="${esc(s.studentId)}" data-sname="${esc(s.nameTh)}" title="ลบข้อมูลจำลอง">🗑️</button>` : ''}`
                    : `<button class="btn btn-sm btn-ghost" disabled title="ต้องเชื่อมต่อ backend">ดูประวัติ</button> <button class="btn btn-sm btn-ghost adv-ai-one-btn" data-sid="${esc(s.studentId)}" title="ให้ AI วิเคราะห์ความเสี่ยงรายบุคคล">🤖 วิเคราะห์ความเสี่ยง</button>`}
            </div>
        </div>
    `).join('');

    document.getElementById('myAdviseesContent').innerHTML = `
        <div class="batch-filter-bar">
            <label>กรองตามรุ่น</label>
            <select class="batch-select" id="advBatchFilter" aria-label="à¸à¸£à¸­à¸à¸à¸²à¸¡à¸£à¸¸à¹à¸">${filterOpts}</select>
            <div class="filter-result-count">แสดง <strong>${filtered.length}</strong> จาก ${myStudents.length} คน</div>
            <div class="toolbar-search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" id="advStudentSearch" aria-label="à¸à¹à¸à¸«à¸²à¸à¸±à¸à¸¨à¸¶à¸à¸©à¸²" placeholder="ค้นหารหัสนักศึกษา, ชื่อ..." value="${esc(advisorSearchQuery)}">
            </div>
            ${liveAdvisees ? `
                <button class="btn btn-sm btn-primary" id="advImportCsvBtn">📥 นำเข้า CSV นักศึกษา</button>
                <input type="file" id="advImportCsvInput" accept=".csv,text/csv" style="display:none">
                <button class="btn btn-sm btn-orange" id="advAddSimBtn">➕ เพิ่มนักศึกษาจำลอง</button>
            ` : ''}
        </div>
        <div class="card" style="background:transparent;box-shadow:none;border:none;padding:0">
            ${cards || '<div style="text-align:center;padding:40px;color:var(--text-muted)">ไม่พบข้อมูลนักศึกษา</div>'}
        </div>
    `;

    const advImportBtn = document.getElementById('advImportCsvBtn');
    const advImportInput = document.getElementById('advImportCsvInput');
    if (advImportBtn && advImportInput) {
        advImportBtn.addEventListener('click', () => advImportInput.click());
        advImportInput.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const res = await fetchAPI('/advisors/me/advisees/import-csv', 'POST', text, 20000);
                showAdvisorToast('success', esc(res.message || 'นำเข้าข้อมูลนักศึกษาสำเร็จ'));
                await loadLiveAdvisees();
            } catch (err) {
                showAdvisorToast('error', 'นำเข้า CSV ไม่สำเร็จ: ' + esc(apiErrorText(err)));
            } finally {
                advImportInput.value = '';
            }
        });
    }

    document.getElementById('advBatchFilter').addEventListener('change', (e) => {
        lastSelectedBatch = e.target.value;
        renderMyAdvisees();
    });

    const searchInput = document.getElementById('advStudentSearch');
    searchInput.addEventListener('input', debounce((e) => {
        advisorSearchQuery = e.target.value.trim();
        renderMyAdvisees();
        const newSearchInput = document.getElementById('advStudentSearch');
        if (newSearchInput) {
            newSearchInput.focus();
            newSearchInput.setSelectionRange(advisorSearchQuery.length, advisorSearchQuery.length);
        }
    }, 300));

    document.querySelectorAll('.adv-imp-btn').forEach(b => {
        b.addEventListener('click', () => impersonateStudent(b.dataset.sid, b.dataset.sname));
    });
    bindAdviseeButtons(document.getElementById('myAdviseesContent'));
    document.getElementById('advAddSimBtn')?.addEventListener('click', openAddSimulatedModal);
    document.querySelectorAll('.adv-del-sim-btn').forEach(b => b.addEventListener('click', async () => {
        if (!await confirmDialog(`ลบข้อมูลจำลอง ${b.dataset.sname} (${b.dataset.sid})?`)) return;
        try {
            await fetchAPI(`/advisors/me/advisees/${encodeURIComponent(b.dataset.sid)}`, 'DELETE', null, 10000);
            showAdvisorToast('success', esc(`ลบ ${b.dataset.sname} แล้ว`));
            loadLiveAdvisees();
        } catch (err) {
            showAdvisorToast('error', esc(apiErrorText(err)));
        }
    }));
}

/** Advisor adds a sample (simulated) student to their own advisees */
function openAddSimulatedModal() {
    // Every field here is required
    const REQ = '<span style="color:#dc2626" title="ต้องกรอก">*</span>';
    const field = (label, input) => `<div class="modal-field"><label>${label} ${REQ}</label>${input}</div>`;
    const overlay = showAdvisorModal('เพิ่มนักศึกษาจำลอง', `
        <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:10px">ข้อมูลจำลองใช้แสดงในแดชบอร์ดเท่านั้น ไม่มีบัญชีเข้าสู่ระบบและผลการเรียน · จะอยู่ในความดูแลของคุณ · ช่องที่มี ${REQ} ต้องกรอก</p>
        ${field('รหัสนักศึกษา (10 หลัก)', '<input id="simId" maxlength="10" placeholder="เช่น 6921100001">')}
        ${field('คำนำหน้า', `<select id="simPrefix"><option value="">-- เลือกคำนำหน้า --</option>${NAME_PREFIXES.map(p => `<option value="${p.th}">${p.th} (${p.en})</option>`).join('')}</select>`)}
        ${field('ชื่อ (ไทย)', '<input id="simFirstTh" placeholder="เช่น ทดลอง">')}
        ${field('นามสกุล (ไทย)', '<input id="simLastTh" placeholder="เช่น ใจดี">')}
        ${field('ชื่อ (English)', '<input id="simFirstEn" placeholder="e.g. Tadlong">')}
        ${field('นามสกุล (English)', '<input id="simLastEn" placeholder="e.g. Jaidee">')}
        ${field('ชั้นปี', '<input id="simYear" type="number" min="1" max="8" value="1">')}
        ${field('GPA', '<input id="simGpa" type="number" min="0" max="4" step="0.01" value="0">')}
        ${field('สถานะ', `<select id="simStatus">${['กำลังศึกษา', 'จบการศึกษา', 'พักการศึกษา', 'พ้นสภาพ'].map(x => `<option>${x}</option>`).join('')}</select>`)}
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
            <button class="btn btn-orange" id="simSave">บันทึก</button>
        </div>`);
    overlay.querySelector('#simSave').addEventListener('click', async () => {
        const prefix = overlay.querySelector('#simPrefix').value;
        const val = sel => overlay.querySelector(sel).value;
        const required = [['#simId', 'รหัสนักศึกษา'], ['#simPrefix', 'คำนำหน้า'], ['#simFirstTh', 'ชื่อ (ไทย)'],
            ['#simLastTh', 'นามสกุล (ไทย)'], ['#simFirstEn', 'ชื่อ (English)'], ['#simLastEn', 'นามสกุล (English)'],
            ['#simYear', 'ชั้นปี'], ['#simGpa', 'GPA'], ['#simStatus', 'สถานะ']];
        const missing = required.filter(([sel]) => !String(val(sel)).trim());
        required.forEach(([sel]) => { overlay.querySelector(sel).style.borderColor = ''; });
        missing.forEach(([sel]) => { overlay.querySelector(sel).style.borderColor = '#dc2626'; });
        if (missing.length) {
            showAdvisorToast('error', esc('กรุณากรอกให้ครบ: ' + missing.map(([, label]) => label).join(', ')));
            return;
        }
        if (!/^\d{10}$/.test(val('#simId').trim())) {
            showAdvisorToast('error', 'รหัสนักศึกษาต้องเป็นตัวเลข 10 หลัก');
            return;
        }
        const names = withNamePrefix(prefix, joinFirstLast(val('#simFirstTh'), val('#simLastTh')),
            joinFirstLast(val('#simFirstEn'), val('#simLastEn')));
        const body = {
            studentId: overlay.querySelector('#simId').value.trim(),
            nameTh: names.nameTh,
            nameEn: names.nameEn,
            year: Number(overlay.querySelector('#simYear').value) || 1,
            gpa: Number(overlay.querySelector('#simGpa').value) || 0,
            status: overlay.querySelector('#simStatus').value,
        };
        try {
            await fetchAPI('/advisors/me/advisees', 'POST', body, 10000);
        } catch (err) {
            showAdvisorToast('error', esc(apiErrorText(err)));
            return;
        }
        overlay.classList.remove('open');
        showAdvisorToast('success', esc(`เพิ่มนักศึกษาจำลอง ${body.studentId} แล้ว`));
        loadLiveAdvisees();
    });
}
