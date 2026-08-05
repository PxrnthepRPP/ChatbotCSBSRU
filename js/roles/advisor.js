/* ================================================================
   BSRU Student Portal — Advisor Role Logic & Dashboard
   ================================================================
   Handles Advisor Dashboard analytics for advisees academic status
   (graduated, studying, on leave, dismissed) and advisee list management.
   ================================================================ */

import { esc, statusBadge, getBatch } from '../main.js';
import { MOCK_STUDENTS_POOL } from './admin.js';
import { impersonateStudent } from '../auth.js';
import { debounce } from '../utils.js';
import { loadComponentCSS } from '../css-loader.js';

let lastSelectedBatch = 'all';
let advisorSearchQuery = '';

export function initAdvisorDashboard() {
    renderAdvisorDashboard();
    renderMyAdvisees();
}

function renderAdvisorDashboard() {
    const myStudents = MOCK_STUDENTS_POOL.filter(s => s.advisor === 'ADV001');
    const total = myStudents.length;
    
    // Academic Status breakdown
    const studying = myStudents.filter(s => s.status === 'กำลังศึกษา');
    const graduated = myStudents.filter(s => s.status === 'จบการศึกษา');
    const onLeave = myStudents.filter(s => s.status === 'พักการศึกษา');
    const dismissed = myStudents.filter(s => s.status === 'พ้นสภาพ');

    const studyingPct = total > 0 ? ((studying.length / total) * 100).toFixed(1) : '0.0';
    const graduatedPct = total > 0 ? ((graduated.length / total) * 100).toFixed(1) : '0.0';
    const onLeavePct = total > 0 ? ((onLeave.length / total) * 100).toFixed(1) : '0.0';
    const dismissedPct = total > 0 ? ((dismissed.length / total) * 100).toFixed(1) : '0.0';

    const avgGpa = total ? (myStudents.reduce((a, c) => a + c.gpa, 0) / total).toFixed(2) : '0.00';

    // Batch breakdown
    const batches = [...new Set(myStudents.map(s => getBatch(s.studentId)))].sort().reverse();
    const batchBreakdown = batches.map(b => {
        const count = myStudents.filter(s => getBatch(s.studentId) === b).length;
        return `<div class="stat-card"><div class="stat-icon blue">📦</div><div><div class="stat-value">${count}</div><div class="stat-label">รุ่น ${b} (Batch ${b})</div></div></div>`;
    }).join('');

    document.getElementById('advisorDashboardContent').innerHTML = `
        <!-- Top Stat Cards (4 Cards) -->
        <div class="stat-row">
            <div class="stat-card"><div class="stat-icon purple">👥</div><div><div class="stat-value">${total}</div><div class="stat-label">นักศึกษาทั้งหมด</div></div></div>
            <div class="stat-card"><div class="stat-icon green">📗</div><div><div class="stat-value">${studying.length}</div><div class="stat-label">กำลังศึกษา (ยังไม่จบ)</div></div></div>
            <div class="stat-card"><div class="stat-icon blue">🎓</div><div><div class="stat-value">${graduated.length}</div><div class="stat-label">จบการศึกษาแล้ว</div></div></div>
            <div class="stat-card"><div class="stat-icon amber">⏸️</div><div><div class="stat-value">${onLeave.length + dismissed.length}</div><div class="stat-label">พักการเรียน / พ้นสภาพ</div></div></div>
        </div>

        <!-- Advisee Academic Status Breakdown Card -->
        <div class="chart-card">
            <div class="chart-card-header">
                <div class="chart-card-title">
                    <span class="chart-card-icon">📊</span>
                    สรุปสถานภาพการศึกษาของนักศึกษาในความดูแล
                </div>
                <div class="chart-card-subtitle">Advisee Academic Status Summary — นักศึกษาในที่ปรึกษาทั้งหมด ${total} คน (GPA เฉลี่ย ${avgGpa})</div>
            </div>
            <div class="career-list-scroll" style="max-height: 400px; padding-right: 4px;">
                <div class="career-item">
                    <div class="career-item-header">
                        <div class="career-name-group">
                            <span class="career-icon">📗</span>
                            <span class="career-name">กำลังศึกษา (ยังไม่จบ)</span>
                        </div>
                        <div class="career-stat-group">
                            <span class="career-count">${studying.length} คน</span>
                            <span class="career-badge badge-green">${studyingPct}%</span>
                        </div>
                    </div>
                    <div class="career-progress-bg">
                        <div class="career-progress-fill" style="width: ${studyingPct}%; background: linear-gradient(90deg, #16a34a, #22c55e);"></div>
                    </div>
                </div>

                <div class="career-item">
                    <div class="career-item-header">
                        <div class="career-name-group">
                            <span class="career-icon">🎓</span>
                            <span class="career-name">จบการศึกษาแล้ว</span>
                        </div>
                        <div class="career-stat-group">
                            <span class="career-count">${graduated.length} คน</span>
                            <span class="career-badge badge-blue">${graduatedPct}%</span>
                        </div>
                    </div>
                    <div class="career-progress-bg">
                        <div class="career-progress-fill" style="width: ${graduatedPct}%; background: linear-gradient(90deg, #2563eb, #3b82f6);"></div>
                    </div>
                </div>

                <div class="career-item item-business">
                    <div class="career-item-header">
                        <div class="career-name-group">
                            <span class="career-icon">⏸️</span>
                            <span class="career-name">พักการศึกษา (ลาพักการเรียน)</span>
                        </div>
                        <div class="career-stat-group">
                            <span class="career-count">${onLeave.length} คน</span>
                            <span class="career-badge badge-business">${onLeavePct}%</span>
                        </div>
                    </div>
                    <div class="career-progress-bg">
                        <div class="career-progress-fill fill-business" style="width: ${onLeavePct}%;"></div>
                    </div>
                </div>

                <div class="career-item item-unemployed">
                    <div class="career-item-header">
                        <div class="career-name-group">
                            <span class="career-icon">⛔</span>
                            <span class="career-name">พ้นสภาพการเป็นนักศึกษา</span>
                        </div>
                        <div class="career-stat-group">
                            <span class="career-count">${dismissed.length} คน</span>
                            <span class="career-badge badge-unemployed">${dismissedPct}%</span>
                        </div>
                    </div>
                    <div class="career-progress-bg">
                        <div class="career-progress-fill fill-unemployed" style="width: ${dismissedPct}%;"></div>
                    </div>
                </div>
            </div>
            <div class="career-list-footer">
                <div class="career-legend-hint">
                    <span class="career-legend-dot" style="background:#22c55e"></span>
                    <span>กำลังศึกษา (ยังไม่จบ)</span>
                </div>
                <div class="career-legend-hint">
                    <span class="career-legend-dot" style="background:#3b82f6"></span>
                    <span>จบการศึกษาแล้ว</span>
                </div>
                <div class="career-legend-hint">
                    <span class="career-legend-dot" style="background:#f59e0b"></span>
                    <span>พักการเรียน</span>
                </div>
                <div class="career-legend-hint">
                    <span class="career-legend-dot" style="background:#ef4444"></span>
                    <span>พ้นสภาพ</span>
                </div>
            </div>
        </div>

        <!-- Bottom Card: Batch Breakdown -->
        <div class="card">
            <div class="card-title">📦 จำนวนนักศึกษาในความดูแลแยกตามรุ่น</div>
            <div class="stat-row" style="margin-bottom:0">${batchBreakdown}</div>
        </div>
    `;

    // Load component CSS for progress bars
    loadComponentCSS('statusChart');
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
