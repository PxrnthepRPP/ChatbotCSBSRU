import { getAuthState } from '../auth.js';

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

    if (!chatbotFab) return;

    chatbotFab.addEventListener('click', toggleChatbot);
    cwCloseBtn.addEventListener('click', toggleChatbot);

    function toggleChatbot() {
        chatbotOpen = !chatbotOpen;
        chatbotWindow.classList.toggle('open', chatbotOpen);
        chatbotFab.classList.toggle('open', chatbotOpen);
        if (chatbotOpen) {
            fabBadge.classList.add('hidden');
            cwInput.focus();
            if (cwMessages.children.length === 0) addCwMsg('bot', 'สวัสดี! 👋 ฉันคือแชทบอท BSRU CS สอบถามข้อมูลวิชาการได้เลยค่ะ');
        }
    }

    cwSendBtn.addEventListener('click', handleCwSend);
    cwInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleCwSend(); } });
    cwInput.addEventListener('input', () => { cwSendBtn.disabled = !cwInput.value.trim() || cwWaiting; });

    async function handleCwSend() {
        const text = cwInput.value.trim();
        if (!text || cwWaiting) return;
        addCwMsg('user', text);
        cwInput.value = '';
        cwSendBtn.disabled = true;
        cwWaiting = true;

        const typing = document.createElement('div');
        typing.className = 'cw-typing'; typing.id = 'cwTyping';
        typing.innerHTML = '<span class="cw-typing-dot"></span><span class="cw-typing-dot"></span><span class="cw-typing-dot"></span>';
        cwMessages.appendChild(typing);
        cwMessages.scrollTop = cwMessages.scrollHeight;

        let reply = '';
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
            await new Promise(r => setTimeout(r, 800 + Math.random() * 700));
            reply = 'ระบบหน้าบ้านบน XAMPP ทำงานสมบูรณ์แล้ว! แต่ยังไม่ได้เชื่อมต่อกับ Backend Server';
        }

        const t = document.getElementById('cwTyping');
        if (t) t.remove();
        addCwMsg('bot', reply);
        cwWaiting = false;
        cwSendBtn.disabled = !cwInput.value.trim();
        cwInput.focus();
    }

    function addCwMsg(role, text) {
        const div = document.createElement('div');
        div.className = `cw-msg ${role}`;
        div.textContent = text;
        cwMessages.appendChild(div);
        cwMessages.scrollTop = cwMessages.scrollHeight;
    }
}
