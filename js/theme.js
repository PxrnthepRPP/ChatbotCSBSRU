/* ================================================================
   BSRU Student Portal — Light / Dark Theme
   ================================================================
   The saved choice is applied by an inline script in index.html
   before the page paints; this module only handles the toggles.
   Works the same for every role (and on the login screen).
   ================================================================ */

const STORAGE_KEY = 'bsru_theme';

export function getTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function setTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    try {
        localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
        // Storage blocked (private mode): the theme still applies for this visit
    }
}

/** Every element with [data-theme-toggle] switches between light and dark */
export function initThemeToggle() {
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            setTheme(getTheme() === 'dark' ? 'light' : 'dark');
        });
    });
}
