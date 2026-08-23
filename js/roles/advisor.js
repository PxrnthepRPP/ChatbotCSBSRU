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
    renderAdvisorCourses();
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

/* ============================================================
   MOCK DATA — Advisor's Courses & Exam Announcements
   ============================================================ */
export const MOCK_ADVISOR_COURSES = [
    { code: 'SC17351', name: 'Object-Oriented Programming', nameTh: 'การเขียนโปรแกรมเชิงวัตถุ' },
    { code: 'SC17411', name: 'Web Development', nameTh: 'การพัฒนาเว็บ' },
    { code: 'SC17402', name: 'Software Engineering', nameTh: 'วิศวกรรมซอฟต์แวร์' },
];

export const MOCK_EXAM_ANNOUNCEMENTS = [
    { code: 'SC17351', name: 'การเขียนโปรแกรมเชิงวัตถุ', date: '18 มี.ค. 2569', time: '09:00-12:00', room: 'HALL-A', announcedBy: 'ผศ.ดร.วิชัย เทคโนโลยี', announcedAt: '1 มี.ค. 2569' },
    { code: 'SC17411', name: 'การพัฒนาเว็บ', date: '20 มี.ค. 2569', time: '13:00-16:00', room: 'HALL-B', announcedBy: 'ผศ.ดร.วิชัย เทคโนโลยี', announcedAt: '1 มี.ค. 2569' },
];

/* ============================================================
   ADVISOR — Course Management & Exam Announcements
   ============================================================ */
function showAdvisorToast(type, message) {
    const existing = document.querySelector('.petition-toast');
    if (existing) existing.remove();

    const icons = {
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };
    const toast = document.createElement('div');
    toast.className = `petition-toast petition-toast-${type}`;
    toast.innerHTML = `
        <div class="petition-toast-icon">${icons[type] || icons.info}</div>
        <span class="petition-toast-msg">${message}</span>
        <button class="petition-toast-close" aria-label="ปิด">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    toast.querySelector('.petition-toast-close').addEventListener('click', () => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    });
    setTimeout(() => { if (toast.parentNode) { toast.classList.remove('visible'); setTimeout(() => toast.remove(), 300); } }, 5000);
}

export function renderAdvisorCourses() {
    const container = document.getElementById('advisorCoursesContent');
    if (!container) return;

    // Build courses table rows
    const courseRows = MOCK_ADVISOR_COURSES.map((c, i) => `
        <tr>
            <td><span class="badge badge-blue">${esc(c.code)}</span></td>
            <td>${esc(c.name)}</td>
            <td>${esc(c.nameTh)}</td>
            <td>
                <button class="btn btn-sm btn-ghost adv-del-course" data-idx="${i}" title="ลบ">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </button>
            </td>
        </tr>
    `).join('');

    // Build exam announcements table
    const examRows = MOCK_EXAM_ANNOUNCEMENTS.map((ex, i) => `
        <tr>
            <td><span class="badge badge-blue">${esc(ex.code)}</span></td>
            <td>${esc(ex.name)}</td>
            <td>${esc(ex.date)}</td>
            <td>${esc(ex.time)}</td>
            <td>${esc(ex.room)}</td>
            <td><span class="badge badge-green">ประกาศแล้ว</span></td>
            <td>
                <button class="btn btn-sm btn-ghost adv-del-exam" data-idx="${i}" title="ยกเลิก">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                </button>
            </td>
        </tr>
    `).join('');

    // Build course options for exam form
    const courseOptions = MOCK_ADVISOR_COURSES.map(c =>
        `<option value="${esc(c.code)}">${esc(c.code)} — ${esc(c.nameTh)}</option>`
    ).join('');

    container.innerHTML = `
        <!-- ═══ Section 1: My Courses ═══ -->
        <div class="card">
            <div class="card-title" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
                <span>📚 รายวิชาที่สอน <span class="badge badge-blue" style="font-size:0.75rem">${MOCK_ADVISOR_COURSES.length} วิชา</span></span>
                <button class="btn btn-sm btn-orange" id="advToggleAddCourse">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    เพิ่มวิชาที่สอน
                </button>
            </div>

            <!-- Add Course Form (hidden by default) -->
            <div id="advAddCourseForm" style="display:none" class="app-form-panel">
                <div class="app-form-header">
                    <div>
                        <div class="app-form-title">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                            เพิ่มรายวิชาที่สอน (Add Course Taught)
                        </div>
                        <div class="app-form-subtitle">กรอกรายละเอียดรายวิชาที่คุณรับผิดชอบการสอน</div>
                    </div>
                    <button type="button" class="btn btn-sm btn-ghost" id="advCloseCourseFormBtn" style="padding:4px 10px;font-size:0.8rem">✕ ปิด</button>
                </div>

                <div class="app-form-grid" style="grid-template-columns: 1fr 1.5fr 1.5fr;">
                    <div class="app-form-group">
                        <label class="app-form-label">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                            รหัสวิชา <span class="req">*</span>
                        </label>
                        <input type="text" id="advNewCourseCode" class="app-input" placeholder="เช่น CS3101 / SC17351" required>
                    </div>
                    <div class="app-form-group">
                        <label class="app-form-label">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                            ชื่อวิชา (English) <span class="req">*</span>
                        </label>
                        <input type="text" id="advNewCourseName" class="app-input" placeholder="e.g. Artificial Intelligence" required>
                    </div>
                    <div class="app-form-group">
                        <label class="app-form-label">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                            ชื่อวิชา (ภาษาไทย) <span class="req">*</span>
                        </label>
                        <input type="text" id="advNewCourseNameTh" class="app-input" placeholder="เช่น ปัญญาประดิษฐ์" required>
                    </div>
                </div>

                <div class="app-form-actions">
                    <button class="app-btn-primary" id="advSaveCourseBtn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        บันทึกรายวิชา
                    </button>
                    <button class="app-btn-ghost" id="advCancelCourseBtn">ยกเลิก</button>
                </div>
            </div>

            <div class="table-wrap">
                <table class="data-table" id="advCoursesTable">
                    <thead>
                        <tr><th>รหัสวิชา</th><th>ชื่อวิชา (EN)</th><th>ชื่อวิชา (TH)</th><th style="width:50px"></th></tr>
                    </thead>
                    <tbody>${courseRows || '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted)">ยังไม่มีรายวิชาที่สอน</td></tr>'}</tbody>
                </table>
            </div>
        </div>

        <!-- ═══ Section 2: Exam Announcements ═══ -->
        <div class="card">
            <div class="card-title" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
                <span>📝 ประกาศตารางสอบ <span class="badge badge-green" style="font-size:0.75rem">${MOCK_EXAM_ANNOUNCEMENTS.length} รายการ</span></span>
                <button class="btn btn-sm btn-orange" id="advToggleAddExam" ${MOCK_ADVISOR_COURSES.length === 0 ? 'disabled title="เพิ่มรายวิชาก่อน"' : ''}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    ประกาศสอบ
                </button>
            </div>

            <!-- Add Exam Form (hidden by default) -->
            <div id="advAddExamForm" style="display:none" class="app-form-panel">
                <div class="app-form-header">
                    <div>
                        <div class="app-form-title">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                            ประกาศตารางสอบใหม่ (Announce Exam)
                        </div>
                        <div class="app-form-subtitle">ตารางสอบจะเชื่อมโยงไปยังนักศึกษาที่ลงทะเบียนวิชานี้อัตโนมัติ</div>
                    </div>
                    <button type="button" class="btn btn-sm btn-ghost" id="advCloseExamFormBtn" style="padding:4px 10px;font-size:0.8rem">✕ ปิด</button>
                </div>

                <div class="app-form-grid">
                    <div class="app-form-group">
                        <label class="app-form-label">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                            เลือกวิชา <span class="req">*</span>
                        </label>
                        <select id="advExamCourseSelect" class="app-select">${courseOptions}</select>
                    </div>
                    <div class="app-form-group">
                        <label class="app-form-label">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            วันสอบ <span class="req">*</span>
                        </label>
                        <input type="date" id="advExamDate" class="app-input" required>
                    </div>
                    <div class="app-form-group">
                        <label class="app-form-label">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            เวลาเริ่ม <span class="req">*</span>
                        </label>
                        <input type="time" id="advExamTimeStart" class="app-input" value="09:00" required>
                    </div>
                    <div class="app-form-group">
                        <label class="app-form-label">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 8"/></svg>
                            เวลาสิ้นสุด <span class="req">*</span>
                        </label>
                        <input type="time" id="advExamTimeEnd" class="app-input" value="12:00" required>
                    </div>
                    <div class="app-form-group">
                        <label class="app-form-label">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                            ห้องสอบ <span class="req">*</span>
                        </label>
                        <input type="text" id="advExamRoom" class="app-input" placeholder="เช่น HALL-A / CS-Lab2" required>
                    </div>
                </div>

                <div class="app-form-actions">
                    <button class="app-btn-primary" id="advSaveExamBtn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        📢 ประกาศสอบ
                    </button>
                    <button class="app-btn-ghost" id="advCancelExamBtn">ยกเลิก</button>
                </div>
            </div>

            <div class="table-wrap">
                <table class="data-table" id="advExamsTable">
                    <thead>
                        <tr><th>รหัสวิชา</th><th>ชื่อวิชา</th><th>วันสอบ</th><th>เวลา</th><th>ห้องสอบ</th><th>สถานะ</th><th style="width:50px"></th></tr>
                    </thead>
                    <tbody>${examRows || '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">ยังไม่มีประกาศสอบ</td></tr>'}</tbody>
                </table>
            </div>
        </div>

        <!-- ═══ Info Card ═══ -->
        <div class="card" style="border-left:4px solid var(--blue-500);background:var(--blue-50, rgba(59,130,246,0.06))">
            <div style="display:flex;gap:12px;align-items:flex-start">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--blue-500)" stroke-width="2" style="width:24px;height:24px;flex-shrink:0;margin-top:2px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <div>
                    <div style="font-weight:600;margin-bottom:4px">ระบบประกาศสอบอัตโนมัติ</div>
                    <div style="font-size:0.85rem;color:var(--text-muted)">เมื่ออาจารย์ประกาศสอบ ระบบจะแสดงตารางสอบให้กับนักศึกษาที่ลงทะเบียนเรียนวิชานั้นโดยอัตโนมัติ (เทียบจากรหัสวิชาในตารางเรียนของนักศึกษา)</div>
                </div>
            </div>
        </div>
    `;

    // ── Event: Toggle & Close Add Course Form ──
    const closeCourseForm = () => {
        const form = document.getElementById('advAddCourseForm');
        if (form) form.style.display = 'none';
    };
    document.getElementById('advToggleAddCourse').addEventListener('click', () => {
        const form = document.getElementById('advAddCourseForm');
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
    });
    const cancelCourseBtn = document.getElementById('advCancelCourseBtn');
    if (cancelCourseBtn) cancelCourseBtn.addEventListener('click', closeCourseForm);
    const closeCourseBtn = document.getElementById('advCloseCourseFormBtn');
    if (closeCourseBtn) closeCourseBtn.addEventListener('click', closeCourseForm);

    // Clear errors on input
    ['advNewCourseCode', 'advNewCourseName', 'advNewCourseNameTh', 'advExamDate', 'advExamTimeStart', 'advExamTimeEnd', 'advExamRoom'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => el.classList.remove('is-invalid'));
            el.addEventListener('change', () => el.classList.remove('is-invalid'));
        }
    });

    // ── Event: Save New Course ──
    document.getElementById('advSaveCourseBtn').addEventListener('click', () => {
        const elCode = document.getElementById('advNewCourseCode');
        const elName = document.getElementById('advNewCourseName');
        const elNameTh = document.getElementById('advNewCourseNameTh');

        const code = elCode.value.trim();
        const name = elName.value.trim();
        const nameTh = elNameTh.value.trim();

        [elCode, elName, elNameTh].forEach(el => el.classList.remove('is-invalid'));

        if (!code || !name || !nameTh) {
            if (!code) elCode.classList.add('is-invalid');
            if (!name) elName.classList.add('is-invalid');
            if (!nameTh) elNameTh.classList.add('is-invalid');
            showAdvisorToast('error', 'กรุณากรอกข้อมูลให้ครบทุกช่อง');
            return;
        }
        if (MOCK_ADVISOR_COURSES.some(c => c.code === code)) {
            elCode.classList.add('is-invalid');
            showAdvisorToast('error', `รหัสวิชา ${code} มีอยู่แล้ว`);
            return;
        }
        MOCK_ADVISOR_COURSES.push({ code, name, nameTh });
        showAdvisorToast('success', `เพิ่มวิชา ${code} — ${nameTh} สำเร็จ`);
        renderAdvisorCourses();
    });

    // ── Event: Delete Course ──
    document.querySelectorAll('.adv-del-course').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx, 10);
            const removed = MOCK_ADVISOR_COURSES.splice(idx, 1)[0];
            // Also remove related exam announcements
            for (let i = MOCK_EXAM_ANNOUNCEMENTS.length - 1; i >= 0; i--) {
                if (MOCK_EXAM_ANNOUNCEMENTS[i].code === removed.code) MOCK_EXAM_ANNOUNCEMENTS.splice(i, 1);
            }
            showAdvisorToast('info', `ลบวิชา ${removed.code} และประกาศสอบที่เกี่ยวข้องแล้ว`);
            renderAdvisorCourses();
        });
    });

    // ── Event: Toggle & Close Add Exam Form ──
    const closeExamForm = () => {
        const form = document.getElementById('advAddExamForm');
        if (form) form.style.display = 'none';
    };
    document.getElementById('advToggleAddExam').addEventListener('click', () => {
        const form = document.getElementById('advAddExamForm');
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
    });
    const cancelExamBtn = document.getElementById('advCancelExamBtn');
    if (cancelExamBtn) cancelExamBtn.addEventListener('click', closeExamForm);
    const closeExamBtn = document.getElementById('advCloseExamFormBtn');
    if (closeExamBtn) closeExamBtn.addEventListener('click', closeExamForm);

    // ── Event: Save Exam Announcement ──
    document.getElementById('advSaveExamBtn').addEventListener('click', () => {
        const elCourse = document.getElementById('advExamCourseSelect');
        const elDate = document.getElementById('advExamDate');
        const elStart = document.getElementById('advExamTimeStart');
        const elEnd = document.getElementById('advExamTimeEnd');
        const elRoom = document.getElementById('advExamRoom');

        const courseCode = elCourse.value;
        const dateVal = elDate.value;
        const timeStart = elStart.value;
        const timeEnd = elEnd.value;
        const room = elRoom.value.trim();

        [elDate, elStart, elEnd, elRoom].forEach(el => el.classList.remove('is-invalid'));

        if (!courseCode || !dateVal || !timeStart || !timeEnd || !room) {
            if (!dateVal) elDate.classList.add('is-invalid');
            if (!timeStart) elStart.classList.add('is-invalid');
            if (!timeEnd) elEnd.classList.add('is-invalid');
            if (!room) elRoom.classList.add('is-invalid');
            showAdvisorToast('error', 'กรุณากรอกข้อมูลให้ครบทุกช่อง');
            return;
        }
        if (MOCK_EXAM_ANNOUNCEMENTS.some(ex => ex.code === courseCode)) {
            elCourse.classList.add('is-invalid');
            showAdvisorToast('error', `วิชา ${courseCode} มีประกาศสอบอยู่แล้ว`);
            return;
        }

        const course = MOCK_ADVISOR_COURSES.find(c => c.code === courseCode);
        const [y, m, d] = dateVal.split('-');
        const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const thDate = `${parseInt(d)} ${months[parseInt(m) - 1]} ${parseInt(y) + 543}`;

        const now = new Date();
        const nowStr = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear() + 543}`;

        MOCK_EXAM_ANNOUNCEMENTS.push({
            code: courseCode,
            name: course ? course.nameTh : courseCode,
            date: thDate,
            time: `${timeStart}-${timeEnd}`,
            room,
            announcedBy: 'ผศ.ดร.วิชัย เทคโนโลยี',
            announcedAt: nowStr,
        });

        showAdvisorToast('success', `ประกาศสอบวิชา ${courseCode} — ${thDate} สำเร็จ 🎉`);
        renderAdvisorCourses();
    });

    // ── Event: Delete Exam ──
    document.querySelectorAll('.adv-del-exam').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx, 10);
            const removed = MOCK_EXAM_ANNOUNCEMENTS.splice(idx, 1)[0];
            showAdvisorToast('info', `ยกเลิกประกาศสอบ ${removed.code} แล้ว`);
            renderAdvisorCourses();
        });
    });
}
