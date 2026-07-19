/* ================================================================
   BSRU Student Portal — Auth Module (State-Driven)
   ================================================================
   All auth actions now go through the centralized state store.
   sessionStorage persistence is handled automatically by state.js.
   ================================================================ */

import { getState, setState } from './state.js';

/**
 * Returns the current auth state snapshot.
 * Kept for backward-compatibility with modules that call getAuthState().
 */
export const getAuthState = () => {
    const s = getState();
    return {
        role: s.currentRole,
        user: s.user,
        isImpersonating: s.isImpersonating,
        impersonatedStudent: s.impersonatedStudent,
    };
};

/**
 * Log in a user by username. Determines role from username.
 */
export const login = (username) => {
    let role, user;
    username = username.trim().toLowerCase();
    if (username === 'admin') {
        role = 'ADMIN';
        user = { username, displayName: 'ผู้ดูแลระบบ', role: 'ADMIN' };
    } else if (username === 'advisor') {
        role = 'ADVISOR';
        user = { username, displayName: 'ผศ.ดร.วิชัย เทคโนโลยี', role: 'ADVISOR' };
    } else {
        role = 'STUDENT';
        user = { username, displayName: 'สมชาย ใจดี', role: 'STUDENT' };
    }
    setState({
        currentRole: role,
        user,
        isImpersonating: false,
        impersonatedStudent: null,
    });
    return role;
};

/**
 * Log out — clears all auth state.
 */
export const logout = () => {
    setState({
        currentRole: null,
        user: null,
        isImpersonating: false,
        impersonatedStudent: null,
        activeModule: null,
    });
    sessionStorage.removeItem('authState');
};

/**
 * Impersonate a student (used by Admin and Advisor roles).
 */
export const impersonateStudent = (studentId, studentName) => {
    setState({
        isImpersonating: true,
        impersonatedStudent: { studentId, nameTh: studentName },
    });
    window.location.reload();
};

/**
 * Exit impersonation mode — revert to original role view.
 */
export const exitImpersonation = () => {
    setState({
        isImpersonating: false,
        impersonatedStudent: null,
    });
    window.location.reload();
};
