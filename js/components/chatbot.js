/* ================================================================
   BSRU Student Portal — Chatbot Component (Enhanced UX)
   ================================================================
   Features:
   - Capability Transparency: structured welcome with capability chips
   - Micro-Feedback: smooth typing indicator with label text
   - Unhappy Path: preserves user input on error for easy retry
   ================================================================ */

import { getAuthState } from '../auth.js';
import { loadComponentCSS } from '../css-loader.js';

export function initChatbot() {
    const API_URL = 'http://localhost:8080/api/chat';
    const chatbotFab = document.getElementById('chatbotFab');
    const chatbotWindow = document.getElementById('chatbotWindow');
    const cwCloseBtn = document.getElementById('cwCloseBtn');
    const cwMessages = document.getElementById('cwMessages');
    const cwInput = document.getElementById('cwInput');
    const cwSendBtn = document.getElementById('cwSendBtn');
    const fabBadge = document.getElementById('fabBadge');

    let chatbotOpen = false;
    let cwWaiting = false;
    let welcomeShown = false;

    if (!chatbotFab) return;

    // Load chatbot CSS dynamically
    loadComponentCSS('chatbot');

    chatbotFab.addEventListener('click', toggleChatbot);
    cwCloseBtn.addEventListener('click', toggleChatbot);

    function toggleChatbot() {
        chatbotOpen = !chatbotOpen;
        chatbotWindow.classList.toggle('open', chatbotOpen);
        chatbotFab.classList.toggle('open', chatbotOpen);
        if (chatbotOpen) {
            fabBadge.classList.add('hidden');
            cwInput.focus();
            if (!welcomeShown) {
                showWelcomeMessage();
                welcomeShown = true;
            }
        }
    }

    /**
     * Show structured welcome message with capability chips.
     */
    function showWelcomeMessage() {
        const welcomeDiv = document.createElement('div');
        welcomeDiv.className = 'cw-welcome';
        welcomeDiv.innerHTML = `
            <div class="cw-welcome-header">
                <div class="cw-welcome-avatar">
                    <svg viewBox="0 0 24 24" fill="none"><path d="M12 2C8.686 2 6 4.686 6 8V10H5C4.448 10 4 10.448 4 11V19C4 19.552 4.448 20 5 20H19C19.552 20 20 19.552 20 19V11C20 10.448 19.552 10 19 10H18V8C18 4.686 15.314 2 12 2ZM9 13C9.552 13 10 13.448 10 14V16C10 16.552 9.552 17 9 17C8.448 17 8 16.552 8 16V14C8 13.448 8.448 13 9 13ZM15 13C15.552 13 16 13.448 16 14V16C16 16.552 15.552 17 15 17C14.448 17 14 16.552 14 16V14C14 13.448 14.448 13 15 13ZM8 8C8 5.791 9.791 4 12 4C14.209 4 16 5.791 16 8V10H8V8Z" fill="currentColor"/></svg>
                </div>
                <div>
                    <h4>สวัสดี! 👋 ฉันคือ BSRU CS Chatbot</h4>
                    <p>ผู้ช่วยอัจฉริยะสำหรับนักศึกษาสาขาวิทยาการคอมพิวเตอร์</p>
                </div>
            </div>
            <div class="cw-welcome-body">
                <span class="cw-welcome-label">ฉันช่วยอะไรคุณได้บ้าง:</span>
                <div class="cw-capabilities">
                    <button class="cw-capability-chip" data-query="ตารางเรียนของฉัน">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <span>ตารางเรียน</span>
                    </button>
                    <button class="cw-capability-chip" data-query="ผลการเรียนของฉัน">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                        <span>ผลการเรียน</span>
                    </button>
                    <button class="cw-capability-chip" data-query="ค่าเล่าเรียนและทุนการศึกษา">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                        <span>ค่าเล่าเรียน</span>
                    </button>
                    <button class="cw-capability-chip" data-query="ข้อมูลทั่วไปเกี่ยวกับหลักสูตร">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        <span>ข้อมูลทั่วไป</span>
                    </button>
                </div>
            </div>
        `;
        cwMessages.appendChild(welcomeDiv);
        cwMessages.scrollTop = cwMessages.scrollHeight;

        // Make capability chips clickable
        welcomeDiv.querySelectorAll('.cw-capability-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const query = chip.dataset.query;
                cwInput.value = query;
                cwSendBtn.disabled = false;
                handleCwSend();
            });
        });
    }

    cwSendBtn.addEventListener('click', handleCwSend);
    cwInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleCwSend(); } });
    cwInput.addEventListener('input', () => { cwSendBtn.disabled = !cwInput.value.trim() || cwWaiting; });

    async function handleCwSend() {
        const text = cwInput.value.trim();
        if (!text || cwWaiting) return;

        // Save user input for potential recovery on error
        const savedInput = text;

        addCwMsg('user', text);
        cwInput.value = '';
        cwSendBtn.disabled = true;
        cwWaiting = true;

        // ── Show typing indicator with label ──
        const typing = document.createElement('div');
        typing.className = 'cw-typing';
        typing.id = 'cwTyping';
        typing.innerHTML = `
            <div class="cw-typing-dots">
                <span class="cw-typing-dot"></span>
                <span class="cw-typing-dot"></span>
                <span class="cw-typing-dot"></span>
            </div>
            <span class="cw-typing-label">Bot กำลังพิมพ์...</span>
        `;
        cwMessages.appendChild(typing);
        cwMessages.scrollTop = cwMessages.scrollHeight;

        let reply = '';
        let isError = false;

        try {
            const state = getAuthState();
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, student_id: state.user?.username || 'test_123' }),
            });
            if (!res.ok) throw new Error(`Status ${res.status}`);
            const data = await res.json();
            reply = data.reply || data.message || data.response || JSON.stringify(data);
        } catch (err) {
            console.warn('⚠️ Backend unreachable:', err.message);
            isError = true;
            await new Promise(r => setTimeout(r, 800 + Math.random() * 700));

            reply = 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาลองอีกครั้ง';

            // ── Unhappy Path: Restore user input for easy retry ──
            cwInput.value = savedInput;
        }

        // Remove typing indicator
        const t = document.getElementById('cwTyping');
        if (t) t.remove();

        if (isError) {
            addCwErrorMsg(reply);
        } else {
            addCwMsg('bot', reply);
        }

        cwWaiting = false;
        cwSendBtn.disabled = !cwInput.value.trim();
        cwInput.focus();
    }

    /**
     * Add a standard chat message bubble.
     */
    function addCwMsg(role, text) {
        const div = document.createElement('div');
        div.className = `cw-msg ${role}`;
        div.textContent = text;
        cwMessages.appendChild(div);
        cwMessages.scrollTop = cwMessages.scrollHeight;
    }

    /**
     * Add an error message bubble with distinct styling.
     */
    function addCwErrorMsg(text) {
        const div = document.createElement('div');
        div.className = 'cw-msg bot error';
        div.innerHTML = `
            <div class="cw-error-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
            </div>
            <div class="cw-error-text">
                <strong>เกิดข้อผิดพลาด</strong>
                <span>${text}</span>
            </div>
        `;
        cwMessages.appendChild(div);
        cwMessages.scrollTop = cwMessages.scrollHeight;
    }
}
