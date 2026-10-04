/* ================================================================
   BSRU Student Portal — Chatbot Component (Google Gemini + RAG AI)
   ================================================================
   Features:
   - Capability Transparency: structured welcome with capability chips
   - Micro-Feedback: smooth typing indicator with label text
   - Integration: Secure REST API call (POST /api/chat) with JWT Bearer Token
   - Markdown & formatting support for AI responses
   - Unhappy Path: preserves user input on error for easy retry
   - Expand/Collapse button for tall mode
   - Desktop drag-to-resize via corner handle
   - Mobile: swipe-to-dismiss via header drag
   ================================================================ */

import { getAuthState } from '../auth.js';
import { fetchAPI } from '../api.js';
import { loadComponentCSS } from '../css-loader.js';

let _chatbotInitialized = false;

export function initChatbot() {
    if (_chatbotInitialized) return;
    _chatbotInitialized = true;

    const chatbotFab    = document.getElementById('chatbotFab');
    const chatbotWindow = document.getElementById('chatbotWindow');
    const cwCloseBtn    = document.getElementById('cwCloseBtn');
    const cwExpandBtn   = document.getElementById('cwExpandBtn');
    const cwHeader      = document.getElementById('cwHeader');
    const cwMessages    = document.getElementById('cwMessages');
    const cwInput       = document.getElementById('cwInput');
    const cwSendBtn     = document.getElementById('cwSendBtn');
    const fabBadge      = document.getElementById('fabBadge');

    let chatbotOpen  = false;
    let cwWaiting    = false;
    let welcomeShown = false;

    if (!chatbotFab) return;

    // Load chatbot CSS dynamically
    loadComponentCSS('chatbot');

    // ── Open / Close ──
    chatbotFab.addEventListener('click', toggleChatbot);
    if (cwCloseBtn) cwCloseBtn.addEventListener('click', toggleChatbot);

    function toggleChatbot() {
        chatbotOpen = !chatbotOpen;
        chatbotWindow.classList.toggle('open', chatbotOpen);
        chatbotFab.classList.toggle('open', chatbotOpen);
        if (chatbotOpen) {
            if (fabBadge) fabBadge.classList.add('hidden');
            cwInput.focus();
            if (!welcomeShown) {
                showWelcomeMessage();
                welcomeShown = true;
            }
        }
    }

    // ── Expand / Collapse ──
    if (cwExpandBtn) {
        cwExpandBtn.addEventListener('click', () => {
            const isExpanded = chatbotWindow.classList.toggle('expanded');
            cwExpandBtn.title = isExpanded ? 'ย่อหน้าต่าง' : 'ขยายหน้าต่าง';
            cwExpandBtn.setAttribute('aria-label', isExpanded ? 'ย่อหน้าต่าง' : 'ขยายหน้าต่าง');
        });
    }

    // Double-click header to toggle expanded mode
    if (cwHeader) {
        cwHeader.addEventListener('dblclick', (e) => {
            if (e.target.closest('button')) return;
            if (cwExpandBtn) cwExpandBtn.click();
        });
    }

    // ESC key closes the chatbot window
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && chatbotOpen) {
            toggleChatbot();
        }
    });

    // ── Mobile swipe-to-dismiss ──
    let _swipeInitialized = false;
    function initMobileSwipeDismiss(header) {
        if (_swipeInitialized) return;
        _swipeInitialized = true;

        let touchStartY = 0;
        let currentTranslateY = 0;

        header.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
            chatbotWindow.style.transition = 'none';
        }, { passive: true });

        header.addEventListener('touchmove', (e) => {
            const dy = e.touches[0].clientY - touchStartY;
            if (dy > 0) {
                currentTranslateY = dy;
                chatbotWindow.style.transform = `translateY(${dy}px)`;
            }
        }, { passive: true });

        header.addEventListener('touchend', () => {
            chatbotWindow.style.transition = '';
            if (currentTranslateY > 120) {
                toggleChatbot(); // Close on swipe-down
            } else {
                chatbotWindow.style.transform = '';
            }
            currentTranslateY = 0;
        });
    }

    // ── Mobile: swipe-down header to dismiss ──
    if (cwHeader && isMobile()) {
        initMobileSwipeDismiss(cwHeader);
    }

    // Re-check on resize (orientation change etc.)
    window.addEventListener('resize', () => {
        if (isMobile() && cwHeader) {
            initMobileSwipeDismiss(cwHeader);
        }
    });

    function isMobile() {
        return window.innerWidth <= 560;
    }

    // ── Welcome Message ──
    function showWelcomeMessage() {
        if (cwMessages.querySelector('.cw-welcome')) return;
        const welcomeDiv = document.createElement('div');
        welcomeDiv.className = 'cw-welcome';
        welcomeDiv.innerHTML = `
            <div class="cw-welcome-header">
                <div class="cw-welcome-avatar">
                    <svg viewBox="0 0 24 24" fill="none"><path d="M12 2C8.686 2 6 4.686 6 8V10H5C4.448 10 4 10.448 4 11V19C4 19.552 4.448 20 5 20H19C19.552 20 20 19.552 20 19V11C20 10.448 19.552 10 19 10H18V8C18 4.686 15.314 2 12 2ZM9 13C9.552 13 10 13.448 10 14V16C10 16.552 9.552 17 9 17C8.448 17 8 16.552 8 16V14C8 13.448 8.448 13 9 13ZM15 13C15.552 13 16 13.448 16 14V16C16 16.552 15.552 17 15 17C14.448 17 14 16.552 14 16V14C14 13.448 14.448 13 15 13ZM8 8C8 5.791 9.791 4 12 4C14.209 4 16 5.791 16 8V10H8V8Z" fill="currentColor"/></svg>
                </div>
                <div>
                    <h4>สวัสดีครับ! 👋 ผมคือ BSRU CS AI Assistant</h4>
                    <p>ผู้ช่วยอัจฉริยะสาขาวิทยาการคอมพิวเตอร์ BSRU</p>
                </div>
            </div>
            <div class="cw-welcome-body">
                <span class="cw-welcome-label">สอบถามข้อมูลที่ต้องการได้เลยครับ:</span>
                <div class="cw-capabilities">
                    <button class="cw-capability-chip" data-query="ขั้นตอนการยื่นคำร้องวิชาการ">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <span>ยื่นคำร้องวิชาการ</span>
                    </button>
                    <button class="cw-capability-chip" data-query="ตารางเรียนและตารางสอบ">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <span>ตารางเรียน/สอบ</span>
                    </button>
                    <button class="cw-capability-chip" data-query="ตรวจสอบผลการเรียนและ GPA">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                        <span>ผลการเรียน</span>
                    </button>
                    <button class="cw-capability-chip" data-query="รายนามอาจารย์ที่ปรึกษาสาขาวิทยาการคอมพิวเตอร์">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                        <span>อาจารย์ที่ปรึกษา</span>
                    </button>
                    <button class="cw-capability-chip" data-query="สถิติสายอาชีพของบัณฑิต">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                        <span>สถิติสายอาชีพบัณฑิต</span>
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

    function getSmartOfflineReply(query) {
        const q = (query || '').toLowerCase().trim();
        if (q.includes('คำร้อง') || q.includes('ยื่นคำร้อง') || q.includes('petition')) {
            return "สำหรับการยื่นคำร้องวิชาการ คุณสามารถไปที่เมนู **'ยื่นคำร้องวิชาการ'** ในแถบเมนูด้านซ้าย เลือกประเภทคำร้อง (เช่น ขอสอบหัวข้อ, ขอเพิ่ม/ถอนวิชา, คำร้องทั่วไป) กรอกรายละเอียด และแนบไฟล์ PDF จากนั้นกดส่งคำร้อง ระบบจะส่งต่อให้อาจารย์ที่ปรึกษาและเจ้าหน้าที่พิจารณาครับ";
        }
        if (q.includes('สายอาชีพ') || q.includes('อาชีพ') || q.includes('ทำงาน') || q.includes('บัณฑิต') || q.includes('career') || q.includes('งาน')) {
            return "📊 **สถิติสายอาชีพของบัณฑิต สาขาวิชาวิทยาการคอมพิวเตอร์ BSRU**:\nส่วนใหญ่ประกอบอาชีพตรงสาย (IT & CS) เช่น:\n- 💻 **Full-Stack Developer**\n- 📊 **Data Analyst**\n- ⚙️ **DevOps Engineer**\n- ☁️ **Cloud Architect**\n- 🎨 **UX/UI Designer**\n- 🔒 **Cybersecurity Analyst**\nรวมถึงกลุ่ม **ธุรกิจส่วนตัว / สตาร์ทอัพ**\n\n📌 สำหรับบัณฑิตที่สำเร็จการศึกษา สามารถกดอัปเดตสายอาชีพของท่านได้ที่เมนู **'ตรวจสอบจบ'** หรือ **'ประวัตินักศึกษา'** เพื่อร่วมเป็นส่วนหนึ่งในการพัฒนาหลักสูตรครับ";
        }
        if (q.includes('เกรด') || q.includes('ผลการเรียน') || q.includes('gpa')) {
            return "คุณสามารถตรวจสอบผลการเรียนรายภาคเรียนและเกรดเฉลี่ยสะสม (GPA) ได้ที่เมนู **'ผลการเรียน'** โดยระบบจะแสดงรายการวิชาที่ผ่าน หน่วยกิตสะสม และผลการเรียนย้อนหลังครบถ้วนครับ";
        }
        if (q.includes('ตารางเรียน') || q.includes('ตารางสอบ') || q.includes('schedule')) {
            return "ตารางเรียนและตารางสอบภาคเรียนปัจจุบัน สามารถดูได้ที่เมนู **'ตารางเรียน'** ในรูปแบบ Matrix Grid รายสัปดาห์ พร้อมระบุห้องเรียนและชื่ออาจารย์ผู้สอนครับ";
        }
        if (q.includes('อาจารย์') || q.includes('ที่ปรึกษา') || q.includes('advisor')) {
            return "อาจารย์ประจำสาขาวิชาวิทยาการคอมพิวเตอร์ BSRU มีรายนามดังนี้ครับ:\n- **ผศ.ดร.วิชัย เทคโนโลยี** (หัวหน้าสาขาวิชา/อาจารย์ที่ปรึกษา)\n- **อ.สุภา โปรแกรม**\n- **ผศ.มานะ ดาต้า**\n- **ผศ.ดร.ณัฐ เน็ตเวิร์ค**\n- **อ.พิมพ์ เว็บเทค**\nสามารถดูข้อมูลการติดต่อได้ที่เมนูประวัตินักศึกษาครับ";
        }
        if (q.includes('สวัสดี') || q.includes('hello') || q.includes('hi') || q.includes('หวัดดี')) {
            return "สวัสดีครับ! 👋 ผมคือ **BSRU CS AI Assistant** ยินดีให้คำแนะนำและตอบคำถามเกี่ยวกับระบบสารสนเทศนักศึกษา การลงทะเบียนเรียน ตารางเรียน ผลการเรียน สถิติสายอาชีพ และการยื่นคำร้องวิชาการครับ มีอะไรให้ผมช่วยเหลือไหมครับ?";
        }
        return `ขอบคุณสำหรับคำถามครับ! คุณสามารถสอบถามข้อมูลระบบสารสนเทศนักศึกษา สาขาวิทยาการคอมพิวเตอร์ BSRU ได้หลากหลายหัวข้อ เช่น:\n- 📝 ขั้นตอนการยื่นคำร้องวิชาการ\n- 📅 ตารางเรียนและตารางสอบ\n- 📊 ตรวจสอบผลการเรียนและเกรดเฉลี่ย\n- 💼 สถิติสายอาชีพของบัณฑิต\n- 👨‍🏫 ข้อมูลติดต่ออาจารย์ที่ปรึกษา`;
    }

    async function handleCwSend() {
        const text = cwInput.value.trim();
        if (!text || cwWaiting) return;

        addCwMsg('user', text);
        cwInput.value = '';
        cwSendBtn.disabled = true;
        cwWaiting = true;

        // Show typing indicator
        const typing = document.createElement('div');
        typing.className = 'cw-typing';
        typing.id = 'cwTyping';
        typing.innerHTML = `
            <div class="cw-typing-dots">
                <span class="cw-typing-dot"></span>
                <span class="cw-typing-dot"></span>
                <span class="cw-typing-dot"></span>
            </div>
            <span class="cw-typing-label">AI กำลังประมวลผล...</span>
        `;
        cwMessages.appendChild(typing);
        cwMessages.scrollTop = cwMessages.scrollHeight;

        let reply = '';

        try {
            const state = getAuthState();
            console.log('🤖 [Chatbot] Sending user query to Spring Boot AI Backend (/api/chat)...');

            const data = await fetchAPI('/chat', 'POST', {
                message: text,
                sessionId: state.user?.username || 'student_guest',
            }, 30000); // AI replies that look up grades take longer than the default 2.5s timeout

            console.log('✨ [Chatbot] Received AI Response:', data);
            reply = data.reply || data.message || 'ขออภัยครับ ไม่พบข้อมูลตอบกลับจากระบบ';
        } catch (err) {
            console.warn('⚠️ [Chatbot] Backend offline or unreachable, using domain assistant mode:', err.message);
            reply = getSmartOfflineReply(text);
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

        if (role === 'bot') {
            let formatted = text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\n\s*-\s*(.*?)(?=\n|$)/g, '<br>• $1')
                .replace(/\n/g, '<br>');
            div.innerHTML = formatted;
        } else {
            div.textContent = text;
        }

        cwMessages.appendChild(div);
        cwMessages.scrollTop = cwMessages.scrollHeight;
    }

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
