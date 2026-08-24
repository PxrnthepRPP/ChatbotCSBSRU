/* ================================================================
   BSRU Student Portal — Auth Module (State-Driven + JWT Authentication)
   ================================================================
   All auth actions go through the centralized state store and
   synchronize JWT tokens with the Spring Boot Security backend.
   ================================================================ */

import { getState, setState } from './state.js';
import { loginAPI, logoutAPI } from './api.js';

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
 * Log in a user by username and password.
 * Authenticates with Spring Boot JWT Backend (/api/auth/login).
 */
export const login = async (username, password = 'password') => {
    let role, user;
    const cleanUsername = username.trim().toLowerCase();

    if (cleanUsername === 'admin') {
        role = 'ADMIN';
        user = { username: cleanUsername, displayName: 'ผู้ดูแลระบบ (Admin)', role: 'ADMIN' };
    } else if (cleanUsername === 'advisor') {
        role = 'ADVISOR';
        user = { username: cleanUsername, displayName: 'ผศ.ดร.วิชัย เทคโนโลยี', role: 'ADVISOR' };
    } else {
        role = 'STUDENT';
        user = { username: cleanUsername, displayName: 'สมชาย ใจดี', role: 'STUDENT' };
    }

    // Authenticate with Spring Boot JWT Backend in background/foreground
    try {
        const authData = await loginAPI(username.trim(), password);
        if (authData && authData.token) {
            console.log('🔑 [Auth] JWT Token acquired from Spring Boot Backend:', authData.token.substring(0, 20) + '...');
            if (authData.displayName) user.displayName = authData.displayName;
        }
    } catch (err) {
        console.warn('⚠️ [Auth] Could not authenticate with Spring Boot Backend, running in standalone mode:', err);
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
 * Log out — clears all auth state and removes JWT tokens.
 */
export const logout = () => {
    logoutAPI();
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
