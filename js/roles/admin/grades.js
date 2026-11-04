/* ============================================================
   BSRU Student Portal — Admin: grade deadlines and release (per course)
   ============================================================ */

import { confirmDialog } from '../../components/confirmDialog.js';
import { esc, showToast } from '../../utils.js';
import { fetchAPI } from '../../api.js';
import { openGradeEditor } from '../../components/gradeEditor.js';
import { apiErrorText } from './shared.js';

/* ============================================================
   GRADES: deadline for teachers, release to students (per course, every Sec together)
   ============================================================ */
let adminGradesTerm = null;   // "year/term" shown in the grades card
const GRADE_TIME = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' });

export async function renderAdminGradesCard() {
    const container = document.getElementById('adminGradesCard');
    if (!container) return;
    let courses;
    try {
        courses = await fetchAPI('/grade-schedules', 'GET', null, 8000);
    } catch (err) {
        container.innerHTML = '';
        return;
    }
    if (!container.isConnected) return;

    const terms = [...new Set(courses.map(c => `${c.academicYear}/${c.term}`))];
    if (!adminGradesTerm || !terms.includes(adminGradesTerm)) adminGradesTerm = terms[0] || null;
    const shown = courses.filter(c => `${c.academicYear}/${c.term}` === adminGradesTerm);
    const local = iso => iso ? String(iso).slice(0, 16) : '';
    const when = iso => iso ? GRADE_TIME.format(new Date(iso)) : '';
    const now = Date.now();

    const rows = shown.map((c, i) => {
        const late = c.submitDeadline && new Date(c.submitDeadline).getTime() < now;
        const secs = c.sections.map(s => `
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:2px 0;font-size:0.82rem">
                <strong>${esc(s.sectionNo)}</strong> ${esc(s.instructorName || '-')} · ใส่ ${s.graded}/${s.students}
                ${s.submitted ? `<span class="badge badge-green" title="${esc(when(s.submittedAt))}">ส่งแล้ว</span>`
                    : `<span class="badge ${late ? 'badge-red' : 'badge-amber'}">${late ? 'ไม่ส่งตามกำหนด' : 'ยังไม่ส่ง'}</span>`}
                <button class="btn btn-sm btn-ghost grades-edit" data-section-id="${s.sectionId}" style="padding:2px 8px">แก้เกรด</button>
            </div>`).join('');
        const releaseState = c.released
            ? `<span class="badge badge-green">ประกาศแล้ว ${esc(when(c.releaseAt))}</span>`
            : c.releaseAt ? `<span class="badge badge-blue">ตั้งไว้ ${esc(when(c.releaseAt))}</span>` : '<span class="badge badge-amber">ยังไม่ประกาศ</span>';
        return `
            <tr data-idx="${i}">
                <td><span class="badge badge-blue">${esc(c.courseCode)}</span><div style="font-size:0.82rem">${esc(c.courseName)}</div></td>
                <td>${secs}</td>
                <td><input type="datetime-local" class="batch-select grades-deadline" value="${local(c.submitDeadline)}"></td>
                <td>${releaseState}<div style="margin-top:4px"><input type="datetime-local" class="batch-select grades-release" value="${c.released ? '' : local(c.releaseAt)}" ${c.released ? 'disabled' : ''}></div></td>
                <td style="white-space:nowrap">
                    <button class="btn btn-sm btn-orange grades-save">บันทึก</button>
                    ${c.released
                        ? '<button class="btn btn-sm btn-ghost grades-unrelease">ยกเลิกประกาศ</button>'
                        : '<button class="btn btn-sm btn-ghost grades-release-now">ประกาศผลทันที</button>'}
                </td>
            </tr>`;
    }).join('');

    container.innerHTML = `
        <div class="card">
            <div class="card-title">📝 เกรดรายวิชา: วันส่งเกรด และประกาศผล</div>
            <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px">
                อาจารย์ใส่และส่งเกรดได้จนถึงวันส่งของแต่ละวิชา หลังจากนั้นเฉพาะผู้ดูแลระบบแก้ได้ ·
                ประกาศผลทีละวิชา (ทุก Sec พร้อมกัน) กดประกาศทันทีหรือตั้งวันเวลาล่วงหน้า · นักศึกษาเห็นเกรดและนำไปคิด GPA เมื่อประกาศแล้วเท่านั้น
            </p>
            <div class="batch-filter-bar" style="margin-bottom:12px">
                <label>ภาคเรียน</label>
                <select class="batch-select" id="gradesTermSelect">${terms.map(t => {
                    const [y, tm] = t.split('/');
                    return `<option value="${t}" ${t === adminGradesTerm ? 'selected' : ''}>${tm}/${y}</option>`;
                }).join('')}</select>
            </div>
            <div class="table-wrap">
                <table class="data-table">
                    <thead><tr><th>วิชา</th><th>Sec · อาจารย์ · สถานะส่ง</th><th>วันส่งเกรด</th><th>ประกาศผล</th><th></th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">ยังไม่มีรายวิชา</td></tr>'}</tbody>
                </table>
            </div>
            <div id="adminGradeEditor"></div>
        </div>`;

    container.querySelector('#gradesTermSelect')?.addEventListener('change', e => {
        adminGradesTerm = e.target.value;
        renderAdminGradesCard();
    });

    const saveSchedule = async (c, submitDeadline, releaseAt, message) => {
        try {
            await fetchAPI('/grade-schedules', 'PUT', {
                academicYear: c.academicYear, term: c.term, courseCode: c.courseCode, submitDeadline, releaseAt,
            }, 10000);
            showToast('success', esc(message));
            renderAdminGradesCard();
        } catch (err) {
            showToast('error', esc(apiErrorText(err)));
        }
    };
    container.querySelectorAll('tr[data-idx]').forEach(row => {
        const c = shown[Number(row.dataset.idx)];
        const deadline = () => row.querySelector('.grades-deadline').value || null;
        row.querySelector('.grades-save').addEventListener('click', () => {
            const release = c.released ? c.releaseAt : (row.querySelector('.grades-release').value || null);
            saveSchedule(c, deadline(), release, `บันทึกกำหนดการเกรด ${c.courseCode} แล้ว`);
        });
        row.querySelector('.grades-release-now')?.addEventListener('click', async () => {
            const notSent = c.sections.filter(s => !s.submitted).map(s => s.sectionNo);
            const warn = notSent.length ? `\n⚠️ Sec ${notSent.join(', ')} ยังไม่ส่งเกรด` : '';
            if (!await confirmDialog(`ประกาศผล ${c.courseCode} ทุก Sec ตอนนี้? นักศึกษาจะเห็นเกรดและนำไปคิด GPA ทันที${warn}`)) return;
            saveSchedule(c, deadline(), 'now', `ประกาศผล ${c.courseCode} แล้ว`);
        });
        row.querySelector('.grades-unrelease')?.addEventListener('click', async () => {
            if (!await confirmDialog(`ยกเลิกประกาศผล ${c.courseCode}? นักศึกษาจะไม่เห็นเกรดวิชานี้และ GPA จะคำนวณใหม่`)) return;
            saveSchedule(c, deadline(), null, `ยกเลิกประกาศผล ${c.courseCode} แล้ว`);
        });
        row.querySelectorAll('.grades-edit').forEach(btn => btn.addEventListener('click', () => {
            const panel = document.getElementById('adminGradeEditor');
            openGradeEditor(panel, Number(btn.dataset.sectionId), {
                toast: showToast, errorText: apiErrorText, isAdmin: true, onChange: () => {},
            });
            panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }));
    });
}
