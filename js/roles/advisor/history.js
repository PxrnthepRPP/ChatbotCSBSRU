/* ============================================================
   BSRU Student Portal — Advisor: advisee history modal ("ดูประวัติ"),
   advising notes, and the shared advisee button binder
   ============================================================ */

import { esc, statusBadge, fetchAPI } from '../../utils.js';
import { apiErrorText } from '../admin.js';
import { impersonateStudent } from '../../auth.js';
import { askChatbot } from '../../components/chatbot.js';
import { liveAdvisees, RISK_LEVEL, currentAdvisees, riskBadge, riskChips, askAbout } from './risk.js';
import { showAdvisorModal, showAdvisorToast } from './ui.js';

export function bindAdviseeButtons(container) {
    container.querySelectorAll('.adv-history-btn').forEach(b => b.addEventListener('click', () => openAdviseeHistory(b.dataset.sid)));

    container.querySelectorAll('.adv-ai-one-btn').forEach(b => b.addEventListener('click', () => {
        const r = liveAdvisees?.find(x => x.studentId === b.dataset.sid) || currentAdvisees().find(x => x.studentId === b.dataset.sid);
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

    let notes = [];
    try {
        const notesRes = await fetchAPI(`/advisors/me/advisees/${encodeURIComponent(studentId)}/notes`, 'GET', null, 8000);
        if (Array.isArray(notesRes)) notes = notesRes;
    } catch (e) {
        notes = [];
    }

    const renderNotesHtml = (items) => {
        if (!items || items.length === 0) {
            return '<div style="color:var(--text-muted);font-size:0.85rem">ยังไม่มีบันทึกการให้คำปรึกษา</div>';
        }
        return items.map(n => {
            const dateStr = n.createdAt ? new Date(n.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
            const rBadge = n.riskLevelSnapshot ? `<span class="badge badge-amber" style="font-size:0.7rem">${esc(n.riskLevelSnapshot)}</span>` : '';
            const followUp = n.followUpDate ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px">📅 นัดติดตามผล: ${esc(n.followUpDate)}</div>` : '';
            return `
                <div class="adv-note-item" style="border:1px solid var(--border);border-radius:6px;padding:8px 12px;margin-bottom:8px;background:var(--card-bg)">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                        <div style="font-size:0.8rem;color:var(--text-muted);font-weight:600">${dateStr} ${rBadge}</div>
                        <button class="btn btn-ghost btn-sm adv-delete-note-btn" data-nid="${n.id}" data-sid="${esc(studentId)}" style="color:var(--red-500);padding:2px 6px;font-size:0.75rem" title="ลบบันทึก">ลบ</button>
                    </div>
                    <div style="font-size:0.88rem;line-height:1.5">${esc(n.summary)}</div>
                    ${followUp}
                </div>
            `;
        }).join('');
    };

    const notesSection = `
        <div id="advNotesList" style="margin-bottom:12px">
            ${renderNotesHtml(notes)}
        </div>
        <div style="background:var(--bg-muted, #f8f9fa);border-radius:6px;padding:12px;border:1px dashed var(--border)">
            <div style="font-weight:600;font-size:0.85rem;margin-bottom:6px">➕ เพิ่มบันทึกการให้คำปรึกษาใหม่</div>
            <textarea id="advNoteSummary" rows="2" placeholder="ระบุรายละเอียดการให้คำปรึกษา ปัญหา หรือคำแนะนำ..." style="width:100%;box-sizing:border-box;margin-bottom:8px;font-size:0.85rem;padding:6px 8px;border-radius:4px;border:1px solid var(--border)"></textarea>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                <div style="flex:1;min-width:140px">
                    <label style="font-size:0.75rem;color:var(--text-muted);display:block;margin-bottom:2px">วันนัดติดตามผล (ถ้ามี):</label>
                    <input type="date" id="advNoteFollowUp" style="width:100%;box-sizing:border-box;font-size:0.82rem;padding:4px 6px;border-radius:4px;border:1px solid var(--border)">
                </div>
                <div style="flex:1;min-width:140px">
                    <label style="font-size:0.75rem;color:var(--text-muted);display:block;margin-bottom:2px">สถานะความเสี่ยง:</label>
                    <select id="advNoteRisk" style="width:100%;box-sizing:border-box;font-size:0.82rem;padding:4px 6px;border-radius:4px;border:1px solid var(--border)">
                        <option value="NORMAL" ${r.level === 'NORMAL' ? 'selected' : ''}>ปกติ (NORMAL)</option>
                        <option value="ACADEMIC_WARNING" ${r.level === 'ACADEMIC_WARNING' ? 'selected' : ''}>เฝ้าระวัง (WARNING)</option>
                        <option value="AT_RISK" ${r.level === 'AT_RISK' ? 'selected' : ''}>มีความเสี่ยง (AT_RISK)</option>
                        <option value="CRITICAL" ${r.level === 'CRITICAL' ? 'selected' : ''}>วิกฤต (CRITICAL)</option>
                    </select>
                </div>
                <div style="align-self:flex-end">
                    <button class="btn btn-sm btn-primary" id="advNoteSaveBtn" style="padding:6px 14px">บันทึก</button>
                </div>
            </div>
        </div>
    `;

    const overlay = showAdvisorModal(`ประวัติ ${r.studentId} ${r.nameTh}`, `
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:flex-start">
            <div>
                <div style="font-size:0.9rem">${esc(p.nameEn || '')} · ชั้นปี ${p.year} · Sec ${esc(p.studentSection || '-')} · <span class="badge ${statusBadge(p.status)}">${esc(p.status)}</span></div>
                <div style="font-size:1.4rem;font-weight:800;margin-top:4px">GPA ${r.gpa != null ? Number(r.gpa).toFixed(2) : '-'} <span style="font-size:0.8rem;font-weight:400;color:var(--text-muted)">(${esc(r.gpaSource)})</span></div>
                <div style="margin-top:4px">${riskBadge(r)} ${riskChips(r)}</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="btn btn-sm btn-orange adv-ai-one-btn" data-sid="${esc(r.studentId)}">🤖 ให้ AI วิเคราะห์ความเสี่ยง</button>
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
        ${section('📋 บันทึกการให้คำปรึกษา (Advising Notes)', notesSection)}
    `);
    bindAdviseeButtons(overlay);
    overlay.querySelector('.adv-history-imp-btn').addEventListener('click', () => {
        overlay.classList.remove('open');
        impersonateStudent(r.studentId, r.nameTh);
    });

    const refreshNotesUi = async () => {
        try {
            const updated = await fetchAPI(`/advisors/me/advisees/${encodeURIComponent(studentId)}/notes`, 'GET', null, 8000);
            const container = overlay.querySelector('#advNotesList');
            if (container) {
                container.innerHTML = renderNotesHtml(Array.isArray(updated) ? updated : []);
                bindNoteDeleteEvents();
            }
        } catch (e) { /* ignored */ }
    };

    const bindNoteDeleteEvents = () => {
        overlay.querySelectorAll('.adv-delete-note-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const nid = btn.dataset.nid;
                const sid = btn.dataset.sid;
                if (!confirm('ยืนยันลบบันทึกการให้คำปรึกษานี้หรือไม่?')) return;
                try {
                    await fetchAPI(`/advisors/me/advisees/${encodeURIComponent(sid)}/notes/${encodeURIComponent(nid)}`, 'DELETE', null, 8000);
                    showAdvisorToast('success', 'ลบบันทึกการให้คำปรึกษาสำเร็จ');
                    await refreshNotesUi();
                } catch (err) {
                    showAdvisorToast('error', 'ลบบันทึกไม่สำเร็จ: ' + esc(apiErrorText(err)));
                }
            });
        });
    };

    bindNoteDeleteEvents();

    overlay.querySelector('#advNoteSaveBtn')?.addEventListener('click', async () => {
        const summaryEl = overlay.querySelector('#advNoteSummary');
        const summary = summaryEl ? summaryEl.value.trim() : '';
        if (!summary) {
            showAdvisorToast('error', 'กรุณาระบุรายละเอียดบันทึกการให้คำปรึกษา');
            return;
        }
        const followUpEl = overlay.querySelector('#advNoteFollowUp');
        const followUpDate = followUpEl && followUpEl.value ? followUpEl.value : null;
        const riskEl = overlay.querySelector('#advNoteRisk');
        const riskLevelSnapshot = riskEl ? riskEl.value : null;

        try {
            await fetchAPI(`/advisors/me/advisees/${encodeURIComponent(studentId)}/notes`, 'POST', {
                summary,
                followUpDate,
                riskLevelSnapshot
            }, 8000);
            showAdvisorToast('success', 'บันทึกการให้คำปรึกษาสำเร็จ');
            if (summaryEl) summaryEl.value = '';
            if (followUpEl) followUpEl.value = '';
            await refreshNotesUi();
        } catch (err) {
            showAdvisorToast('error', 'บันทึกไม่สำเร็จ: ' + esc(apiErrorText(err)));
        }
    });
}
