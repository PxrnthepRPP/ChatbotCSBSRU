/* ============================================================
   BSRU Student Portal — Advisor shared UI (modal + toast)
   ============================================================ */


export function showAdvisorModal(title, html) {
    let overlay = document.getElementById('advHistoryModal');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'advHistoryModal';
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-card" style="max-width:900px;width:94vw;max-height:88vh;overflow:auto">
                <div class="modal-header">
                    <h3 id="advHistoryTitle"></h3>
                    <button class="modal-close" id="advHistoryClose" aria-label="ปิด">✕</button>
                </div>
                <div class="modal-body" id="advHistoryBody"></div>
            </div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
        overlay.querySelector('#advHistoryClose').addEventListener('click', () => overlay.classList.remove('open'));
    }
    overlay.querySelector('#advHistoryTitle').textContent = title;
    overlay.querySelector('#advHistoryBody').innerHTML = html;
    overlay.classList.add('open');
    return overlay;
}

export function showAdvisorToast(type, message) {
    const existing = document.querySelector('.petition-toast');
    if (existing) existing.remove();

    const icons = {
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };
    const toast = document.createElement('div');
    toast.className = `petition-toast petition-toast-${type}`;
    toast.innerHTML = `
        <div class="petition-toast-icon">${icons[type] || icons.info}</div>
        <span class="petition-toast-msg">${message}</span>
        <button class="petition-toast-close" aria-label="ปิด">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    toast.querySelector('.petition-toast-close').addEventListener('click', () => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    });
    setTimeout(() => { if (toast.parentNode) { toast.classList.remove('visible'); setTimeout(() => toast.remove(), 300); } }, 5000);
}
