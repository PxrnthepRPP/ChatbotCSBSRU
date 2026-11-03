/* ============================================================
   BSRU Student Portal — Advisor: advisee risk data & badges
   ============================================================ */

import { esc } from '../../utils.js';
import { MOCK_STUDENTS_POOL } from '../admin.js';

/* ============================================================
   LIVE ADVISEES — real students of the logged-in advisor (GET /advisors/me/advisees)
   with the rule-based risk check; falls back to the mock list when offline.
   ============================================================ */
export let liveAdvisees = null;   // AdviseeRisk[] from the backend, null = offline / not loaded

/** Set by loadLiveAdvisees() (advisees.js) once the backend answered */
export function setLiveAdvisees(value) {
    liveAdvisees = value;
}

export const RISK_LEVEL = {
    HIGH: { badge: 'badge-red', text: 'เสี่ยงสูง' },
    MEDIUM: { badge: 'badge-amber', text: 'เฝ้าระวัง' },
    LOW: { badge: 'badge-green', text: 'ปกติ' },
};

/** The advisor's students in the shape the dashboard uses */
export function currentAdvisees() {
    if (liveAdvisees) {
        return liveAdvisees.map(r => ({
            studentId: r.studentId, nameTh: r.nameTh, nameEn: r.nameEn || '', year: r.year,
            gpa: r.gpa ?? 0, status: r.status, risk: r,
        }));
    }
    return MOCK_STUDENTS_POOL.filter(s => s.advisor === 'ADV001');
}

export function riskBadge(r) {
    const lv = RISK_LEVEL[r.level] || RISK_LEVEL.LOW;
    return `<span class="badge ${lv.badge}">${lv.text}</span>`;
}

export function riskChips(r) {
    return [r.riskRetire && 'เสี่ยงรีไทร์', r.riskFail && 'เสี่ยงตก', r.riskDrop && 'เสี่ยงต้องถอนรายวิชา']
        .filter(Boolean)
        .map(t => `<span class="badge badge-red" style="font-size:0.7rem">${t}</span>`).join(' ');
}


export const askAbout = r => `ช่วยวิเคราะห์ความเสี่ยงของนักศึกษา ${r.studentId} ${r.nameTh} ว่ามีความเสี่ยงอะไรบ้าง (พ้นสภาพ/รีไทร์ ตก ถอนรายวิชา หรือจบช้า) พร้อมเหตุผลจากผลการเรียนและแนวทางช่วยเหลือ`;

/** Dashboard card: who needs attention, from the same risk check the chatbot uses */
export function riskCardHtml() {
    if (!liveAdvisees) return '';
    // Dismissed students are no longer at risk (the stat card counts them); students on leave need a
    // different follow-up than an academic risk, so they get their own group
    const flagged = liveAdvisees.filter(r => r.level !== 'LOW' && r.status !== 'พ้นสภาพ' && r.status !== 'พักการศึกษา');
    const onLeave = liveAdvisees.filter(r => r.status === 'พักการศึกษา');
    const rowHtml = r => `
        <div class="advisee-card">
            <div class="advisee-info">
                <div class="advisee-name">${esc(r.studentId)} ${esc(r.nameTh)} ${r.simulated ? '<span class="badge badge-amber" style="font-size:0.7rem">จำลอง</span> ' : ''}${riskBadge(r)} ${riskChips(r)}</div>
                <div class="advisee-detail">ปี ${r.year} · GPA ${r.gpa != null ? Number(r.gpa).toFixed(2) : '-'} · ${esc(r.factors[0]?.message || '')}</div>
            </div>
            <div class="advisee-actions">
                <button class="btn btn-sm btn-orange adv-ai-one-btn" data-sid="${esc(r.studentId)}">🤖 ให้ AI วิเคราะห์ความเสี่ยง</button>
                <button class="btn btn-sm btn-ghost adv-history-btn" data-sid="${esc(r.studentId)}">ดูประวัติ</button>
            </div>
        </div>`;
    const rows = flagged.map(rowHtml).join('');
    const leaveRows = onLeave.length ? `
            <div style="margin-top:16px;font-weight:600;font-size:0.88rem">⏸️ พักการศึกษา <span class="badge badge-amber" style="font-size:0.72rem">${onLeave.length} คน</span></div>
            <p style="font-size:0.8rem;color:var(--text-muted);margin:4px 0 8px">ติดตามกำหนดกลับมาเรียนและการรักษาสภาพ</p>
            ${onLeave.map(rowHtml).join('')}` : '';
    return `
        <div class="card">
            <div class="card-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                <span>⚠️ นักศึกษาที่ต้องติดตาม <span class="badge ${flagged.length ? 'badge-red' : 'badge-green'}" style="font-size:0.75rem">${flagged.length} คน</span></span>

            </div>
            <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:10px">ประเมินเบื้องต้นจากข้อมูลจริงในระบบ (GPA, เกรด F/D, แนวโน้มรายเทอม, หน่วยกิตที่ลง, เวลาเรียนชน) · <a href="#" class="adv-criteria-link">ดูเกณฑ์ที่ใช้</a></p>
            ${rows || '<div style="color:var(--text-muted)">ไม่มีนักศึกษาที่เข้าเกณฑ์เสี่ยง</div>'}
            ${leaveRows}
        </div>`;
}
