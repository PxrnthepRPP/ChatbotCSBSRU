/* ============================================================
   BSRU Student Portal — Admin Role Dashboard Coordinator
   ============================================================
   Feature modules live in js/roles/admin/:
     mockData.js            MOCK_ADVISORS / MOCK_STUDENTS_POOL / MOCK_PETITIONS_LOG
     shared.js              batch range, pagination, apiErrorText
     dashboard.js           overview, batch filter, charts, career CSV
     registrationPeriods.js add/drop windows (dashboard card)
     sections.js            class-section approval (dashboard card)
     enrollmentRequests.js  student registration requests (dashboard card)
     advisors.js            manage advisors
     students.js            manage students (+ CSV import/export)
     graduationAudit.js     graduation audit JSON download/upload
     petitions.js           petition log & review modal
     knowledge.js           RAG knowledge base management
   ============================================================ */

import { fetchAPI } from '../api.js';
import { petitionStatus } from '../utils.js';
import { MOCK_ADVISORS, MOCK_STUDENTS_POOL, MOCK_PETITIONS_LOG } from './admin/mockData.js';
import { renderAdminDashboard } from './admin/dashboard.js';
import { renderManageAdvisors } from './admin/advisors.js';
import { renderManageStudents, toPoolStudent, setStudentsFromDb } from './admin/students.js';
import { renderManagePetitions } from './admin/petitions.js';
import { renderKnowledgeManagement } from './admin/knowledge.js';

export async function initAdminDashboard() {
    // 1. Initial render with local/fallback data
    renderAdminDashboard();
    renderManageAdvisors();
    renderManageStudents();
    renderManagePetitions();
    renderKnowledgeManagement();

    // 2. Fetch live data from Spring Boot REST API
    try {
        console.log('🔄 [Admin] Connecting to Spring Boot Backend API...');
        const [liveStudents, livePetitions, liveAdvisors] = await Promise.all([
            fetchAPI('/students').catch(() => null),
            fetchAPI('/petitions').catch(() => null),
            fetchAPI('/advisors').catch(() => null),
        ]);

        // Real advisors, so the advisor picked for a student is an id that exists in the database
        if (Array.isArray(liveAdvisors) && liveAdvisors.length > 0) {
            const counts = {};
            (liveStudents || []).forEach(st => { const id = st.advisor?.id; if (id) counts[id] = (counts[id] || 0) + 1; });
            MOCK_ADVISORS.splice(0, MOCK_ADVISORS.length, ...liveAdvisors.map(a => ({
                id: a.id, nameTh: a.nameTh, nameEn: a.nameEn, email: a.email, phone: a.phone,
                department: a.department, studentsCount: counts[a.id] || 0,
            })));
            renderManageAdvisors();
        }

        if (Array.isArray(liveStudents) && liveStudents.length > 0) {
            console.log('✅ [Admin] Loaded Live Students from Backend API:', liveStudents);
            MOCK_STUDENTS_POOL.splice(0, MOCK_STUDENTS_POOL.length, ...liveStudents.map(toPoolStudent));
            setStudentsFromDb(true);
            renderAdminDashboard();
            renderManageStudents();
        }

        if (Array.isArray(livePetitions) && livePetitions.length > 0) {
            console.log('✅ [Admin] Loaded Live Petitions from Backend API:', livePetitions);
            const formattedPetitions = livePetitions.map(p => {
                const now = p.submittedAt ? new Date(p.submittedAt) : new Date();
                const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
                const dateStr = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear() + 543} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                return {
                    id: p.id,
                    studentId: p.student ? p.student.studentId : '6621100042',
                    studentName: p.student ? p.student.nameTh : 'นักศึกษา',
                    type: p.type,
                    title: p.title,
                    details: p.details,
                    attachment: p.attachment || (p.attachmentPath ? p.attachmentPath.split(/[/\\]/).pop() : null),
                    attachmentPath: p.attachmentPath,
                    submittedAt: dateStr,
                    status: petitionStatus(p.status || 'รอดำเนินการ'),
                    advisorComment: p.advisorComment || '',
                    advisorReviewedAt: p.advisorReviewedAt || '',
                    adminComment: p.adminComment || '',
                    adminReviewedAt: p.adminReviewedAt || '',
                };
            });
            MOCK_PETITIONS_LOG.splice(0, MOCK_PETITIONS_LOG.length, ...formattedPetitions);
            renderManagePetitions();
        }
    } catch (err) {
        console.warn('⚠️ [Admin] Could not connect to Spring Boot Backend, using fallback dataset:', err);
    }
}

// Global modal close logic for any modal
document.addEventListener('DOMContentLoaded', () => {
    const crudModal = document.getElementById('crudModal');
    const modalClose = document.getElementById('modalClose');
    const modalCancel = document.getElementById('modalCancel');

    const closeModal = () => { crudModal.classList.remove('open'); };
    if(modalClose) modalClose.addEventListener('click', closeModal);
    if(modalCancel) modalCancel.addEventListener('click', closeModal);
    if(crudModal) crudModal.addEventListener('click', (e) => { if (e.target === crudModal) closeModal(); });
});

/* ============================================================
   BACKWARD-COMPATIBLE RE-EXPORTS (same public API as before the split)
   ============================================================ */
export { MOCK_ADVISORS, MOCK_STUDENTS_POOL, MOCK_PETITIONS_LOG } from './admin/mockData.js';
export { apiErrorText } from './admin/shared.js';
export { exportCareerStatisticsCsv } from './admin/dashboard.js';
export { sectionStatusBadge } from './admin/sections.js';
export { renderKnowledgeManagement };
