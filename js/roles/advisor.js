import { esc, statusBadge, getBatch } from '../main.js';
import { MOCK_STUDENTS_POOL } from './admin.js';
import { impersonateStudent } from '../auth.js';
import { debounce } from '../utils.js';

let lastSelectedBatch = 'all';
let advisorSearchQuery = '';

export function initAdvisorDashboard() {
    renderAdvisorDashboard();
    renderMyAdvisees();
}

function renderAdvisorDashboard() {
    const myStudents = MOCK_STUDENTS_POOL.filter(s => s.advisor === 'ADV001');
    const avgGpa = myStudents.length ? (myStudents.reduce((a, c) => a + c.gpa, 0) / myStudents.length).toFixed(2) : '0.00';
    const batches = [...new Set(myStudents.map(s => getBatch(s.studentId)))].sort().reverse();
    const batchBreakdown = batches.map(b => {
        const count = myStudents.filter(s => getBatch(s.studentId) === b).length;
        return `<div class="stat-card"><div class="stat-icon blue">📦</div><div><div class="stat-value">${count}</div><div class="stat-label">รุ่น ${b} (Batch ${b})</div></div></div>`;
    }).join('');
    
    document.getElementById('advisorDashboardContent').innerHTML = `
        <div class="stat-row">
            <div class="stat-card"><div class="stat-icon purple">👥</div><div><div class="stat-value">${myStudents.length}</div><div class="stat-label">นักศึกษาทั้งหมด</div></div></div>
            <div class="stat-card"><div class="stat-icon green">📊</div><div><div class="stat-value">${avgGpa}</div><div class="stat-label">GPA เฉลี่ย</div></div></div>
            <div class="stat-card"><div class="stat-icon amber">✅</div><div><div class="stat-value">${myStudents.filter(s=>s.status==='กำลังศึกษา').length}</div><div class="stat-label">กำลังศึกษา</div></div></div>
            <div class="stat-card"><div class="stat-icon red">⚠️</div><div><div class="stat-value">${myStudents.filter(s=>s.status!=='กำลังศึกษา').length}</div><div class="stat-label">พักการศึกษา/พ้นสภาพ</div></div></div>
        </div>
        <div class="card">
            <div class="card-title">📦 จำนวนนักศึกษาแยกตามรุ่น</div>
            <div class="stat-row" style="margin-bottom:0">${batchBreakdown}</div>
        </div>
    `;
}

function renderMyAdvisees() {
    const myStudents = MOCK_STUDENTS_POOL.filter(s => s.advisor === 'ADV001');
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
                <div class="advisee-name">${esc(s.studentId)} ${esc(s.nameTh)}</div>
                <div class="advisee-detail">ปี ${s.year} · GPA: ${s.gpa.toFixed(2)} · ${esc(s.nameEn)}</div>
            </div>
            <span class="badge ${statusBadge(s.status)}">${esc(s.status)}</span>
            <div class="advisee-actions">
                <button class="btn btn-sm btn-orange adv-imp-btn" data-sid="${s.studentId}" data-sname="${esc(s.nameTh)}">จำลอง</button>
                <button class="btn btn-sm btn-ghost" onclick="alert('ฟังก์ชันดูประวัติ ${esc(s.studentId)} จะพร้อมใช้งานเร็วๆ นี้')">ดูประวัติ</button>
            </div>
        </div>
    `).join('');

    document.getElementById('myAdviseesContent').innerHTML = `
        <div class="batch-filter-bar">
            <label>กรองตามรุ่น</label>
            <select class="batch-select" id="advBatchFilter">${filterOpts}</select>
            <div class="filter-result-count">แสดง <strong>${filtered.length}</strong> จาก ${myStudents.length} คน</div>
            <div class="toolbar-search" style="margin-left:auto">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" id="advStudentSearch" placeholder="ค้นหารหัสนักศึกษา, ชื่อ..." value="${esc(advisorSearchQuery)}">
            </div>
        </div>
        <div class="card" style="background:transparent;box-shadow:none;border:none;padding:0">
            ${cards || '<div style="text-align:center;padding:40px;color:var(--text-muted)">ไม่พบข้อมูลนักศึกษา</div>'}
        </div>
    `;

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
}
