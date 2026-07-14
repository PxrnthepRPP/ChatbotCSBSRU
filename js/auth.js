export const getAuthState = () => {
    return JSON.parse(sessionStorage.getItem('authState')) || { role: null, user: null, isImpersonating: false, impersonatedStudent: null };
};

export const saveAuthState = (state) => {
    sessionStorage.setItem('authState', JSON.stringify(state));
};

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
    saveAuthState({ role, user, isImpersonating: false, impersonatedStudent: null });
    return role;
};

export const logout = () => {
    sessionStorage.removeItem('authState');
};

export const impersonateStudent = (studentId, studentName) => {
    const state = getAuthState();
    state.isImpersonating = true;
    state.impersonatedStudent = { studentId, nameTh: studentName };
    saveAuthState(state);
    window.location.reload(); 
};

export const exitImpersonation = () => {
    const state = getAuthState();
    state.isImpersonating = false;
    state.impersonatedStudent = null;
    saveAuthState(state);
    window.location.reload();
};
