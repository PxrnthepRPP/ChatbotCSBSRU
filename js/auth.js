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
 * Log in with username and password. The backend checks the password (BCrypt, lockout after
 * repeated failures) and decides the role; nothing is stored until it accepts the login.
 * Throws an Error with a message for the login page.
 */
export const login = async (username, password) => {
    let authData;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Backend timeout')), 8000));
        authData = await Promise.race([loginAPI(username.trim(), password), timeout]);
    } catch (err) {
        logoutAPI();
        const match = /{.*}$/s.exec(err.message || '');
        let serverMessage = null;
        try { serverMessage = match ? JSON.parse(match[0]).error : null; } catch (e) { /* not JSON */ }
        if (serverMessage) {
            // A username typed with the Thai keyboard layout is a common cause of "wrong username"
            const thaiHint = /[฀-๿]/.test(username) ? ' (แป้นพิมพ์ยังเป็นภาษาไทยอยู่หรือไม่?)' : '';
            throw new Error(serverMessage + thaiHint);
        }
        throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบว่าระบบ backend ทำงานอยู่ แล้วลองใหม่');
    }

    const role = String(authData.role || '').replace('ROLE_', '');
    const user = {
        username: authData.username,
        displayName: authData.displayName,
        role,
        mustChangePassword: !!authData.mustChangePassword,
    };
    // The real ids, so the dashboard and the chatbot look at the same person
    if (role === 'STUDENT') user.studentId = authData.userId;
    if (role === 'ADVISOR') user.advisorId = authData.userId;
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
