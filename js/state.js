/* ================================================================
   BSRU Student Portal — Centralized State Management (Pub/Sub)
   ================================================================
   Single source of truth for the entire SPA.
   Usage:
     import { getState, setState, subscribe } from './state.js';
     subscribe('currentRole', (newVal, oldVal) => { ... });
     setState({ currentRole: 'ADMIN' });
     const snapshot = getState();
   ================================================================ */

const _listeners = {};      // key -> Set<callback>
const _globalListeners = new Set(); // fire on ANY change

// ── Default State ──
const _state = {
    // Auth
    currentRole: null,           // 'ADMIN' | 'ADVISOR' | 'STUDENT' | null
    user: null,                  // { username, displayName, role }
    isImpersonating: false,
    impersonatedStudent: null,   // { studentId, nameTh }

    // Navigation
    activeModule: null,          // e.g. 'admin-dashboard', 'timetable'

    // Student-context selections
    selectedTimetableSemester: 0,
    selectedGradesSemester: 0,

    // Chatbot
    chatbotOpen: false,


    // CSS modules loaded
    loadedCSS: [],
};

// ── Hydrate from sessionStorage & localStorage on startup ──
try {
    const persisted = JSON.parse(sessionStorage.getItem('authState'));
    if (persisted) {
        _state.currentRole = persisted.role || null;
        _state.user = persisted.user || null;
        _state.isImpersonating = !!persisted.isImpersonating;
        _state.impersonatedStudent = persisted.impersonatedStudent || null;
    }
    const persistedTheme = localStorage.getItem('themeState');
    if (persistedTheme) {
        _state.theme = persistedTheme;
    }
} catch { /* ignore corrupt storage */ }

/**
 * Subscribe to changes on a specific state key.
 * Returns an unsubscribe function.
 */
export function subscribe(key, callback) {
    if (!_listeners[key]) _listeners[key] = new Set();
    _listeners[key].add(callback);
    return () => _listeners[key].delete(callback);
}

/**
 * Subscribe to ALL state changes (fires once per setState call).
 * Callback receives (changedKeys[], newState).
 */
export function subscribeAll(callback) {
    _globalListeners.add(callback);
    return () => _globalListeners.delete(callback);
}

/**
 * Merge a partial update into state, then notify affected subscribers.
 * Only keys whose values actually changed will trigger notifications.
 */
export function setState(partial) {
    const changed = [];

    for (const key of Object.keys(partial)) {
        const oldVal = _state[key];
        const newVal = partial[key];

        // Shallow equality check (sufficient for primitives + object refs)
        if (oldVal === newVal) continue;

        _state[key] = newVal;
        changed.push(key);

        // Notify per-key subscribers
        if (_listeners[key]) {
            for (const cb of _listeners[key]) {
                try { cb(newVal, oldVal); } catch (e) { console.error(`[state] subscriber error on "${key}":`, e); }
            }
        }
    }

    // Persist auth-related keys to sessionStorage
    if (changed.some(k => ['currentRole', 'user', 'isImpersonating', 'impersonatedStudent'].includes(k))) {
        _persistAuth();
    }
    
    // Persist theme to localStorage
    if (changed.includes('theme')) {
        localStorage.setItem('themeState', _state.theme);
    }

    // Notify global listeners
    if (changed.length > 0) {
        const snapshot = getState();
        for (const cb of _globalListeners) {
            try { cb(changed, snapshot); } catch (e) { console.error('[state] global subscriber error:', e); }
        }
    }
}

/**
 * Returns a frozen shallow copy of the current state.
 */
export function getState() {
    return Object.freeze({ ..._state });
}

/**
 * Persist auth keys to sessionStorage.
 * @private
 */
function _persistAuth() {
    const authPayload = {
        role: _state.currentRole,
        user: _state.user,
        isImpersonating: _state.isImpersonating,
        impersonatedStudent: _state.impersonatedStudent,
    };
    sessionStorage.setItem('authState', JSON.stringify(authPayload));
}
