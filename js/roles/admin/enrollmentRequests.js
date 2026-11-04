import { esc, showToast } from '../../utils.js';
import { fetchAPI } from '../../api.js';
import { apiErrorText, fetchCached, fetchFresh } from './shared.js';
import { renderAdminSectionsCard } from './sections.js';

/* ============================================================
   REGISTRATION REQUESTS — students send their course cart,
   the admin confirms or rejects each request.
   ============================================================ */
const REQUEST_TIME = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
const expandedRequestStudents = new Set();   // students whose course list is open, kept across refreshes

export async function renderEnrollmentRequestsCard({ cached = false } = {}) {
    const container = document.getElementById('adminEnrollmentRequestsCard');
    if (!container) return;

    let requests;
    try {
        requests = await (cached ? fetchCached : fetchFresh)('/enrollments/pending');
    } catch (err) {
        container.innerHTML = '';
        return;
    }
    // The dashboard may have re-rendered while waiting for the API
    if (!container.isConnected) return;

    // One row per student; the arrow opens the courses they asked for
    const groups = new Map();
    requests.forEach(r => {
        if (!groups.has(r.studentId)) groups.set(r.studentId, []);
        groups.get(r.studentId).push(r);
    });
    const rows = [...groups.entries()].map(([studentId, items]) => {
        const first = items[0];
        const open = expandedRequestStudents.has(studentId);
        const credits = items.reduce((sum, r) => sum + (r.section.credits || 0), 0);
        const terms = [...new Set(items.map(r => `${r.section.term}/${r.section.academicYear}`))].join(', ');
        const latest = Math.max(...items.map(r => new Date(r.requestedAt).getTime()));
        const courseRows = items.map(r => `
            <tr class="req-course-row" data-student="${esc(studentId)}" data-id="${r.enrollmentId}" ${open ? '' : 'hidden'} style="background:var(--bg-subtle, rgba(0,0,0,0.03))">
                <td><input type="checkbox" class="req-check" value="${r.enrollmentId}" data-student="${esc(studentId)}"></td>
                <td colspan="2" style="padding-left:32px"><span class="badge badge-blue">${esc(r.section.courseCode)}</span> <span style="font-size:0.82rem">${esc(r.section.courseName)} (${r.section.credits} หน่วยกิต)</span></td>
                <td>${r.section.term}/${r.section.academicYear} · ${esc(r.section.sectionNo)}</td>
                <td class="hide-mobile">${esc(r.section.dayName)} ${esc(r.section.startTime)}–${esc(r.section.endTime)}</td>
                <td class="hide-mobile">ที่นั่ง ${r.section.enrolledCount}${r.section.capacity ? ' / ' + r.section.capacity : ''}</td>
                <td class="hide-mobile" style="font-size:0.8rem">${esc(REQUEST_TIME.format(new Date(r.requestedAt)))}</td>
                <td style="white-space:nowrap">
                    <button class="btn btn-sm btn-orange req-confirm">ยืนยัน</button>
                    <button class="btn btn-sm btn-ghost req-reject">ไม่อนุมัติ</button>
                </td>
            </tr>`).join('');
        return `
            <tr class="req-student-row" data-student="${esc(studentId)}">
                <td><input type="checkbox" class="req-student-check" data-student="${esc(studentId)}" title="เลือกทุกวิชาของนักศึกษาคนนี้"></td>
                <td>
                    <button type="button" class="btn btn-sm btn-ghost req-toggle" aria-expanded="${open}" title="ดูรายวิชา" style="padding:2px 8px;margin-right:6px">${open ? '▼' : '▶'}</button>
                    <strong>${esc(studentId)}</strong><div style="font-size:0.82rem;margin-left:38px">${esc(first.studentName)}</div>
                </td>
                <td><span class="badge badge-purple">${esc(first.studentSection)}</span></td>
                <td><strong>${items.length}</strong> วิชา · ${credits} หน่วยกิต<div style="font-size:0.8rem;color:var(--text-muted)">ภาค ${esc(terms)}</div></td>
                <td class="hide-mobile" colspan="2" style="font-size:0.82rem">${items.map(r => esc(r.section.courseCode)).join(', ')}</td>
                <td class="hide-mobile" style="font-size:0.8rem">${esc(REQUEST_TIME.format(new Date(latest)))}</td>
                <td style="white-space:nowrap">
                    <button class="btn btn-sm btn-orange req-confirm-student">ยืนยันทั้งหมด</button>
                    <button class="btn btn-sm btn-ghost req-reject-student">ไม่อนุมัติทั้งหมด</button>
                </td>
            </tr>${courseRows}`;
    }).join('');

    container.innerHTML = `
        <div class="card">
            <div class="card-title">📝 คำขอลงทะเบียนของนักศึกษา
                ${requests.length ? `<span class="badge badge-amber" style="font-size:0.75rem">รอยืนยัน ${groups.size} คน · ${requests.length} วิชา</span>` : ''}
            </div>
            <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px">
                นักศึกษาเลือกวิชาแล้วกดยืนยันลงทะเบียน คำขอจะมารอที่นี่ แยกตามนักศึกษา (กด ▶ เพื่อดูรายวิชา) · คำขอที่รออยู่จองที่นั่งไว้แล้ว · ไม่อนุมัติแล้วที่นั่งจะว่าง และนักศึกษาจะเห็นเหตุผล
            </p>
            ${requests.length ? `
            <div class="batch-filter-bar" style="flex-wrap:wrap;gap:8px;margin-bottom:12px">
                <button class="btn btn-sm btn-orange" id="reqConfirmSelected">ยืนยันที่เลือก</button>
                <button class="btn btn-sm btn-ghost" id="reqRejectSelected">ไม่อนุมัติที่เลือก</button>
            </div>` : ''}
            <div class="table-wrap">
                <table class="data-table">
                    <thead><tr><th><input type="checkbox" id="reqCheckAll" title="เลือกทั้งหมด"></th><th>นักศึกษา</th><th>Sec แรกเข้า</th><th>วิชาที่ขอ</th><th class="hide-mobile" colspan="2">รายวิชา / วัน-เวลา · ที่นั่ง</th><th class="hide-mobile">ส่งเมื่อ</th><th></th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="8" style="text-align:center;color:var(--text-muted)">ไม่มีคำขอที่รอยืนยัน</td></tr>'}</tbody>
                </table>
            </div>
        </div>`;

    const review = async (ids, status) => {
        if (ids.length === 0) {
            showToast('error', 'กรุณาเลือกคำขออย่างน้อย 1 รายการ');
            return;
        }
        let note = null;
        if (status === 'REJECTED') {
            note = prompt(`เหตุผลที่ไม่อนุมัติ ${ids.length} รายการ (นักศึกษาจะเห็นข้อความนี้)`);
            if (note === null) return;
            if (!note.trim()) {
                showToast('error', 'กรุณาระบุเหตุผลที่ไม่อนุมัติ');
                return;
            }
        }
        try {
            const result = await fetchAPI('/enrollments/review', 'PATCH', { enrollmentIds: ids, status, note }, 8000);
            showToast('success', status === 'CONFIRMED'
                ? `ยืนยันการลงทะเบียน ${result.updated} รายการแล้ว`
                : `ไม่อนุมัติ ${result.updated} รายการแล้ว`);
            renderEnrollmentRequestsCard();
            renderAdminSectionsCard();
        } catch (err) {
            showToast('error', esc(apiErrorText(err)));
        }
    };

    const selectedIds = () => [...container.querySelectorAll('.req-check:checked')].map(c => Number(c.value));
    const studentIds = (studentId) => requests.filter(r => r.studentId === studentId).map(r => r.enrollmentId);
    const courseChecks = (studentId) => [...container.querySelectorAll('.req-check')].filter(c => c.dataset.student === studentId);
    container.querySelector('#reqCheckAll')?.addEventListener('change', e => {
        container.querySelectorAll('.req-check, .req-student-check').forEach(c => { c.checked = e.target.checked; c.indeterminate = false; });
    });
    container.querySelector('#reqConfirmSelected')?.addEventListener('click', () => review(selectedIds(), 'CONFIRMED'));
    container.querySelector('#reqRejectSelected')?.addEventListener('click', () => review(selectedIds(), 'REJECTED'));
    container.querySelectorAll('tr.req-student-row').forEach(row => {
        const studentId = row.dataset.student;
        const studentCheck = row.querySelector('.req-student-check');
        row.querySelector('.req-toggle').addEventListener('click', (e) => {
            const open = !expandedRequestStudents.has(studentId);
            if (open) expandedRequestStudents.add(studentId); else expandedRequestStudents.delete(studentId);
            e.currentTarget.textContent = open ? '▼' : '▶';
            e.currentTarget.setAttribute('aria-expanded', String(open));
            container.querySelectorAll('tr.req-course-row').forEach(r => {
                if (r.dataset.student === studentId) r.hidden = !open;
            });
        });
        studentCheck.addEventListener('change', () => {
            courseChecks(studentId).forEach(c => { c.checked = studentCheck.checked; });
        });
        row.querySelector('.req-confirm-student').addEventListener('click', () => review(studentIds(studentId), 'CONFIRMED'));
        row.querySelector('.req-reject-student').addEventListener('click', () => review(studentIds(studentId), 'REJECTED'));
    });
    // Ticking single courses updates the student's box (all / some / none)
    container.querySelectorAll('.req-check').forEach(c => c.addEventListener('change', () => {
        const checks = courseChecks(c.dataset.student);
        const ticked = checks.filter(x => x.checked).length;
        const studentCheck = [...container.querySelectorAll('.req-student-check')].find(x => x.dataset.student === c.dataset.student);
        if (studentCheck) {
            studentCheck.checked = ticked === checks.length;
            studentCheck.indeterminate = ticked > 0 && ticked < checks.length;
        }
    }));
    container.querySelectorAll('tr.req-course-row').forEach(row => {
        const id = Number(row.dataset.id);
        row.querySelector('.req-confirm').addEventListener('click', () => review([id], 'CONFIRMED'));
        row.querySelector('.req-reject').addEventListener('click', () => review([id], 'REJECTED'));
    });
}
