/* ================================================================
   BSRU Student Portal — Dynamic CSS Loader
   ================================================================
   Loads CSS modules on-demand to improve performance.
   Tracks loaded files to prevent duplicates.
   ================================================================ */

const _loadedHrefs = new Set();

/**
 * Dynamically load a CSS file by href.
 * Returns a Promise that resolves when the stylesheet is loaded.
 * No-ops if already loaded.
 */
export function loadCSS(href) {
    if (_loadedHrefs.has(href)) return Promise.resolve();

    return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.onload = () => {
            _loadedHrefs.add(href);
            resolve();
        };
        link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));
        document.head.appendChild(link);
    });
}

/**
 * Load role-specific CSS.
 * @param {'ADMIN'|'ADVISOR'|'STUDENT'} role
 */
export function loadRoleCSS(role) {
    const map = {
        ADMIN: 'css/roles/admin.css',
        ADVISOR: 'css/roles/advisor.css',
        STUDENT: 'css/roles/student.css',
    };
    const href = map[role.toUpperCase()];
    if (!href) return Promise.resolve();
    return loadCSS(href);
}

/**
 * Load component-specific CSS.
 * @param {string} component  e.g. 'timetable', 'chatbot'
 */
export function loadComponentCSS(component) {
    return loadCSS(`css/components/${component}.css`);
}
