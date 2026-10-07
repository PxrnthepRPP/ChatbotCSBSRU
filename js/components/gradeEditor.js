/**
 * Grade sheet of one section, shared by the teacher page and the admin page.
 * Teachers may change grades any number of times and must press "ส่งเกรด" before the deadline;
 * a change after sending needs sending again. After the deadline or once released only the admin
 * can change grades. Students see the grades (and GPA counts them) only after the admin releases the course.
 */
import { esc, fetchAPI } from '../utils.js';

const GRADES = ['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F'];
const DATE_TIME = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
const when = iso => iso ? DATE_TIME.format(new Date(iso)) : null;

/**
 * @param {HTMLElement} container where the sheet is drawn
 * @param {number} sectionId
 * @param {{toast: (type: string, msg: string) => void, errorText: (err: any) => string, isAdmin?: boolean, onChange?: () => void}} opts
 */
export async function openGradeEditor(container, sectionId, opts) {
    let data;
    try {
        data = await fetchAPI(`/sections/${sectionId}/grades`);
    } catch (err) {
        opts.toast('error', esc(opts.errorText(err)));
        return;
    }
    draw(container, data, opts);
}

function draw(container, d, opts) {
    const releaseText = d.released
        ? `<span class="badge badge-green">ประกาศผลแล้ว ${esc(when(d.releaseAt))}</span>`
        : d.releaseAt
            ? `<span class="badge badge-blue">กำหนดประกาศผล ${esc(when(d.releaseAt))}</span>`
            : '<span class="badge badge-amber">ยังไม่ประกาศผล</span>';
    const submitText = d.submitted
        ? `<span class="badge badge-green">ส่งเกรดแล้ว ${esc(when(d.submittedAt))}</span>`
        : '<span class="badge badge-amber">ยังไม่ส่งเกรด</span>';
    const deadlineText = d.submitDeadline
        ? `<span class="badge badge-purple">ส่งภายใน ${esc(when(d.submitDeadline))}</span>`
        : '<span class="badge badge-purple">ยังไม่กำหนดวันส่ง</span>';

    const rows = d.rows.map(r => `
        <tr>
            <td><strong>${esc(r.studentId)}</strong></td>
            <td>${esc(r.nameTh)}</td>
            <td class="hide-mobile" style="text-align:center">${r.year ?? '-'}</td>
            <td>
                <select class="batch-select grade-select" data-sid="${esc(r.studentId)}" data-original="${esc(r.grade || '')}" ${d.canEdit ? '' : 'disabled'}>
                    <option value="">—</option>
                    ${GRADES.map(g => `<option value="${g}" ${r.grade === g ? 'selected' : ''}>${g}</option>`).join('')}
                </select>
            </td>
            <td class="hide-mobile" style="font-size:0.78rem;color:var(--text-muted)">${r.updatedAt ? `${esc(when(r.updatedAt))} · ${esc(r.updatedBy)}` : ''}</td>
        </tr>`).join('');

    container.innerHTML = `
        <div class="app-form-panel" style="margin-top:12px">
            <div class="app-form-header">
                <div>
                    <div class="app-form-title">📝 เกรด ${esc(d.courseCode)} ${esc(d.courseName)} · Sec ${esc(d.sectionNo)} · ภาค ${d.term}/${d.academicYear}</div>
                    <div class="app-form-subtitle" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">${deadlineText} ${submitText} ${releaseText}
                        <span class="badge badge-blue">ใส่แล้ว ${d.graded}/${d.rows.length} คน</span></div>
                </div>
                <button type="button" class="btn btn-sm btn-ghost grade-close" style="padding:4px 10px;font-size:0.8rem">✕ ปิด</button>
            </div>
            ${d.lockReason ? `<div class="badge badge-amber" style="display:block;white-space:normal;padding:8px 12px;margin-bottom:8px;font-size:0.85rem">🔒 ${esc(d.lockReason)}</div>` : ''}
            <p style="font-size:0.8rem;color:var(--text-muted);margin:4px 0 8px">
                ${opts.isAdmin
                    ? 'ผู้ดูแลระบบแก้เกรดได้ตลอด (ไม่เปลี่ยนสถานะการส่งของอาจารย์) · ถ้าวิชาประกาศผลแล้ว นักศึกษาเห็นเกรดใหม่ทันที'
                    : 'แก้ได้หลายครั้งจนถึงวันส่ง และต้องกด "ส่งเกรด" ก่อนวันส่ง · ถ้าแก้หลังส่งแล้วต้องกดส่งใหม่ · นักศึกษาจะเห็นเกรดเมื่อผู้ดูแลระบบประกาศผลเท่านั้น'}
            </p>
            <div class="table-wrap">
                <table class="data-table">
                    <thead><tr><th>รหัสนักศึกษา</th><th>ชื่อ-สกุล</th><th class="hide-mobile" style="text-align:center">ชั้นปี</th><th>เกรด</th><th class="hide-mobile">แก้ล่าสุด</th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">ยังไม่มีนักศึกษาที่ลงทะเบียน (ยืนยันแล้ว) ในกลุ่มนี้</td></tr>'}</tbody>
                </table>
            </div>
            ${d.canEdit && d.rows.length ? `
            <div class="app-form-actions">
                <button class="app-btn-ghost grade-save">💾 บันทึก</button>
                ${opts.isAdmin ? '' : `<button class="app-btn-primary grade-submit">📤 ${d.submitted ? 'ส่งเกรดอีกครั้ง' : 'ส่งเกรด'}</button>`}
            </div>` : ''}
        </div>`;

    container.querySelector('.grade-close').addEventListener('click', () => { container.innerHTML = ''; });

    // Only changed rows are sent, so an unchanged sheet keeps its "sent" status
    const changes = () => {
        const out = {};
        container.querySelectorAll('.grade-select').forEach(sel => {
            if (sel.value !== sel.dataset.original) out[sel.dataset.sid] = sel.value;
        });
        return out;
    };
    const save = async () => {
        const grades = changes();
        if (Object.keys(grades).length === 0) return null;
        return fetchAPI(`/sections/${d.sectionId}/grades`, 'PUT', { grades }, 10000);
    };

    container.querySelector('.grade-save')?.addEventListener('click', async () => {
        try {
            const saved = await save();
            if (!saved) {
                opts.toast('error', 'ยังไม่มีเกรดที่เปลี่ยน');
                return;
            }
            opts.toast('success', saved.submitted || opts.isAdmin
                ? 'บันทึกเกรดแล้ว'
                : 'บันทึกเกรดแล้ว (ยังไม่ได้ส่ง กด "ส่งเกรด" ก่อนวันส่ง)');
            draw(container, saved, opts);
            opts.onChange?.();
        } catch (err) {
            opts.toast('error', esc(opts.errorText(err)));
        }
    });

    container.querySelector('.grade-submit')?.addEventListener('click', async () => {
        if (!confirm(`ส่งเกรด ${d.courseCode} Sec ${d.sectionNo} ให้ผู้ดูแลระบบ?\nแก้ได้จนถึงวันส่ง แต่ถ้าแก้ต้องกดส่งใหม่`)) return;
        try {
            await save();
            const sent = await fetchAPI(`/sections/${d.sectionId}/grades/submit`, 'POST', null, 10000);
            opts.toast('success', 'ส่งเกรดแล้ว');
            draw(container, sent, opts);
            opts.onChange?.();
        } catch (err) {
            opts.toast('error', esc(opts.errorText(err)));
            // Grades may have been saved even though sending failed (e.g. someone without a grade)
            openGradeEditor(container, d.sectionId, opts);
        }
    });
}
