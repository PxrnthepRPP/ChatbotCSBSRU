/* ================================================================
   Chatbot satisfaction prompt (3 levels)
   - Shown once per login (or per browser tab for guests), never forced: ✕ closes it
   - Appears 5 minutes after the user's last activity in the chat, or when the chat is closed,
     but only after the user has sent at least one message
   ================================================================ */

import { fetchAPI } from '../api.js';

const IDLE_MS = 5 * 60 * 1000;
const DONE_KEY = 'bsru_satisfaction_done';
const LEVELS = [
    { level: 1, emoji: '😞', label: 'ไม่พอใจ' },
    { level: 2, emoji: '😐', label: 'พอใช้' },
    { level: 3, emoji: '😊', label: 'พอใจมาก' },
];

let idleTimer = null;
let hasChatted = false;
let getSessionIdFn = () => null;

function isDone() {
    try { return sessionStorage.getItem(DONE_KEY) === '1'; } catch (e) { return false; }
}

function markDone() {
    try { sessionStorage.setItem(DONE_KEY, '1'); } catch (e) { /* storage blocked: may ask again */ }
}

/** @param {{getSessionId: () => string|null}} opts */
export function initSatisfaction(opts) {
    getSessionIdFn = opts.getSessionId || getSessionIdFn;
}

/** A new login or logout: the next conversation may be rated again */
export function resetSatisfaction() {
    try { sessionStorage.removeItem(DONE_KEY); } catch (e) { /* ignore */ }
    hasChatted = false;
    clearTimeout(idleTimer);
    document.getElementById('satisfactionPrompt')?.remove();
}

/** The user sent a message */
export function noteUserMessage() {
    hasChatted = true;
    noteActivity();
}

/** Typing or sending in the chat restarts the 5-minute wait */
export function noteActivity() {
    clearTimeout(idleTimer);
    if (!hasChatted || isDone()) return;
    idleTimer = setTimeout(() => showSatisfactionPrompt('IDLE'), IDLE_MS);
}

/** The chat window was closed */
export function noteChatClosed() {
    if (hasChatted && !isDone()) showSatisfactionPrompt('CLOSE');
}

export function showSatisfactionPrompt(trigger) {
    if (isDone() || document.getElementById('satisfactionPrompt')) return;
    clearTimeout(idleTimer);
    const box = document.createElement('div');
    box.id = 'satisfactionPrompt';
    box.className = 'satisfaction-prompt';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-labelledby', 'satisfactionTitle');
    box.innerHTML = `
        <button type="button" class="satisfaction-close" aria-label="ปิด ไม่ประเมิน" title="ปิด">✕</button>
        <div class="satisfaction-title" id="satisfactionTitle">คุณพอใจกับการตอบของแชทบอทแค่ไหน?</div>
        <div class="satisfaction-sub">กดเลือกได้เลย ไม่ต้องพิมพ์อะไร</div>
        <div class="satisfaction-levels">
            ${LEVELS.map(l => `
                <button type="button" class="satisfaction-level" data-level="${l.level}" aria-label="${l.label}">
                    <span class="satisfaction-emoji" aria-hidden="true">${l.emoji}</span>
                    <span>${l.label}</span>
                </button>`).join('')}
        </div>`;
    document.body.appendChild(box);
    // Mark as asked now, so it does not come back during this login even if the page re-renders
    markDone();

    box.querySelector('.satisfaction-close').addEventListener('click', () => box.remove());
    box.querySelectorAll('.satisfaction-level').forEach(btn => btn.addEventListener('click', async () => {
        box.querySelectorAll('button').forEach(b => { b.disabled = true; });
        const body = { level: Number(btn.dataset.level), trigger };
        const sessionId = getSessionIdFn();
        if (sessionId) body.sessionId = sessionId;
        try {
            await fetchAPI('/chat/satisfaction', 'POST', body, 8000);
            box.innerHTML = '<div class="satisfaction-thanks">ขอบคุณสำหรับการประเมินครับ 🙏</div>';
        } catch (e) {
            box.innerHTML = '<div class="satisfaction-thanks">บันทึกผลไม่สำเร็จ ขออภัยครับ</div>';
        }
        setTimeout(() => box.remove(), 1800);
    }));
    box.querySelector('.satisfaction-level')?.focus();
}
