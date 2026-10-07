package com.bsru.studentportal.controller;

import com.bsru.studentportal.dto.ChatRequest;
import com.bsru.studentportal.dto.ChatResponse;
import com.bsru.studentportal.security.CurrentUser;
import com.bsru.studentportal.service.AdvisorTools;
import com.bsru.studentportal.service.ChatbotService;
import com.bsru.studentportal.service.StudentRecordTools;
import dev.langchain4j.store.memory.chat.ChatMemoryStore;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Slf4j
public class ChatController {

    private final ChatbotService chatbotService;
    private final ChatMemoryStore chatMemoryStore;

    @PostMapping("/chat")
    public ResponseEntity<?> chat(
            @RequestBody ChatRequest request,
            Authentication authentication
    ) {
        if (request.getMessage() == null || request.getMessage().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Message cannot be empty"));
        }

        String userMessage = request.getMessage().trim();
        String sessionId = resolveSessionId(request, authentication);

        log.info("Incoming chat request from sessionId: {}, message: {}", sessionId, userMessage);

        try {
            String aiReply = askWithFreshMemoryOnError(sessionId, userMessage);
            return ResponseEntity.ok(ChatResponse.builder()
                    .reply(aiReply)
                    .sessionId(sessionId)
                    .build());
        } catch (Exception e) {
            log.warn("Gemini API call encountered an issue: {}. Using intelligent assistant fallback...", e.getMessage());
            
            // Intelligent domain-specific response if Gemini API key is demo/offline
            String fallbackReply = generateFallbackResponse(userMessage);
            return ResponseEntity.ok(ChatResponse.builder()
                    .reply(fallbackReply)
                    .sessionId(sessionId)
                    .build());
        }
    }

    /**
     * A failed call or the memory window evicting a user turn can leave a tool call without the
     * turn Gemini expects before it, and then every later message in that session fails with
     * 400 INVALID_ARGUMENT. Clear that session's history and try once more before falling back.
     */
    private String askWithFreshMemoryOnError(String sessionId, String userMessage) {
        try {
            return chatbotService.chat(sessionId, userMessage);
        } catch (Exception e) {
            // Only a broken history is fixed by clearing it; retrying a 429 (quota) or 503 just burns more quota
            if (e.getMessage() == null || !e.getMessage().contains("INVALID_ARGUMENT")) {
                throw e;
            }
            log.warn("Gemini call failed for sessionId {} ({}), retrying with cleared chat history", sessionId, e.getMessage());
            chatMemoryStore.deleteMessages(sessionId);
            return chatbotService.chat(sessionId, userMessage);
        }
    }

    /**
     * Builds the chat memory id. StudentRecordTools trusts the "student:" prefix to decide whose
     * records to read, so it is only ever derived from the verified JWT; guests get a "guest:" id
     * no matter what sessionId they send.
     */
    private String resolveSessionId(ChatRequest request, Authentication authentication) {
        if (!CurrentUser.isLoggedIn(authentication)) {
            String guestId = request.getSessionId() != null ? request.getSessionId() : "guest-session";
            return "guest:" + guestId;
        }
        return CurrentUser.studentId(authentication)
                .map(id -> StudentRecordTools.STUDENT_MEMORY_PREFIX + id)
                .or(() -> CurrentUser.advisorId(authentication).map(id -> AdvisorTools.ADVISOR_MEMORY_PREFIX + id
                        + (CurrentUser.isDemoAdvisor(authentication) ? AdvisorTools.SEES_ALL_SUFFIX : "")))
                .orElse("staff:" + authentication.getName());
    }

    private String generateFallbackResponse(String query) {
        String q = query.toLowerCase();
        if (q.contains("คำร้อง") || q.contains("ยื่นคำร้อง") || q.contains("petition")) {
            return "สำหรับการยื่นคำร้องวิชาการ คุณสามารถไปที่เมนู **'ยื่นคำร้องวิชาการ'** ในแถบเมนูด้านซ้าย เลือกประเภทคำร้อง (เช่น ขอสอบหัวข้อ, ขอเพิ่ม/ถอนวิชา, คำร้องทั่วไป) กรอกรายละเอียด และแนบไฟล์ PDF จากนั้นกดส่งคำร้อง ข้อมูลจะถูกบันทึกลงฐานข้อมูล PostgreSQL และส่งให้อาจารย์/แอดมินพิจารณาครับ";
        } else if (q.contains("เกรด") || q.contains("ผลการเรียน") || q.contains("gpa")) {
            return "คุณสามารถตรวจสอบผลการเรียนรายภาคเรียนและเกรดเฉลี่ยสะสม (GPA) ได้ที่เมนู **'ผลการเรียน'** โดยระบบจะแสดงรายการวิชาที่ผ่าน หน่วยกิตสะสม และกราฟแนวโน้มผลการเรียนครับ";
        } else if (q.contains("ตารางเรียน") || q.contains("ตารางสอบ") || q.contains("schedule")) {
            return "ตารางเรียนและตารางสอบภาคเรียนปัจจุบัน สามารถดูได้ที่เมนู **'ตารางเรียน'** ในรูปแบบ Matrix Grid รายสัปดาห์ พร้อมทั้งสามารถเพิ่ม/ลบรายวิชาได้ครับ";
        } else if (q.contains("อาจารย์") || q.contains("ที่ปรึกษา") || q.contains("advisor")) {
            return "อาจารย์ประจำสาขาวิชาวิทยาการคอมพิวเตอร์ BSRU มีรายนามดังนี้ครับ:\n- ผศ.ดร.วิชัย เทคโนโลยี (หัวหน้าสาขา/อาจารย์ที่ปรึกษา)\n- อ.สุภา โปรแกรม\n- ผศ.มานะ ดาต้า\n- ผศ.ดร.ณัฐ เน็ตเวิร์ค\n- อ.พิมพ์ เว็บเทค\nสามารถดูข้อมูลการติดต่อได้ที่หน้าประวัตินักศึกษาหรือหน้าผู้ดูแลระบบครับ";
        } else if (q.contains("สายอาชีพ") || q.contains("อาชีพ") || q.contains("ทำงาน") || q.contains("บัณฑิต") || q.contains("career") || q.contains("งาน")) {
            return "สาขาวิชาวิทยาการคอมพิวเตอร์ BSRU มีการสำรวจและรวบรวม **สถิติสายอาชีพของบัณฑิต** โดยส่วนใหญ่ประกอบอาชีพตรงสาย (IT & CS) เช่น **Full-Stack Developer**, **Data Analyst**, **DevOps Engineer**, **Cloud Architect**, **UX/UI Designer**, **Cybersecurity** รวมถึง **ธุรกิจส่วนตัว/สตาร์ทอัพ**\n\n📌 สำหรับนักศึกษาที่สำเร็จการศึกษา สามารถกดอัปเดตสายอาชีพและสถานะการทำงานได้ที่เมนู **'ตรวจสอบจบ'** หรือ **'ประวัตินักศึกษา'** เพื่อร่วมเป็นส่วนหนึ่งในการพัฒนาหลักสูตรครับ";
        } else if (q.contains("สวัสดี") || q.contains("hello") || q.contains("hi")) {
            return "สวัสดีครับ! ผมคือ **BSRU CS AI Assistant** ยินดีให้คำแนะนำและตอบคำถามเกี่ยวกับระบบสารสนเทศนักศึกษา การลงทะเบียนเรียน ตารางเรียน ผลการเรียน สถิติสายอาชีพ และการยื่นคำร้องวิชาการครับ มีอะไรให้ผมช่วยเหลือไหมครับ?";
        } else {
            return "ขอบคุณสำหรับคำถามครับ! หากมีข้อสงสัยเกี่ยวกับระบบสารสนเทศนักศึกษา สาขาวิทยาการคอมพิวเตอร์ มหาวิทยาลัยราชภัฏบ้านสมเด็จเจ้าพระยา (BSRU) เช่น การยื่นคำร้องวิชาการ, ตารางเรียน, การตรวจสอบจบ หรือการติดต่ออาจารย์ที่ปรึกษา สามารถสอบถามผมได้ตลอดเวลาเลยนะครับ!";
        }
    }
}
