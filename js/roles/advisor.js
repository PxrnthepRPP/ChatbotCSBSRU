/* ================================================================
   BSRU Student Portal — Advisor Role Logic & Dashboard
   ================================================================
   Handles Advisor Dashboard analytics for advisees academic status
   (graduated, studying, on leave, dismissed) and advisee list management.
   ================================================================ */

/* Feature modules live in js/roles/advisor/:
     ui.js            showAdvisorModal / showAdvisorToast
     risk.js          live advisee data, risk badges, risk card
     history.js       advisee history modal, advising notes, button binder
     dashboard.js     advisor dashboard
     advisees.js      my advisees list, simulated students
     courses.js       class sections I teach, exam announcements (+ mock data)
     sectionRoster.js full-screen section roster modal */

import { renderAdvisorDashboard } from './advisor/dashboard.js';
import { renderMyAdvisees, loadLiveAdvisees } from './advisor/advisees.js';
import { renderAdvisorCourses } from './advisor/courses.js';

export function initAdvisorDashboard() {
    renderAdvisorDashboard();
    renderMyAdvisees();
    renderAdvisorCourses();
    loadLiveAdvisees();
}

/* ============================================================
   BACKWARD-COMPATIBLE RE-EXPORTS (same public API as before the split)
   ============================================================ */
export { MOCK_ADVISOR_COURSES, MOCK_EXAM_ANNOUNCEMENTS } from './advisor/courses.js';
export { renderAdvisorCourses };
