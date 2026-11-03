/* ================================================================
   BSRU Student Portal — Main Entry Point (State-Driven)
   ================================================================
   Uses centralized state store for routing, role management,
   and module switching. Loads CSS modules on-demand.
   ================================================================ */

import { getState, setState, subscribe } from './state.js';
import { login, logout, getAuthState, exitImpersonation } from './auth.js';
import { fetchAPI } from './api.js';
import { loadRoleCSS, loadComponentCSS } from './css-loader.js';
import { initChatbot } from './components/chatbot.js';
import { initThemeToggle } from './theme.js';
import { initModalA11y } from './components/modalA11y.js';
import { openChangePasswordModal } from './components/password.js';
import { initAdminDashboard } from './roles/admin.js';
import { initAdvisorDashboard } from './roles/advisor.js';
import { initStudentDashboard } from './roles/student.js';
import { initNotifications, clearNotifications } from './components/notifications.js';

// ================================================================
// UTILITY FUNCTIONS (Imported & re-exported for backward compatibility)
// ================================================================
import { esc, fmt, gradeClass, statusBadge, getBatch } from './utils.js';
export { esc, fmt, gradeClass, statusBadge, getBatch };

// ================================================================
// NAVIGATION CONFIG
// ================================================================
const NAV_CONFIG = {
    ADMIN: [
        { module: 'admin-dashboard', label: 'แดชบอร์ด', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>' },
        { module: 'manage-advisors', label: 'จัดการอาจารย์ที่ปรึกษา', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>' },
        { module: 'manage-students', label: 'จัดการนักศึกษา', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' },
        { module: 'manage-petitions', label: 'รายการคำร้องวิชาการ', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>' },
        { module: 'manage-knowledge', id: 'manage-knowledge', label: 'จัดการคลังความรู้', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M12 6v6"/><path d="M9 9h6"/></svg>' },
    ],
    ADVISOR: [
        { module: 'advisor-dashboard', label: 'แดชบอร์ด', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>' },
        { module: 'my-advisees', label: 'นักศึกษาในที่ปรึกษา', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>' },
        { module: 'advisor-courses', label: 'จัดการรายวิชา & ประกาศสอบ', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>' },

    ],
    STUDENT: [
        { module: 'bibliography', label: 'ประวัตินักศึกษา', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' },
        { module: 'timetable', label: 'ตารางเรียน/สอบ', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' },
        { module: 'finance', label: 'การเงิน/ทุนการศึกษา', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>' },
        { module: 'grades', label: 'ผลการเรียน', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' },
        { module: 'graduation', label: 'ตรวจสอบจบ', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.657 2.686 3 6 3s6-1.343 6-3v-5"/></svg>' },
        { module: 'activity', label: 'กิจกรรม', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' },
        { module: 'petitions', label: 'ยื่นคำร้องวิชาการ', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="M9 15h6"/></svg>' },
    ],
};

const MODULE_TITLES = {
    'admin-dashboard': 'แดชบอร์ดผู้ดูแล', 'manage-advisors': 'จัดการอาจารย์', 'manage-students': 'จัดการนักศึกษา', 'manage-petitions': 'รายการคำร้องวิชาการ',
    'manage-knowledge': 'จัดการคลังความรู้',
    'advisor-dashboard': 'แดชบอร์ดอาจารย์', 'my-advisees': 'นักศึกษาในที่ปรึกษา', 'advisor-courses': 'จัดการรายวิชา & ประกาศสอบ',

    'bibliography': 'ประวัตินักศึกษา', 'timetable': 'ตารางเรียน/สอบ', 'finance': 'การเงิน/ทุนการศึกษา',
    'grades': 'ผลการเรียน', 'graduation': 'ตรวจสอบจบ', 'activity': 'กิจกรรม', 'petitions': 'ยื่นคำร้องวิชาการ',
};

// ================================================================
// DOM REFERENCES & INITIALIZATION
// ================================================================
function initApp() {
    initThemeToggle();
    initModalA11y();
    const loginOverlay = document.getElementById('loginOverlay');
    const loginForm = document.getElementById('loginForm');
    const loginUsername = document.getElementById('loginUsername');
    const dashboard = document.getElementById('dashboard');
    const sidebar = document.getElementById('sidebar');
    const sidebarNav = document.getElementById('sidebarNav');
    const sidebarRole = document.getElementById('sidebarRole');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const topbarTitle = document.getElementById('topbarTitle');
    const topbarUserName = document.getElementById('topbarUserName');
    const logoutBtn = document.getElementById('logoutBtn');
    const exitImpBtn = document.getElementById('exitImpersonation');
    const impBanner = document.getElementById('impersonationBanner');
    const allModules = document.querySelectorAll('.module');

    // ── Read initial state ──
    const initialState = getState();

    if (initialState.currentRole) {
        loginOverlay.style.display = 'none';
        dashboard.style.display = 'flex';
        initDashboard();
        initNotifications();
        requirePasswordChangeIfNeeded();
    }

    /** Accounts on a first / reset password cannot use the system until the password is changed */
    function requirePasswordChangeIfNeeded() {
        if (!getAuthState().user?.mustChangePassword) return;
        openChangePasswordModal({
            forced: true,
            onChanged: () => setState({ user: { ...getState().user, mustChangePassword: false } }),
            onLogout: () => { logout(); window.location.reload(); },
        });
    }

    // ── Login Form ──
    function showLoginError(message) {
        let box = document.getElementById('loginError');
        if (!box) {
            box = document.createElement('div');
            box.id = 'loginError';
            box.className = 'login-error';
            box.setAttribute('role', 'alert');
            document.getElementById('loginBtn').before(box);
        }
        box.textContent = message;
        box.style.display = message ? 'block' : 'none';
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = loginUsername.value.trim();
        const passwordInput = document.getElementById('loginPassword');
        const password = passwordInput ? passwordInput.value : '';
        if (!username) return;
        if (!password) {
            showLoginError('กรุณากรอกรหัสผ่าน');
            passwordInput?.focus();
            return;
        }

        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) loginBtn.disabled = true;
        showLoginError('');

        try {
            await login(username, password);
        } catch (err) {
            showLoginError(err.message);
            if (loginBtn) loginBtn.disabled = false;
            return;
        }

        const loginCard = document.getElementById('loginCard');
        if (loginCard) loginCard.style.animation = 'cardExit 0.4s ease forwards';

        setTimeout(async () => {
            loginOverlay.style.display = 'none';
            dashboard.style.display = 'flex';
            await initDashboard();
            initNotifications();
            requirePasswordChangeIfNeeded();
        }, 300);
    });

    // A stale error stays wrong once the user edits either field
    [loginUsername, document.getElementById('loginPassword')].forEach(input =>
        input?.addEventListener('input', () => showLoginError('')));

    // ── Demo-account shortcuts (dev profile only; the backend decides) ──
    fetchAPI('/auth/config', 'GET', null, 5000)
        .then(cfg => { if (cfg?.showDemoAccounts) document.getElementById('demoAccounts').hidden = false; })
        .catch(() => { /* backend down or old version: keep the shortcuts hidden */ });

    document.querySelectorAll('.role-hint[data-demo-user]').forEach(hint => {
        hint.addEventListener('click', () => {
            loginUsername.value = hint.dataset.demoUser;
            const passwordInput = document.getElementById('loginPassword');
            if (passwordInput) passwordInput.value = 'password';
            showLoginError('');
            document.getElementById('loginBtn')?.focus();
        });
    });

    // ── Change password (every role) ──
    document.getElementById('changePasswordBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        openChangePasswordModal();
    });

    // ── Logout ──
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const state = getState();
        if (state.isImpersonating) exitImpersonation();
        clearNotifications();
        logout();
        window.location.reload();
    });

    if (exitImpBtn) {
        exitImpBtn.addEventListener('click', exitImpersonation);
    }

    // Expose navigation helper for notification deep linking
    window.navigateToModule = (modId) => {
        if (!modId) return;
        setState({ activeModule: modId });
        if (typeof window.closeMobileSidebar === 'function') {
            window.closeMobileSidebar();
        }
    };

    // Module pages share one document; restoring the old scroll offset on Back lands mid-page
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    let replacingHash = false;   // next module change replaces the history entry (first page after login)
    let fromHistory = false;     // next module change came from Back/Forward: don't push it again

    // ── State subscriber: active module changes ──
    subscribe('activeModule', (modId) => {
        if (!modId) return;

        // Update sidebar active link
        sidebarNav.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        const activeLink = sidebarNav.querySelector(`[data-module="${modId}"]`);
        if (activeLink) activeLink.classList.add('active');

        // Show/hide modules
        allModules.forEach(m => m.style.display = 'none');
        const mod = document.getElementById(`mod-${modId}`);
        if (mod) {
            mod.style.display = 'block';
            mod.style.animation = 'none';
            mod.offsetHeight; // reflow
            mod.style.animation = '';
        }

        // Update topbar title
        topbarTitle.textContent = MODULE_TITLES[modId] || '';

        // Each module is its own URL (#module): refresh, Back and shared links land on it
        if (location.hash !== `#${modId}`) {
            const url = `${location.pathname}${location.search}#${modId}`;
            if (replacingHash) history.replaceState(null, '', url);
            else if (!fromHistory) history.pushState(null, '', url);
        }
        replacingHash = false;
        fromHistory = false;

        // A new page starts at its top, not at the previous page's scroll position
        // (after the frame: the module renders and the browser may restore a scroll position first)
        window.scrollTo({ top: 0, behavior: 'instant' });
        requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' }));

        // Load component CSS on demand
        if (modId === 'timetable') {
            loadComponentCSS('timetable');
        }
        if (modId === 'petitions' || modId === 'manage-petitions') {
            loadComponentCSS('petitions');
        }
        if (modId === 'advisor-courses') {
            loadComponentCSS('petitions'); // Reuse shared form styles
        }

        closeMobileSidebar();
    });

    // Initialize Chatbot Widget
    initChatbot();

    async function initDashboard() {
        const state = getState();

        // ── Impersonation banner ──
        if (state.isImpersonating) {
            document.body.classList.add('impersonating');
            impBanner.classList.add('visible');
            document.getElementById('impStudentName').textContent = state.impersonatedStudent.nameTh;
            document.getElementById('impStudentId').textContent = state.impersonatedStudent.studentId;
        }

        // ── Determine effective role ──
        const effectiveRole = state.isImpersonating ? 'STUDENT' : state.currentRole;

        // ── Load role-specific CSS ──
        await loadRoleCSS(effectiveRole);

        // ── Build sidebar ──
        buildSidebar(state);

        // ── Topbar user name ──
        topbarUserName.textContent = state.user.displayName;

        // ── Initialize role dashboard ──
        if (effectiveRole === 'ADMIN') {
            initAdminDashboard();
        } else if (effectiveRole === 'ADVISOR') {
            initAdvisorDashboard();
        } else {
            const studentId = state.isImpersonating
                ? state.impersonatedStudent.studentId
                : (state.user.studentId || '6621100042');
            initStudentDashboard(studentId);
        }

        // ── Open the module named in the URL (#grades), else the first one ──
        const fromHash = moduleFromHash();
        const firstLink = sidebarNav.querySelector('.nav-link');
        if (fromHash) {
            setState({ activeModule: fromHash });
        } else if (firstLink) {
            replacingHash = true;   // the landing page replaces the entry instead of adding one
            setState({ activeModule: firstLink.dataset.module });
        }
    }

    /** Module id from location.hash when this role has that module, otherwise null */
    function moduleFromHash() {
        const id = decodeURIComponent(location.hash.replace(/^#/, ''));
        return id && sidebarNav.querySelector(`.nav-link[data-module="${CSS.escape(id)}"]`) ? id : null;
    }

    // Back / Forward and edited URLs switch modules too
    window.addEventListener('popstate', () => {
        const id = moduleFromHash();
        if (id && id !== getState().activeModule) {
            fromHistory = true;
            setState({ activeModule: id });
        }
    });

    function buildSidebar(state) {
        const role = state.isImpersonating ? 'STUDENT' : state.currentRole;
        sidebarRole.className = 'sidebar-role role-' + role.toLowerCase();
        const roleLabels = { ADMIN: '🔑 ADMINISTRATOR', ADVISOR: '👩‍🏫 ADVISOR', STUDENT: '🎓 STUDENT' };
        sidebarRole.textContent = roleLabels[role];

        const links = NAV_CONFIG[role] || NAV_CONFIG.STUDENT;
        sidebarNav.innerHTML = links.map(l =>
            `<a href="#${l.module}" class="nav-link" data-module="${l.module}">${l.icon}<span>${esc(l.label)}</span></a>`
        ).join('');

        sidebarNav.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                setState({ activeModule: link.dataset.module });
                closeMobileSidebar();
            });
        });
    }

    // ── Mobile Sidebar Handling ──
    const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');

    function toggleMobileSidebar(e) {
        if (e && e.stopPropagation) e.stopPropagation();
        if (sidebar) sidebar.classList.toggle('open');
        if (sidebarOverlay) sidebarOverlay.classList.toggle('visible');
    }

    function closeMobileSidebar(e) {
        if (e && e.stopPropagation) e.stopPropagation();
        if (sidebar) sidebar.classList.remove('open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('visible');
    }

    window.toggleMobileSidebar = toggleMobileSidebar;
    window.closeMobileSidebar = closeMobileSidebar;

    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', toggleMobileSidebar);
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeMobileSidebar);
    }

    if (sidebarCloseBtn) {
        sidebarCloseBtn.addEventListener('click', closeMobileSidebar);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
