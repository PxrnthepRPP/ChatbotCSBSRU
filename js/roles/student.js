/* ============================================================
   BSRU Student Portal — Student Role Dashboard Coordinator
   ============================================================ */

import { esc, fmt, statusBadge } from '../utils.js';
import {
    getStudentFullData,
    renderBibliography,
    updateTopbarAvatar,
    loadProfileFromDb,
    openStudentCareerModal,
    studentEditableData,
} from './student/profile.js';
import {
    renderTimetable,
    MOCK_TIMETABLE_SEMESTERS,
    MOCK_EXAMS,
    apiErrorMessage,
} from './student/timetableView.js';
import {
    renderGrades,
    MOCK_GRADES,
    cumulativeGpa,
} from './student/gradesView.js';
import {
    renderGraduation,
    resetGraduationState,
    MOCK_GRADUATION_AUDIT,
} from './student/graduationView.js';
import {
    renderPetitions,
    showPetitionToast,
} from './student/petitionsView.js';
import {
    renderActivity,
    BSRU_ACTIVITY_CRITERIA,
    MOCK_ACTIVITIES,
} from './student/activityView.js';

/* ============================================================
   AUXILIARY STATIC DATA & RENDERERS
   ============================================================ */
export const MOCK_FINANCE = {
    totalPaid: 75000, currentOwed: 18750,
    scholarship: 'ทุน กยศ. (กองทุนเงินให้กู้ยืมเพื่อการศึกษา)', scholarshipAmount: 40000,
    payments: [
        { semester: '1/2565', amount: 18750, status: 'ชำระแล้ว', date: '15 มิ.ย. 2565', method: 'ธนาคารกรุงไทย' },
        { semester: '2/2565', amount: 18750, status: 'ชำระแล้ว', date: '12 พ.ย. 2565', method: 'ธนาคารกรุงไทย' },
        { semester: '1/2566', amount: 18750, status: 'ชำระแล้ว', date: '18 มิ.ย. 2566', method: 'พร้อมเพย์' },
        { semester: '2/2566', amount: 18750, status: 'ชำระแล้ว', date: '14 พ.ย. 2566', method: 'พร้อมเพย์' },
        { semester: '1/2567', amount: 18750, status: 'ค้างชำระ', date: '-', method: '-' },
    ],
};

export function renderFinance() {
    const f = MOCK_FINANCE;
    const payRows = f.payments.map(p => `<tr><td>${esc(p.semester)}</td><td>${fmt(p.amount)} ฿</td><td><span class="badge ${statusBadge(p.status)}">${esc(p.status)}</span></td><td class="hide-mobile">${esc(p.date)}</td><td class="hide-mobile">${esc(p.method)}</td></tr>`).join('');
    document.getElementById('financeContent').innerHTML = `
        <div class="stat-row">
            <div class="finance-summary" style="flex:2"><h3>ยอดค้างชำระ</h3><div class="finance-amount">${fmt(f.currentOwed)} ฿</div><div class="finance-sub">ภาคเรียนที่ 1/2567</div></div>
            <div class="stat-card" style="flex:1"><div class="stat-icon green">💰</div><div><div class="stat-value">${fmt(f.totalPaid)}</div><div class="stat-label">ชำระแล้วทั้งหมด (฿)</div></div></div>
        </div>
        <div class="card"><div class="card-title">🎓 ทุนการศึกษา <span class="badge badge-green">ได้รับทุน</span></div><div class="profile-detail-grid"><div class="profile-item"><span class="label">ชื่อทุน</span><span class="value">${esc(f.scholarship)}</span></div><div class="profile-item"><span class="label">จำนวน</span><span class="value">${fmt(f.scholarshipAmount)} ฿/ปี</span></div></div></div>
        <div class="card"><div class="card-title">📋 ประวัติการชำระเงิน</div><div class="table-wrap"><table class="data-table"><thead><tr><th>ภาคเรียน</th><th>จำนวน</th><th>สถานะ</th><th class="hide-mobile">วันที่</th><th class="hide-mobile">ช่องทาง</th></tr></thead><tbody>${payRows}</tbody></table></div></div>`;
}

/* ============================================================
   MAIN ENTRY POINT (Dashboard Coordinator)
   ============================================================ */
let _careerSyncListenerBound = false;

export function initStudentDashboard(studentId) {
    const student = getStudentFullData(studentId);
    if (!_careerSyncListenerBound && typeof window !== 'undefined') {
        _careerSyncListenerBound = true;
        window.addEventListener('bsru:career-updated', (e) => {
            if (e.detail) {
                renderBibliography(e.detail);
                renderGraduation(e.detail);
            }
        });
    }
    // Reset graduation state per active student to prevent data bleed
    resetGraduationState(studentId);
    updateTopbarAvatar(student.avatar);
    renderBibliography(student);
    renderTimetable(studentId);
    renderFinance();
    renderGrades(student, studentId);
    renderGraduation(student);
    renderActivity(student);
    renderPetitions(student);
    loadProfileFromDb(student, studentId, () => {
        renderGraduation(student);
        renderActivity(student);
    });
}

/* ============================================================
   BACKWARD-COMPATIBLE RE-EXPORTS
   ============================================================ */
export {
    getStudentFullData,
    renderBibliography,
    updateTopbarAvatar,
    openStudentCareerModal,
    studentEditableData,
    loadProfileFromDb,
    renderTimetable,
    MOCK_TIMETABLE_SEMESTERS,
    MOCK_EXAMS,
    apiErrorMessage,
    renderGrades,
    MOCK_GRADES,
    cumulativeGpa,
    renderGraduation,
    resetGraduationState,
    MOCK_GRADUATION_AUDIT,
    renderPetitions,
    showPetitionToast,
    renderActivity,
    BSRU_ACTIVITY_CRITERIA,
    MOCK_ACTIVITIES,
};
