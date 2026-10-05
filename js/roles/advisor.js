/* ================================================================
   BSRU Student Portal — Advisor Role Logic & Dashboard
   ================================================================
   Handles Advisor Dashboard analytics for advisees academic status
   (graduated, studying, on leave, dismissed) and advisee list management.
   ================================================================ */

import { esc, statusBadge, getBatch, debounce, fetchAPI } from '../utils.js';
import { MOCK_STUDENTS_POOL, apiErrorText, sectionStatusBadge } from './admin.js';
import { impersonateStudent, getAuthState } from '../auth.js';
import { loadComponentCSS } from '../css-loader.js';
import { askChatbot } from '../components/chatbot.js';

let lastSelectedBatch = 'all';
let advisorSearchQuery = '';

/* ============================================================
   LIVE ADVISEES — real students of the logged-in advisor (GET /advisors/me/advisees)
   with the rule-based risk check; falls back to the mock list when offline.
   ============================================================ */
let liveAdvisees = null;   // AdviseeRisk[] from the backend, null = offline / not loaded

const RISK_LEVEL = {
    HIGH: { badge: 'badge-red', text: 'เสี่ยงสูง' },
    MEDIUM: { badge: 'badge-amber', text: 'เฝ้าระวัง' },
    LOW: { badge: 'badge-green', text: 'ปกติ' },
};

/** The advisor's students in the shape the dashboard uses */
function currentAdvisees() {
    if (liveAdvisees) {
        return liveAdvisees.map(r => ({
            studentId: r.studentId, nameTh: r.nameTh, nameEn: r.nameEn || '', year: r.year,
            gpa: r.gpa ?? 0, status: r.status, risk: r,
        }));
    }
    return MOCK_STUDENTS_POOL.filter(s => s.advisor === 'ADV001');
}

async function loadLiveAdvisees() {
    try {
        liveAdvisees = await fetchAPI('/advisors/me/advisees', 'GET', null, 10000);
    } catch (err) {
        console.warn('[Advisor] Backend unavailable, showing sample advisees:', err.message);
        return;
    }
    renderAdvisorDashboard();
    renderMyAdvisees();
}

function riskBadge(r) {
    const lv = RISK_LEVEL[r.level] || RISK_LEVEL.LOW;
    return `<span class="badge ${lv.badge}">${lv.text}</span>`;
}

function riskChips(r) {
    return [r.riskRetire && 'เสี่ยงรีไทร์', r.riskFail && 'เสี่ยงตก', r.riskDrop && 'เสี่ยงต้องถอนรายวิชา']
        .filter(Boolean)
        .map(t => `<span class="badge badge-red" style="font-size:0.7rem">${t}</span>`).join(' ');
}

const ASK_ALL = 'ช่วยวิเคราะห์ว่านักศึกษาในความดูแลของฉันคนไหนเสี่ยงพ้นสภาพ (รีไทร์) เสี่ยงตก หรือเสี่ยงต้องถอนรายวิชา เรียงจากเสี่ยงมากไปน้อย พร้อมเหตุผลและแนวทางช่วยเหลือ';
const askAbout = r => `ช่วยวิเคราะห์นักศึกษา ${r.studentId} ${r.nameTh} ว่ามีความเสี่ยงอะไรบ้าง (พ้นสภาพ ตก ถอนรายวิชา จบช้า) และควรช่วยเหลืออย่างไร`;

/** Dashboard card: who needs attention, from the same risk check the chatbot uses */
function riskCardHtml() {
    if (!liveAdvisees) return '';
    const flagged = liveAdvisees.filter(r => r.level !== 'LOW');
    const rows = flagged.map(r => `
        <div class="advisee-card">
            <div class="advisee-info">
                <div class="advisee-name">${esc(r.studentId)} ${esc(r.nameTh)} ${r.simulated ? '<span class="badge badge-amber" style="font-size:0.7rem">จำลอง</span> ' : ''}${riskBadge(r)} ${riskChips(r)}</div>
                <div class="advisee-detail">ปี ${r.year} · GPA ${r.gpa != null ? Number(r.gpa).toFixed(2) : '-'} · ${esc(r.factors[0]?.message || '')}</div>
            </div>
            <div class="advisee-actions">
                <button class="btn btn-sm btn-ghost adv-history-btn" data-sid="${esc(r.studentId)}">ดูประวัติ</button>
            </div>
        </div>`).join('');
    return `
        <div class="card">
            <div class="card-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                <span>⚠️ นักศึกษาที่ต้องติดตาม <span class="badge ${flagged.length ? 'badge-red' : 'badge-green'}" style="font-size:0.75rem">${flagged.length} คน</span></span>
                <button class="btn btn-sm btn-orange adv-ai-all-btn">🤖 ให้ AI วิเคราะห์ความเสี่ยงทั้งหมด</button>
            </div>
            <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:10px">ประเมินเบื้องต้นจากข้อมูลจริงในระบบ (GPA, เกรด F/D, แนวโน้มรายเทอม, หน่วยกิตที่ลง, เวลาเรียนชน) · <a href="#" class="adv-criteria-link">ดูเกณฑ์ที่ใช้</a></p>
            ${rows || '<div style="color:var(--text-muted)">ไม่มีนักศึกษาที่เข้าเกณฑ์เสี่ยง</div>'}
        </div>`;
}

function bindAdviseeButtons(container) {
    container.querySelectorAll('.adv-history-btn').forEach(b => b.addEventListener('click', () => openAdviseeHistory(b.dataset.sid)));
    container.querySelectorAll('.adv-ai-all-btn').forEach(b => b.addEventListener('click', () => askChatbot(ASK_ALL)));
    container.querySelectorAll('.adv-ai-one-btn').forEach(b => b.addEventListener('click', () => {
        const r = liveAdvisees?.find(x => x.studentId === b.dataset.sid);
        document.getElementById('advHistoryModal')?.classList.remove('open');
        if (r) askChatbot(askAbout(r));
    }));
    container.querySelectorAll('.adv-criteria-link').forEach(a => a.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            const me = await fetchAPI('/advisors/me');
            showAdvisorModal('เกณฑ์การประเมินความเสี่ยง', `<pre style="white-space:pre-wrap;font-family:inherit;font-size:0.88rem;line-height:1.7">${esc(me.riskCriteria)}</pre>`);
        } catch (err) {
            showAdvisorToast('error', esc(apiErrorText(err)));
        }
    }));
}

function showAdvisorModal(title, html) {
    let overlay = document.getElementById('advHistoryModal');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'advHistoryModal';
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-card" style="max-width:900px;width:94vw;max-height:88vh;overflow:auto">
                <div class="modal-header">
                    <h3 id="advHistoryTitle"></h3>
                    <button class="modal-close" id="advHistoryClose" aria-label="ปิด">✕</button>
                </div>
                <div class="modal-body" id="advHistoryBody"></div>
            </div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
        overlay.querySelector('#advHistoryClose').addEventListener('click', () => overlay.classList.remove('open'));
    }
    overlay.querySelector('#advHistoryTitle').textContent = title;
    overlay.querySelector('#advHistoryBody').innerHTML = html;
    overlay.classList.add('open');
    return overlay;
}

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const thaiDate = iso => {
    const [y, m, d] = (iso || '').split('-').map(Number);
    return y && m && d ? `${d} ${THAI_MONTHS[m - 1]} ${y + 543}` : '-';
};

/** The same profile the student sees on their "ประวัตินักศึกษา" page */
function profileHtml(p) {
    const row = (label, value) => `
        <div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid var(--g-100);font-size:0.86rem">
            <span style="color:var(--text-muted)">${label}</span><span style="text-align:right">${value}</span>
        </div>`;
    return `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:0 24px">
            <div>
                ${row('ชื่อ-สกุล', esc(p.nameTh))}
                ${row('Name', esc(p.nameEn || '-'))}
                ${row('คณะ', esc(p.faculty || '-'))}
                ${row('สาขาวิชา', esc(p.department || '-'))}
                ${row('ชั้นปี / ปีที่เข้าศึกษา', `ปี ${p.year} / ${p.admissionYear || '-'}`)}
                ${row('อาจารย์ที่ปรึกษา', esc(p.advisor?.nameTh || '-'))}
            </div>
            <div>
                ${row('วันเกิด', thaiDate(p.birthDate))}
                ${row('ศาสนา', esc(p.religion || '-'))}
                ${row('อีเมล', p.email ? `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : '-')}
                ${row('โทรศัพท์', p.phone ? `<a href="tel:${esc(p.phone)}">${esc(p.phone)}</a>` : '-')}
                ${row('ที่อยู่ปัจจุบัน', esc(p.address || '-'))}
                ${row('สายอาชีพ', esc(p.careerPath || 'ยังไม่ได้ระบุ'))}
            </div>
        </div>`;
}

/** "ดูประวัติ": profile, GPA by semester, F/D courses, graduation audit, current timetable, petitions, risk */
async function openAdviseeHistory(studentId) {
    let d;
    try {
        d = await fetchAPI(`/advisors/me/advisees/${encodeURIComponent(studentId)}`, 'GET', null, 10000);
    } catch (err) {
        showAdvisorToast('error', esc(apiErrorText(err)));
        return;
    }
    const r = d.risk;
    const p = d.profile;
    const section = (title, body) => `<div style="margin-top:16px"><div style="font-weight:700;margin-bottom:6px">${title}</div>${body}</div>`;

    const factors = r.factors.length
        ? `<ul style="margin:0;padding-left:20px">${r.factors.map(f => `<li style="margin-bottom:6px"><span class="badge ${RISK_LEVEL[f.level].badge}" style="font-size:0.7rem">${RISK_LEVEL[f.level].text}</span> ${esc(f.message)}<div style="font-size:0.8rem;color:var(--text-muted)">→ ${esc(f.suggestion)}</div></li>`).join('')}</ul>`
        : '<div style="color:var(--text-muted)">ไม่พบสัญญาณเสี่ยงตามเกณฑ์</div>';

    const trend = r.terms.length
        ? r.terms.map(t => `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:0.85rem">
                <span style="width:52px">${esc(t.term)}</span>
                <div style="flex:1;background:var(--g-100);border-radius:6px;height:10px;overflow:hidden">
                    <div style="width:${Math.min(100, t.gpa / 4 * 100)}%;height:100%;background:${t.gpa < 2 ? 'var(--red-500)' : t.gpa < 2.5 ? 'var(--amber-500)' : 'var(--green-500)'}"></div>
                </div>
                <strong style="width:40px;text-align:right">${Number(t.gpa).toFixed(2)}</strong>
                <span style="width:60px;color:var(--text-muted)">${t.credits} นก.</span>
            </div>`).join('')
        : '<div style="color:var(--text-muted)">ยังไม่มีผลการเรียน</div>';

    const grades = Object.entries(r.gradeCounts).filter(([, n]) => n > 0)
        .map(([g, n]) => `<span class="badge ${g === 'F' ? 'badge-red' : g.startsWith('D') ? 'badge-amber' : 'badge-blue'}">${g} × ${n}</span>`).join(' ');

    const courseList = list => list.length
        ? list.map(c => `<div style="font-size:0.85rem">${esc(c.code)} ${esc(c.name)} — <strong>${esc(c.grade)}</strong> (${esc(c.term)})</div>`).join('')
        : '<div style="color:var(--text-muted);font-size:0.85rem">ไม่มี</div>';

    const audit = d.auditSummary
        ? `<div style="font-size:0.88rem">${esc(d.auditSummary.status)} · ${d.auditSummary.totalEarnedCredits}/${d.auditSummary.totalRequiredCredits} หน่วยกิต · ผ่าน ${d.auditSummary.passedCategories}/${d.auditSummary.totalCategories} หมวด</div>
           ${d.auditUnits.filter(u => u.status !== 'PASS').map(u => `<div style="font-size:0.82rem;color:var(--text-muted)">• ${esc(u.title)} — ${esc(u.note)}</div>`).join('')}`
        : '<div style="color:var(--text-muted)">ยังไม่มีใบตรวจสอบจบ</div>';

    const term = d.timetable.find(t => t.registration) || d.timetable[0];
    const timetable = term
        ? `<div style="font-size:0.88rem">${esc(term.label)} · ${term.totalCredits} หน่วยกิต${term.conflicts.length ? ` · <span style="color:var(--red-600)">เวลาชน: ${esc(term.conflicts.join(', '))}</span>` : ''}</div>
           ${term.sessions.map(s => `<div style="font-size:0.82rem;color:var(--text-muted)">• ${esc(s.courseCode)} ${esc(s.courseName)} — ${esc(s.dayName)} ${esc(s.startTime)}–${esc(s.endTime)} (Sec ${esc(s.sectionNo)})${s.enrollmentStatus === 'PENDING' ? ' · รอยืนยัน' : ''}</div>`).join('')}`
        : '<div style="color:var(--text-muted)">ยังไม่มีตารางเรียน</div>';

    const petitions = d.petitions.length
        ? d.petitions.map(pt => `<div style="font-size:0.85rem">• ${esc(pt.title)} <span class="badge badge-blue" style="font-size:0.7rem">${esc(pt.status)}</span></div>`).join('')
        : '<div style="color:var(--text-muted);font-size:0.85rem">ไม่มีคำร้อง</div>';

    const overlay = showAdvisorModal(`ประวัติ ${r.studentId} ${r.nameTh}`, `
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:flex-start">
            <div>
                <div style="font-size:0.9rem">${esc(p.nameEn || '')} · ชั้นปี ${p.year} · Sec ${esc(p.studentSection || '-')} · <span class="badge ${statusBadge(p.status)}">${esc(p.status)}</span></div>
                <div style="font-size:1.4rem;font-weight:800;margin-top:4px">GPA ${r.gpa != null ? Number(r.gpa).toFixed(2) : '-'} <span style="font-size:0.8rem;font-weight:400;color:var(--text-muted)">(${esc(r.gpaSource)})</span></div>
                <div style="margin-top:4px">${riskBadge(r)} ${riskChips(r)}</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="btn btn-sm btn-orange adv-ai-one-btn" data-sid="${esc(r.studentId)}">🤖 ให้ AI วิเคราะห์</button>
                <button class="btn btn-sm btn-ghost adv-history-imp-btn">จำลองมุมมองนักศึกษา</button>
            </div>
        </div>
        ${section('👤 ข้อมูลส่วนตัว (จากโปรไฟล์นักศึกษา)', profileHtml(p))}
        ${section('⚠️ ปัจจัยเสี่ยงและข้อเสนอแนะ', factors)}
        ${section('📈 GPA รายเทอม', trend)}
        ${section('🧾 จำนวนเกรด', grades || '<span style="color:var(--text-muted)">-</span>')}
        ${section('❌ วิชาที่ได้ F', courseList(r.failedCourses))}
        ${section('⚠️ วิชาที่ได้ D / D+', courseList(r.lowGradeCourses))}
        ${section('🎓 ตรวจสอบจบ', audit)}
        ${section('🗓️ ตารางเรียนเทอมปัจจุบัน', timetable)}
        ${section('📝 คำร้อง', petitions)}
    `);
    bindAdviseeButtons(overlay);
    overlay.querySelector('.adv-history-imp-btn').addEventListener('click', () => {
        overlay.classList.remove('open');
        impersonateStudent(r.studentId, r.nameTh);
    });
}

export function initAdvisorDashboard() {
    renderAdvisorDashboard();
    renderMyAdvisees();
    renderAdvisorCourses();
    loadLiveAdvisees();
}

function renderAdvisorDashboard() {
    const myStudents = currentAdvisees();
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

        ${riskCardHtml()}

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
    bindAdviseeButtons(document.getElementById('advisorDashboardContent'));
}

function renderMyAdvisees() {
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
                <button class="btn btn-sm btn-orange adv-imp-btn" data-sid="${s.studentId}" data-sname="${esc(s.nameTh)}">จำลอง</button>
                ${s.risk
                    ? `<button class="btn btn-sm btn-ghost adv-history-btn" data-sid="${esc(s.studentId)}">ดูประวัติ</button>
                       <button class="btn btn-sm btn-ghost adv-ai-one-btn" data-sid="${esc(s.studentId)}" title="ให้ AI วิเคราะห์">🤖</button>
                       ${s.risk.simulated ? `<button class="btn btn-sm btn-ghost adv-del-sim-btn" data-sid="${esc(s.studentId)}" data-sname="${esc(s.nameTh)}" title="ลบข้อมูลจำลอง">🗑️</button>` : ''}`
                    : '<button class="btn btn-sm btn-ghost" disabled title="ต้องเชื่อมต่อ backend">ดูประวัติ</button>'}
            </div>
        </div>
    `).join('');

    document.getElementById('myAdviseesContent').innerHTML = `
        <div class="batch-filter-bar">
            <label>กรองตามรุ่น</label>
            <select class="batch-select" id="advBatchFilter">${filterOpts}</select>
            <div class="filter-result-count">แสดง <strong>${filtered.length}</strong> จาก ${myStudents.length} คน</div>
            <div class="toolbar-search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" id="advStudentSearch" placeholder="ค้นหารหัสนักศึกษา, ชื่อ..." value="${esc(advisorSearchQuery)}">
            </div>
            ${liveAdvisees ? '<button class="btn btn-sm btn-orange" id="advAddSimBtn">➕ เพิ่มนักศึกษาจำลอง</button>' : ''}
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
    bindAdviseeButtons(document.getElementById('myAdviseesContent'));
    document.getElementById('advAddSimBtn')?.addEventListener('click', openAddSimulatedModal);
    document.querySelectorAll('.adv-del-sim-btn').forEach(b => b.addEventListener('click', async () => {
        if (!confirm(`ลบข้อมูลจำลอง ${b.dataset.sname} (${b.dataset.sid})?`)) return;
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
    const field = (label, input) => `<div class="modal-field"><label>${label}</label>${input}</div>`;
    const overlay = showAdvisorModal('เพิ่มนักศึกษาจำลอง', `
        <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:10px">ข้อมูลจำลองใช้แสดงในแดชบอร์ดเท่านั้น ไม่มีบัญชีเข้าสู่ระบบและผลการเรียน · จะอยู่ในความดูแลของคุณ</p>
        ${field('รหัสนักศึกษา (10 หลัก)', '<input id="simId" maxlength="10" placeholder="เช่น 6721100001">')}
        ${field('ชื่อ-สกุล (ไทย)', '<input id="simNameTh" placeholder="เช่น นายทดลอง ใจดี">')}
        ${field('ชื่อ-สกุล (English)', '<input id="simNameEn" placeholder="e.g. Mr. Tadlong Jaidee">')}
        ${field('ชั้นปี', '<input id="simYear" type="number" min="1" max="8" value="1">')}
        ${field('GPA', '<input id="simGpa" type="number" min="0" max="4" step="0.01" value="0">')}
        ${field('สถานะ', `<select id="simStatus">${['กำลังศึกษา', 'จบการศึกษา', 'พักการศึกษา', 'พ้นสภาพ'].map(x => `<option>${x}</option>`).join('')}</select>`)}
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
            <button class="btn btn-orange" id="simSave">บันทึก</button>
        </div>`);
    overlay.querySelector('#simSave').addEventListener('click', async () => {
        const body = {
            studentId: overlay.querySelector('#simId').value.trim(),
            nameTh: overlay.querySelector('#simNameTh').value.trim(),
            nameEn: overlay.querySelector('#simNameEn').value.trim(),
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

/* ============================================================
   MOCK DATA — Advisor's Courses & Exam Announcements
   ============================================================ */
export const MOCK_ADVISOR_COURSES = [
    { code: 'SC17351', name: 'Object-Oriented Programming', nameTh: 'การเขียนโปรแกรมเชิงวัตถุ' },
    { code: 'SC17411', name: 'Web Development', nameTh: 'การพัฒนาเว็บ' },
    { code: 'SC17402', name: 'Software Engineering', nameTh: 'วิศวกรรมซอฟต์แวร์' },
];

export const MOCK_EXAM_ANNOUNCEMENTS = [
    { code: 'SC17351', name: 'การเขียนโปรแกรมเชิงวัตถุ', date: '18 มี.ค. 2569', time: '09:00-12:00', room: 'HALL-A', announcedBy: getAuthState().user?.displayName || 'อาจารย์ผู้สอน', announcedAt: '1 มี.ค. 2569' },
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

const DAY_NAMES_TH = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

/** One entry per course code, for the exam announcement form */
function uniqueCourses(sections) {
    const byCode = new Map();
    sections.forEach(s => { if (!byCode.has(s.courseCode)) byCode.set(s.courseCode, { code: s.courseCode, nameTh: s.courseName }); });
    return [...byCode.values()];
}

export async function renderAdvisorCourses() {
    const container = document.getElementById('advisorCoursesContent');
    if (!container) return;

    // Real sections from the backend; null = backend offline, fall back to the demo course list
    let sections = null;
    try {
        sections = await fetchAPI('/sections/mine');
    } catch (err) {
        sections = null;
    }
    const courseList = sections ? uniqueCourses(sections) : MOCK_ADVISOR_COURSES;

    // Build exam announcements table
    const examRows = MOCK_EXAM_ANNOUNCEMENTS.map((ex, i) => `
        <tr>
            <td><span class="badge badge-blue">${esc(ex.code)}</span></td>
            <td>${esc(ex.name)}</td>
            <td>${esc(ex.date)}</td>
            <td class="hide-mobile">${esc(ex.time)}</td>
            <td class="hide-mobile">${esc(ex.room)}</td>
            <td><span class="badge badge-green">ประกาศแล้ว</span></td>
            <td>
                <button class="btn btn-sm btn-ghost adv-del-exam" data-idx="${i}" title="ยกเลิก">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                </button>
            </td>
        </tr>
    `).join('');

    // Build course options for exam form
    const courseOptions = courseList.map(c =>
        `<option value="${esc(c.code)}">${esc(c.code)} — ${esc(c.nameTh)}</option>`
    ).join('');

    container.innerHTML = `
        <!-- ═══ Section 1: Class sections I teach ═══ -->
        ${sections ? sectionsCardHtml(sections) : offlineCoursesCardHtml()}

        <!-- ═══ Section 2: Exam Announcements ═══ -->
        <div class="card">
            <div class="card-title" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
                <span>📝 ประกาศตารางสอบ <span class="badge badge-green" style="font-size:0.75rem">${MOCK_EXAM_ANNOUNCEMENTS.length} รายการ</span></span>
                <button class="btn btn-sm btn-orange" id="advToggleAddExam" ${courseList.length === 0 ? 'disabled title="เพิ่มรายวิชาก่อน"' : ''}>
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
                        <tr><th>รหัสวิชา</th><th>ชื่อวิชา</th><th>วันสอบ</th><th class="hide-mobile">เวลา</th><th class="hide-mobile">ห้องสอบ</th><th>สถานะ</th><th style="width:50px"></th></tr>
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

    // Clear errors on input
    ['advExamDate', 'advExamTimeStart', 'advExamTimeEnd', 'advExamRoom'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => el.classList.remove('is-invalid'));
            el.addEventListener('change', () => el.classList.remove('is-invalid'));
        }
    });

    if (sections) bindSectionsCard(sections);

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

        const course = courseList.find(c => c.code === courseCode);
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

/* ============================================================
   ADVISOR — Class sections I teach (backed by /api/sections)
   Changing a section here changes the timetable of every enrolled student.
   ============================================================ */
function offlineCoursesCardHtml() {
    const rows = MOCK_ADVISOR_COURSES.map(c => `
        <tr><td><span class="badge badge-blue">${esc(c.code)}</span></td><td>${esc(c.name)}</td><td class="hide-mobile">${esc(c.nameTh)}</td></tr>`).join('');
    return `
        <div class="card">
            <div class="card-title">📚 รายวิชาที่สอน <span class="badge badge-blue" style="font-size:0.75rem">${MOCK_ADVISOR_COURSES.length} วิชา</span></div>
            <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px">เชื่อมต่อ backend ไม่ได้ จึงแสดงรายวิชาตัวอย่างและยังแก้ไขกลุ่มเรียนไม่ได้</p>
            <div class="table-wrap">
                <table class="data-table">
                    <thead><tr><th>รหัสวิชา</th><th>ชื่อวิชา (EN)</th><th class="hide-mobile">ชื่อวิชา (TH)</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>`;
}

function sectionsCardHtml(sections) {
    const rows = sections.map(s => `
        <tr data-section-id="${s.sectionId}">
            <td><span class="badge badge-blue">${esc(s.courseCode)}</span><div style="font-size:0.82rem">${esc(s.courseName)}</div></td>
            <td>${s.term}/${s.academicYear}</td>
            <td class="hide-mobile">${esc(s.sectionNo)}</td>
            <td>${esc(s.dayName)} ${esc(s.startTime)}–${esc(s.endTime)}</td>
            <td class="hide-mobile">${esc(s.room || '-')}</td>
            <td>${s.enrolledCount}${s.capacity ? ' / ' + s.capacity : ''}</td>
            <td>${sectionStatusBadge(s)}${s.reviewNote ? `<div style="font-size:0.75rem;color:var(--text-muted)">${esc(s.reviewNote)}</div>` : ''}</td>
            <td style="white-space:nowrap">
                <button class="btn btn-sm btn-ghost adv-sec-students" title="รายชื่อนักศึกษา">👥</button>
                <button class="btn btn-sm btn-ghost adv-sec-edit" title="แก้ไข">✏️</button>
                <button class="btn btn-sm btn-ghost adv-sec-delete" title="ลบ">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </button>
            </td>
        </tr>`).join('');

    const pending = sections.filter(s => s.approvalStatus === 'PENDING').length;
    const dayOptions = DAY_NAMES_TH.map((d, i) => `<option value="${i}">${d}</option>`).join('');
    const field = (label, input) => `
        <div class="app-form-group">
            <label class="app-form-label">${label}</label>
            ${input}
        </div>`;

    return `
        <div class="card">
            <div class="card-title" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
                <span>📚 รายวิชาที่สอน <span class="badge badge-blue" style="font-size:0.75rem">${sections.length} กลุ่มเรียน</span>${pending ? ` <span class="badge badge-amber" style="font-size:0.75rem">รออนุมัติ ${pending}</span>` : ''}</span>
                <button class="btn btn-sm btn-orange" id="advToggleAddSection">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    เปิดรายวิชา
                </button>
            </div>
            <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px">
                กลุ่มเรียนที่เพิ่มหรือแก้ไขจะถูกส่งไปให้ผู้ดูแลระบบอนุมัติก่อน นักศึกษาจึงจะลงทะเบียนได้ ·
                วัน เวลา หรือห้องที่แก้ จะเปลี่ยนในตารางเรียนของนักศึกษาที่ลงกลุ่มนี้ไว้แล้วทันที
            </p>

            <div id="advSectionForm" style="display:none" class="app-form-panel">
                <div class="app-form-header">
                    <div>
                        <div class="app-form-title" id="advSectionFormTitle">เพิ่มกลุ่มเรียน</div>
                        <div class="app-form-subtitle">ช่องที่มี * ต้องกรอก · เวลาสอนของ Sec ต่าง ๆ ต้องไม่ทับกัน และนักศึกษาลงได้ไม่เกินจำนวนที่นั่งที่กำหนด</div>
                    </div>
                    <button type="button" class="btn btn-sm btn-ghost" id="advCloseSectionFormBtn" style="padding:4px 10px;font-size:0.8rem">✕ ปิด</button>
                </div>
                <div class="app-form-grid app-form-grid-3col">
                    ${field('ปีการศึกษา <span class="req">*</span>', '<input type="number" id="advSecYear" class="app-input" placeholder="เช่น 2565">')}
                    ${field('ภาคเรียน <span class="req">*</span>', '<select id="advSecTerm" class="app-select"><option value="1">1</option><option value="2">2</option><option value="3">ฤดูร้อน</option></select>')}
                    ${field('รหัสวิชา <span class="req">*</span>', '<input type="text" id="advSecCode" class="app-input" placeholder="เช่น CS3101">')}
                    ${field('ชื่อวิชา <span class="req">*</span>', '<input type="text" id="advSecName" class="app-input" placeholder="เช่น ปัญญาประดิษฐ์">')}
                    ${field('หน่วยกิต <span class="req">*</span>', '<input type="number" id="advSecCredits" class="app-input" min="1" value="3">')}
                </div>
                <!-- One block per Sec: the teacher opens D1, D2 or both, each with its own time, room and seats -->
                ${['D1', 'D2'].map(g => `
                <div class="adv-sec-block" data-group="${g}" style="border:1px solid var(--g-100);border-radius:var(--radius-md);padding:12px;margin-top:12px">
                    <label class="adv-sec-toggle" style="font-weight:600;display:flex;gap:8px;align-items:center;cursor:pointer">
                        <input type="checkbox" class="adv-sec-enabled" checked> เปิด Sec ${g}
                    </label>
                    <div class="app-form-grid app-form-grid-3col adv-sec-fields" style="margin-top:8px">
                        ${field('วัน <span class="req">*</span>', `<select class="app-select adv-sec-day">${dayOptions}</select>`)}
                        ${field('เวลาเริ่ม <span class="req">*</span>', '<input type="time" class="app-input adv-sec-start">')}
                        ${field('เวลาสิ้นสุด <span class="req">*</span>', '<input type="time" class="app-input adv-sec-end">')}
                        ${field('ห้อง', '<input type="text" class="app-input adv-sec-room" placeholder="เช่น CS-Lab1">')}
                        ${field('จำนวนที่นั่ง <span class="req">*</span>', '<input type="number" class="app-input adv-sec-cap" min="1" step="1" placeholder="เช่น 40">')}
                    </div>
                </div>`).join('')}
                <div class="app-form-actions">
                    <button class="app-btn-primary" id="advSaveSectionBtn">ส่งให้ผู้ดูแลระบบอนุมัติ</button>
                    <button class="app-btn-ghost" id="advCancelSectionBtn">ยกเลิก</button>
                </div>
            </div>

            <div class="table-wrap">
                <table class="data-table" id="advSectionsTable">
                    <thead>
                        <tr><th>วิชา</th><th>ภาค</th><th class="hide-mobile">Sec</th><th>วัน-เวลา</th><th class="hide-mobile">ห้อง</th><th>นักศึกษา</th><th>สถานะ</th><th></th></tr>
                    </thead>
                    <tbody>${rows || '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted)">ยังไม่มีกลุ่มเรียนที่สอน</td></tr>'}</tbody>
                </table>
            </div>
            <div id="advSectionStudents"></div>
        </div>`;
}

function bindSectionsCard(sections) {
    const form = document.getElementById('advSectionForm');
    const $ = id => document.getElementById(id);
    let editingId = null;

    const blocks = [...form.querySelectorAll('.adv-sec-block')];
    const SEC_DEFAULTS = { D1: { day: 0, start: '09:00', end: '12:00' }, D2: { day: 0, start: '13:00', end: '16:00' } };
    const syncBlock = (block) => {
        const on = block.querySelector('.adv-sec-enabled').checked;
        block.querySelector('.adv-sec-fields').style.opacity = on ? '1' : '0.4';
        block.querySelectorAll('.adv-sec-fields input, .adv-sec-fields select').forEach(el => { el.disabled = !on; });
    };
    blocks.forEach(block => block.querySelector('.adv-sec-enabled').addEventListener('change', () => syncBlock(block)));

    const openForm = (section) => {
        editingId = section ? section.sectionId : null;
        const latest = sections[0];
        $('advSectionFormTitle').textContent = section
            ? `แก้ไข ${section.courseCode} Sec ${section.sectionNo} (${section.term}/${section.academicYear})`
            : 'เปิดรายวิชา (เลือกได้ว่าจะเปิด Sec D1, D2 หรือทั้งสอง)';
        $('advSecYear').value = section ? section.academicYear : (latest ? latest.academicYear : '');
        $('advSecTerm').value = section ? section.term : (latest ? latest.term : 1);
        $('advSecCode').value = section ? section.courseCode : '';
        $('advSecName').value = section ? section.courseName : '';
        $('advSecCredits').value = section ? section.credits : 3;
        blocks.forEach(block => {
            const group = block.dataset.group;
            const editingThis = section && section.sectionNo === group;
            const d = SEC_DEFAULTS[group];
            // When editing, only the edited Sec is shown and it cannot be switched off
            block.style.display = !section || editingThis ? 'block' : 'none';
            block.querySelector('.adv-sec-toggle input').checked = !section || editingThis;
            block.querySelector('.adv-sec-toggle').style.display = section ? 'none' : 'flex';
            block.querySelector('.adv-sec-day').value = editingThis ? section.dayOfWeek : d.day;
            block.querySelector('.adv-sec-start').value = editingThis ? section.startTime : d.start;
            block.querySelector('.adv-sec-end').value = editingThis ? section.endTime : d.end;
            block.querySelector('.adv-sec-room').value = editingThis ? (section.room || '') : '';
            block.querySelector('.adv-sec-cap').value = editingThis && section.capacity ? section.capacity : '';
            syncBlock(block);
        });
        form.style.display = 'block';
        form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    const closeForm = () => { form.style.display = 'none'; editingId = null; };

    $('advToggleAddSection').addEventListener('click', () => {
        if (form.style.display === 'none' || editingId !== null) openForm(null); else closeForm();
    });
    $('advCloseSectionFormBtn').addEventListener('click', closeForm);
    $('advCancelSectionBtn').addEventListener('click', closeForm);

    $('advSaveSectionBtn').addEventListener('click', async () => {
        const course = {
            academicYear: Number($('advSecYear').value) || null,
            term: Number($('advSecTerm').value),
            courseCode: $('advSecCode').value.trim(),
            courseName: $('advSecName').value.trim(),
            credits: Number($('advSecCredits').value) || null,
        };
        if (!course.academicYear || !course.courseCode || !course.courseName || !course.credits) {
            showAdvisorToast('error', 'กรุณากรอกข้อมูลรายวิชาที่มี * ให้ครบ');
            return;
        }
        const secs = blocks
            .filter(b => b.style.display !== 'none' && b.querySelector('.adv-sec-enabled').checked)
            .map(b => ({
                ...course,
                sectionNo: b.dataset.group,
                dayOfWeek: Number(b.querySelector('.adv-sec-day').value),
                startTime: b.querySelector('.adv-sec-start').value,
                endTime: b.querySelector('.adv-sec-end').value,
                room: b.querySelector('.adv-sec-room').value.trim(),
                capacity: Number(b.querySelector('.adv-sec-cap').value),
            }));
        if (secs.length === 0) {
            showAdvisorToast('error', 'กรุณาเลือกเปิดอย่างน้อย 1 Sec');
            return;
        }
        for (const s of secs) {
            if (!s.startTime || !s.endTime || s.startTime >= s.endTime) {
                showAdvisorToast('error', `Sec ${s.sectionNo}: เวลาสิ้นสุดต้องหลังเวลาเริ่ม`);
                return;
            }
            if (!Number.isInteger(s.capacity) || s.capacity < 1) {
                showAdvisorToast('error', `Sec ${s.sectionNo}: กรุณากรอกจำนวนที่นั่งเป็นตัวเลขมากกว่า 0`);
                return;
            }
        }
        if (secs.length === 2 && secs[0].dayOfWeek === secs[1].dayOfWeek
            && secs[0].startTime < secs[1].endTime && secs[1].startTime < secs[0].endTime) {
            showAdvisorToast('error', 'เวลาของ Sec D1 และ D2 ทับกัน กรุณาเลือกเวลาไม่ให้ทับกัน');
            return;
        }
        try {
            if (editingId !== null) {
                await fetchAPI(`/sections/${editingId}`, 'PUT', secs[0], 8000);
                showAdvisorToast('success', esc(`แก้ไข ${course.courseCode} Sec ${secs[0].sectionNo} แล้ว ส่งให้ผู้ดูแลระบบอนุมัติอีกครั้ง`));
            } else {
                await fetchAPI('/sections/batch', 'POST', secs, 8000);
                showAdvisorToast('success', esc(`ส่งคำขอเปิด ${course.courseCode} Sec ${secs.map(s => s.sectionNo).join(', ')} แล้ว รอผู้ดูแลระบบอนุมัติ`));
            }
            renderAdvisorCourses();
        } catch (err) {
            showAdvisorToast('error', esc(apiErrorText(err)));
        }
    });

    document.querySelectorAll('#advSectionsTable tr[data-section-id]').forEach(row => {
        const section = sections.find(s => String(s.sectionId) === row.dataset.sectionId);
        if (!section) return;

        row.querySelector('.adv-sec-edit').addEventListener('click', () => openForm(section));

        row.querySelector('.adv-sec-delete').addEventListener('click', async () => {
            const warning = section.enrolledCount > 0
                ? `\nนักศึกษา ${section.enrolledCount} คนที่ลงกลุ่มนี้จะถูกถอนออกจากตารางเรียนด้วย` : '';
            if (!confirm(`ลบ ${section.courseCode} กลุ่ม ${section.sectionNo} (${section.term}/${section.academicYear})?${warning}`)) return;
            try {
                await fetchAPI(`/sections/${section.sectionId}`, 'DELETE', null, 8000);
                showAdvisorToast('info', esc(`ลบ ${section.courseCode} กลุ่ม ${section.sectionNo} แล้ว`));
                renderAdvisorCourses();
            } catch (err) {
                showAdvisorToast('error', esc(apiErrorText(err)));
            }
        });

        row.querySelector('.adv-sec-students').addEventListener('click', async () => {
            const panel = $('advSectionStudents');
            try {
                const students = await fetchAPI(`/sections/${section.sectionId}/students`);
                const items = students.map(st => `<li>${esc(st.studentId)} — ${esc(st.nameTh)}${st.status === 'PENDING' ? ' <span class="badge badge-amber">รอแอดมินยืนยัน</span>' : ''}</li>`).join('');
                panel.innerHTML = `
                    <div class="app-form-panel" style="margin-top:12px">
                        <div style="font-weight:600;margin-bottom:6px">👥 ${esc(section.courseCode)} กลุ่ม ${esc(section.sectionNo)} — ${students.length} คน</div>
                        ${items ? `<ul style="margin:0;padding-left:20px">${items}</ul>` : '<div style="color:var(--text-muted)">ยังไม่มีนักศึกษาลงทะเบียน</div>'}
                    </div>`;
            } catch (err) {
                showAdvisorToast('error', esc(apiErrorText(err)));
            }
        });
    });
}
