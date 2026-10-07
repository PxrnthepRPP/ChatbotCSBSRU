package com.bsru.studentportal.controller;

import com.bsru.studentportal.ai.AdvisorTools;
import com.bsru.studentportal.ai.StudentRecordTools;
import com.bsru.studentportal.dto.ChatRequest;
import com.bsru.studentportal.dto.ChatResponse;
import com.bsru.studentportal.security.CurrentUser;
import com.bsru.studentportal.service.GeminiDirectService;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.store.memory.chat.ChatMemoryStore;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Slf4j
public class ChatController {

    private final GeminiDirectService geminiDirectService;
    private final StudentRecordTools studentRecordTools;
    private final AdvisorTools advisorTools;
    private final ChatMemoryStore chatMemoryStore;

    @Value("${gemini.api.key:demo-api-key}")
    private String geminiApiKey;

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

        // หากยังไม่ได้ใส่ Gemini API Key จริง ให้ตอบด้วยระบบผู้ช่วยจำลองทันที
        if (geminiApiKey == null || geminiApiKey.isBlank() || geminiApiKey.equals("demo-api-key")
                || geminiApiKey.startsWith("your-") || geminiApiKey.length() < 25) {
            log.info("Gemini API key not configured with a valid key. Returning instant assistant fallback.");
            String fallbackReply = generateFallbackResponse(sessionId, userMessage);
            return ResponseEntity.ok(ChatResponse.builder()
                    .reply(fallbackReply)
                    .sessionId(sessionId)
                    .build());
        }

        try {
            String aiReply = askAiWithContext(sessionId, userMessage);
            return ResponseEntity.ok(ChatResponse.builder()
                    .reply(aiReply)
                    .sessionId(sessionId)
                    .build());
        } catch (Exception e) {
            log.error("Gemini API call encountered an issue: ", e);

            String fallbackReply = generateFallbackResponse(sessionId, userMessage);
            return ResponseEntity.ok(ChatResponse.builder()
                    .reply(fallbackReply)
                    .sessionId(sessionId)
                    .build());
        }
    }

    /**
     * ดึงข้อมูลจริงจาก PostgreSQL ตามสิทธิ์ของผู้ใช้ แล้วส่งให้ Gemini ประมวลผลและวิเคราะห์คำตอบ
     */
    private String askAiWithContext(String sessionId, String userMessage) throws Exception {
        String systemPrompt = buildSystemPromptWithDatabaseContext(sessionId, userMessage);

        StringBuilder conversationContext = new StringBuilder();
        try {
            List<ChatMessage> history = chatMemoryStore.getMessages(sessionId);
            if (history != null && !history.isEmpty()) {
                int start = Math.max(0, history.size() - 6);
                for (int i = start; i < history.size(); i++) {
                    ChatMessage cm = history.get(i);
                    if (cm instanceof UserMessage um) {
                        conversationContext.append("ผู้ใช้: ").append(um.singleText()).append("\n");
                    } else if (cm instanceof AiMessage am) {
                        conversationContext.append("AI: ").append(am.text()).append("\n");
                    }
                }
            }
        } catch (Exception ignored) {}

        String fullPrompt = userMessage;
        if (conversationContext.length() > 0) {
            fullPrompt = "[บทสนทนาก่อนหน้านี้]:\n" + conversationContext + "\n[คำถามล่าสุด]:\n" + userMessage;
        }

        String replyText = geminiDirectService.generateContent(systemPrompt, fullPrompt);

        // บันทึกคำถามและคำตอบลงใน Chat Memory
        try {
            List<ChatMessage> currentHistory = chatMemoryStore.getMessages(sessionId);
            List<ChatMessage> updated = new ArrayList<>(currentHistory != null ? currentHistory : List.of());
            updated.add(UserMessage.from(userMessage));
            updated.add(AiMessage.from(replyText));
            chatMemoryStore.updateMessages(sessionId, updated);
        } catch (Exception ignored) {}

        return replyText;
    }

    private String buildSystemPromptWithDatabaseContext(String sessionId, String userMessage) {
        StringBuilder sb = new StringBuilder();
        sb.append("""
            คุณคือ "BSRU CS AI Assistant" ผู้ช่วยอัจฉริยะประจำสาขาวิชาวิทยาการคอมพิวเตอร์ มหาวิทยาลัยราชภัฏบ้านสมเด็จเจ้าพระยา (BSRU).
            
            หน้าที่และบทบาทของคุณ:
            1. ให้คำปรึกษา แนะนำข้อมูลวิชาการ ผลการเรียน การวิเคราะห์เกรด ตารางเรียน และกิจกรรมอย่างสุภาพ ชัดเจน และถูกต้องตามข้อมูลจริง
            2. ตอบคำถามด้วยภาษาไทยที่สุภาพ มีหางเสียง (ครับ/ค่ะ) จัดรูปแบบให้อ่านง่าย เช่น ใช้ Bullet points, Markdown, ตาราง เมื่อเหมาะสม
            3. ข้อมูลในส่วน [ข้อมูลจริงจากฐานข้อมูลระบบ] เป็นข้อมูลจริงปัจจุบันที่ดึงจากฐานข้อมูล PostgreSQL ให้ใช้ข้อมูลนี้เป็นหลักในการตอบคำถามและวิเคราะห์ ห้ามแต่งตัวเลขหรือข้อมูลเอง
            4. เมื่อวิเคราะห์ผลการเรียน ให้สรุปให้เข้าใจง่าย เช่น วิชาที่ทำได้ดี วิชาที่ควรพัฒนา แนวโน้ม GPA และสิ่งที่ยังขาดเพื่อสำเร็จการศึกษา
            5. หากนักศึกษาถามเรื่องการคำนวณ GPA ล่วงหน้า ให้แสดงวิธีคำนวณอย่างเป็นขั้นตอนตามเกณฑ์จริง (แต้มรวมเดิม + แต้มเทอมใหม่ หารด้วยหน่วยกิตรวม)
            6. หากผู้ใช้เป็นอาจารย์ที่ปรึกษา ให้ช่วยวิเคราะห์ความเสี่ยงของนักศึกษาในความดูแล (พ้นสภาพ/ตก/ถอนวิชา/จบช้า) เรียงจากเสี่ยงมากไปน้อย พร้อมข้อเสนอแนะเชิงช่วยเหลือ
            7. วิชาที่เกรดเป็น "ยังไม่ออกผล" ไม่นำมาคิด GPA
            """);

        String q = userMessage.toLowerCase();
        if (sessionId.startsWith(StudentRecordTools.STUDENT_MEMORY_PREFIX)) {
            sb.append("\n[ข้อมูลจริงจากฐานข้อมูลระบบสำหรับนักศึกษาคนนี้]:\n");
            try {
                String profile = studentRecordTools.getMyProfile(sessionId);
                if (profile != null && !profile.isBlank()) {
                    sb.append("--- ข้อมูลประวัตินักศึกษา ---\n").append(profile).append("\n");
                }
            } catch (Exception ignored) {}

            try {
                String grades = studentRecordTools.getMyGrades(sessionId);
                if (grades != null && !grades.isBlank()) {
                    sb.append("--- ข้อมูลผลการเรียนทุกภาคเรียน ---\n").append(grades).append("\n");
                }
            } catch (Exception ignored) {}

            if (q.contains("จบ") || q.contains("ขาด") || q.contains("หน่วยกิต") || q.contains("หมวด") || q.contains("audit") || q.contains("กิจกรรม")) {
                try {
                    String audit = studentRecordTools.getMyGraduationProgress(sessionId);
                    if (audit != null && !audit.isBlank()) {
                        sb.append("--- ข้อมูลการตรวจสอบจบและโครงสร้างหลักสูตร ---\n").append(audit).append("\n");
                    }
                } catch (Exception ignored) {}
            }

            if (q.contains("ตาราง") || q.contains("เรียน") || q.contains("วัน") || q.contains("เวลา") || q.contains("ห้อง") || q.contains("ลงทะเบียน") || q.contains("ชน")) {
                try {
                    String timetable = studentRecordTools.getMyTimetable(sessionId);
                    if (timetable != null && !timetable.isBlank()) {
                        sb.append("--- ข้อมูลตารางเรียนและการลงทะเบียน ---\n").append(timetable).append("\n");
                    }
                } catch (Exception ignored) {}
            }

            if (q.contains("คำร้อง") || q.contains("petition") || q.contains("ยื่น")) {
                try {
                    String petitions = studentRecordTools.getMyPetitions(sessionId);
                    if (petitions != null && !petitions.isBlank()) {
                        sb.append("--- ข้อมูลคำร้องวิชาการ ---\n").append(petitions).append("\n");
                    }
                } catch (Exception ignored) {}
            }
        } else if (sessionId.startsWith(AdvisorTools.ADVISOR_MEMORY_PREFIX)) {
            sb.append("\n[ข้อมูลจริงจากฐานข้อมูลระบบสำหรับอาจารย์ที่ปรึกษา]:\n");
            try {
                String risks = advisorTools.getMyAdviseesRiskOverview(sessionId);
                if (risks != null && !risks.isBlank()) {
                    sb.append("--- ข้อมูลภาพรวมความเสี่ยงของนักศึกษาในความดูแล ---\n").append(risks).append("\n");
                }
            } catch (Exception ignored) {}

            Matcher m = Pattern.compile("\\b(\\d{10})\\b").matcher(userMessage);
            if (m.find()) {
                String targetStudentId = m.group(1);
                try {
                    String detail = advisorTools.getAdviseeRecord(sessionId, targetStudentId);
                    if (detail != null && !detail.isBlank()) {
                        sb.append("--- ข้อมูลเฉพาะของนักศึกษารหัส ").append(targetStudentId).append(" ---\n")
                          .append(detail).append("\n");
                    }
                } catch (Exception ignored) {}
            }
        }

        return sb.toString();
    }

    private String resolveSessionId(ChatRequest request, Authentication authentication) {
        if (!CurrentUser.isLoggedIn(authentication)) {
            String guestId = request.getSessionId() != null ? request.getSessionId() : "guest-session";
            return "guest:" + guestId;
        }
        return CurrentUser.studentId(authentication)
                .map(id -> StudentRecordTools.STUDENT_MEMORY_PREFIX + id)
                .or(() -> CurrentUser.advisorId(authentication).map(id -> AdvisorTools.ADVISOR_MEMORY_PREFIX + id))
                .orElse("staff:" + authentication.getName());
    }

    private String generateFallbackResponse(String sessionId, String query) {
        String q = query.toLowerCase();

        // หากเป็นนักศึกษาและถามเรื่องเกรด ให้ดึงข้อมูลจริงจากฐานข้อมูลตอบทันที
        if (sessionId.startsWith(StudentRecordTools.STUDENT_MEMORY_PREFIX)
                && (q.contains("เกรด") || q.contains("ผลการเรียน") || q.contains("gpa"))) {
            try {
                String profile = studentRecordTools.getMyProfile(sessionId);
                String grades = studentRecordTools.getMyGrades(sessionId);
                if (grades != null && !grades.isBlank()) {
                    return "ผลการเรียนของคุณที่บันทึกในฐานข้อมูลระบบมีดังนี้ครับ:\n\n" + profile + "\n\n" + grades;
                }
            } catch (Exception ignored) {}
        }

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
