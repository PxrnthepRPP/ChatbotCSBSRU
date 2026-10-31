package com.bsru.studentportal.controller;

import com.bsru.studentportal.ai.AdvisorTools;
import com.bsru.studentportal.ai.StudentRecordTools;
import com.bsru.studentportal.dto.ChatRequest;
import com.bsru.studentportal.dto.ChatResponse;
import com.bsru.studentportal.dto.FormAttachmentDto;
import com.bsru.studentportal.model.ChatHistoryEntry;
import com.bsru.studentportal.repository.ChatHistoryRepository;
import com.bsru.studentportal.security.CurrentUser;
import com.bsru.studentportal.service.AcademicFormCatalogService;
import com.bsru.studentportal.service.AcademicFormCatalogService.AcademicFormInfo;
import com.bsru.studentportal.service.GeminiDirectService;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.rag.content.Content;
import dev.langchain4j.rag.content.retriever.ContentRetriever;
import dev.langchain4j.rag.query.Query;
import dev.langchain4j.store.memory.chat.ChatMemoryStore;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
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
    private final ContentRetriever contentRetriever;
    private final ChatHistoryRepository chatHistoryRepository;
    private final AcademicFormCatalogService academicFormCatalogService;

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final AcademicFormCatalogService DEFAULT_FORM_CATALOG = new AcademicFormCatalogService();

    private AcademicFormCatalogService formCatalog() {
        return academicFormCatalogService != null ? academicFormCatalogService : DEFAULT_FORM_CATALOG;
    }

    private static final String BSRU_ACTIVITY_CRITERIA_TEXT = """
            เกณฑ์การผ่านกิจกรรมนักศึกษา มหาวิทยาลัยราชภัฏบ้านสมเด็จเจ้าพระยา (รวม 17 ประเภท ขั้นต่ำรวม 37 ครั้ง):
            1. ปฐมนิเทศรวม (อย่างน้อย 1 ครั้ง)
            2. วันพิราลัย (อย่างน้อย 1 ครั้ง)
            3. วันสถาปนา ราชภัฏ (อย่างน้อย 1 ครั้ง)
            4. จิตสาธารณะ (อย่างน้อย 2 ครั้ง)
            5. ชมรม/ชุมนุม (อย่างน้อย 3 ครั้ง)
            6. กิจกรรมเลือก (มหาวิทยาลัย) (อย่างน้อย 10 ครั้ง)
            7. อบรมทักษะชีวิต ชั้นปี 2 (อย่างน้อย 1 ครั้ง)
            8. อบรมคุณธรรมจริยธรรม (อย่างน้อย 1 ครั้ง)
            9. อบรมทักษะชีวิต ชั้นปี 3 (อย่างน้อย 1 ครั้ง)
            10. พัฒนาทักษะดิจิทัลเพื่อรองรับการทำงาน (อย่างน้อย 1 ครั้ง)
            11. กิจกรรมบังคับ (คณะ) (อย่างน้อย 5 ครั้ง)
            12. ปฐมนิเทศคณะ (อย่างน้อย 1 ครั้ง)
            13. ศึกษาแหล่งเรียนรู้กรุงธนบุรีศึกษา (อย่างน้อย 1 ครั้ง)
            14. ปัจฉิมนิเทศ (อย่างน้อย 1 ครั้ง)
            15. ทักษะดิจิทัลสำหรับนักศึกษาใหม่ (อย่างน้อย 1 ครั้ง)
            16. ทักษะดิจิทัลสำหรับนักศึกษาชั้นปีสุดท้าย (อย่างน้อย 1 ครั้ง)
            17. กิจกรรมเลือก (คณะ) (อย่างน้อย 5 ครั้ง)
            สามารถตรวจสอบสถานะรายหมวดและประวัติการเข้าร่วมได้ที่เมนู 'กิจกรรม' ในระบบสารสนเทศนักศึกษาครับ""";

    @Value("${gemini.api.key:demo-api-key}")
    private String geminiApiKey;

    private record RagRetrieval(String contextText, List<String> sources) {
        public static RagRetrieval empty() {
            return new RagRetrieval("", List.of());
        }
    }

    @PostMapping("/chat")
    public ResponseEntity<?> chat(
            @RequestBody ChatRequest request,
            Authentication authentication
    ) {
        if (request.getMessage() == null || request.getMessage().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Message cannot be empty"));
        }

        String userMessage = request.getMessage().trim();
        String resolvedSessionId = resolveSessionId(request, authentication);
        String rawSessionId = (request.getSessionId() != null && !request.getSessionId().isBlank())
                ? request.getSessionId().trim()
                : null;
        String entrySessionId = rawSessionId != null ? rawSessionId : resolvedSessionId;

        log.info("Incoming chat request from sessionId: {} (entrySessionId: {}), message: {}", resolvedSessionId, entrySessionId, userMessage);

        // 1. Persist user message to PostgreSQL
        saveChatHistoryEntry(entrySessionId, resolvedSessionId, "USER", userMessage, null);

        RagRetrieval rag = retrieveRelevantKnowledge(userMessage);
        List<AcademicFormInfo> matchedForms = formCatalog().findMatchingForms(userMessage);
        List<FormAttachmentDto> attachments = matchedForms.stream()
                .map(AcademicFormInfo::toAttachmentDto)
                .toList();

        // หากยังไม่ได้ใส่ Gemini API Key จริง ให้ตอบด้วยระบบผู้ช่วยจำลองทันที
        if (geminiApiKey == null || geminiApiKey.isBlank() || geminiApiKey.equals("demo-api-key")
                || geminiApiKey.startsWith("your-") || geminiApiKey.length() < 25) {
            log.info("Gemini API key not configured with a valid key. Returning instant assistant fallback.");
            String fallbackReply = generateFallbackResponse(resolvedSessionId, userMessage, rag, matchedForms);

            // Persist fallback reply and update memory
            saveChatHistoryEntry(entrySessionId, resolvedSessionId, "BOT", fallbackReply, rag.sources());
            updateMemoryStore(entrySessionId, resolvedSessionId, userMessage, fallbackReply);

            return ResponseEntity.ok(ChatResponse.builder()
                    .reply(fallbackReply)
                    .sessionId(resolvedSessionId)
                    .sources(rag.sources())
                    .attachments(attachments)
                    .build());
        }

        try {
            String aiReply = askAiWithContext(entrySessionId, resolvedSessionId, userMessage, rag, matchedForms);

            // Persist AI reply and update memory
            saveChatHistoryEntry(entrySessionId, resolvedSessionId, "BOT", aiReply, rag.sources());
            updateMemoryStore(entrySessionId, resolvedSessionId, userMessage, aiReply);

            return ResponseEntity.ok(ChatResponse.builder()
                    .reply(aiReply)
                    .sessionId(resolvedSessionId)
                    .sources(rag.sources())
                    .attachments(attachments)
                    .build());
        } catch (Exception e) {
            log.error("Gemini API call encountered an issue: ", e);

            String fallbackReply = generateFallbackResponse(resolvedSessionId, userMessage, rag, matchedForms);

            // Persist fallback reply and update memory
            saveChatHistoryEntry(entrySessionId, resolvedSessionId, "BOT", fallbackReply, rag.sources());
            updateMemoryStore(entrySessionId, resolvedSessionId, userMessage, fallbackReply);

            return ResponseEntity.ok(ChatResponse.builder()
                    .reply(fallbackReply)
                    .sessionId(resolvedSessionId)
                    .sources(rag.sources())
                    .attachments(attachments)
                    .build());
        }
    }

    @GetMapping("/chat/history")
    public ResponseEntity<?> getChatHistory(
            @RequestParam(required = false) String sessionId,
            @RequestParam(required = false) String userKey,
            Authentication authentication
    ) {
        String target = (sessionId != null && !sessionId.isBlank())
                ? sessionId.trim()
                : ((userKey != null && !userKey.isBlank()) ? userKey.trim() : resolveSessionId(null, authentication));

        if (chatHistoryRepository == null) {
            return ResponseEntity.ok(List.of());
        }

        List<ChatHistoryEntry> history = chatHistoryRepository.findBySessionIdOrUserKeyOrderByTimestampAsc(target);
        if (history.isEmpty() && CurrentUser.isLoggedIn(authentication)) {
            String authKey = resolveSessionId(null, authentication);
            history = chatHistoryRepository.findBySessionIdOrUserKeyOrderByTimestampAsc(authKey);
        }

        return ResponseEntity.ok(history);
    }

    @DeleteMapping("/chat/history")
    public ResponseEntity<?> clearChatHistory(
            @RequestParam(required = false) String sessionId,
            @RequestParam(required = false) String userKey,
            Authentication authentication
    ) {
        String targetSession = (sessionId != null && !sessionId.isBlank()) ? sessionId.trim() : null;
        String targetUserKey = (userKey != null && !userKey.isBlank()) ? userKey.trim() : null;
        String authSessionId = resolveSessionId(null, authentication);

        int deletedRows = 0;
        if (chatHistoryRepository != null) {
            if (targetSession != null) {
                deletedRows += chatHistoryRepository.deleteBySessionIdOrUserKey(targetSession);
            }
            if (targetUserKey != null) {
                deletedRows += chatHistoryRepository.deleteBySessionIdOrUserKey(targetUserKey);
            }
            if (targetSession == null && targetUserKey == null) {
                deletedRows += chatHistoryRepository.deleteBySessionIdOrUserKey(authSessionId);
            }
        }

        if (chatMemoryStore != null) {
            if (targetSession != null) {
                try { chatMemoryStore.deleteMessages(targetSession); } catch (Exception ignored) {}
            }
            if (targetUserKey != null) {
                try { chatMemoryStore.deleteMessages(targetUserKey); } catch (Exception ignored) {}
            }
            if (targetSession == null && targetUserKey == null) {
                try { chatMemoryStore.deleteMessages(authSessionId); } catch (Exception ignored) {}
            }
        }

        return ResponseEntity.ok(Map.of(
                "message", "Chat history and memory cleared successfully",
                "deletedEntries", deletedRows,
                "status", "cleared"
        ));
    }

    private void saveChatHistoryEntry(String sessionId, String userKey, String sender, String message, List<String> sources) {
        if (chatHistoryRepository == null) return;
        try {
            chatHistoryRepository.save(ChatHistoryEntry.builder()
                    .sessionId(sessionId)
                    .userKey(userKey)
                    .sender(sender)
                    .message(message)
                    .sources(serializeSources(sources))
                    .timestamp(LocalDateTime.now())
                    .build());
        } catch (Exception e) {
            log.warn("Failed to persist chat history entry ({}: {}): {}", sender, sessionId, e.getMessage());
        }
    }

    private void updateMemoryStore(String sessionId, String userKey, String userMessage, String botReply) {
        if (chatMemoryStore == null) return;
        try {
            List<ChatMessage> currentHistory = chatMemoryStore.getMessages(sessionId);
            List<ChatMessage> updated = new ArrayList<>(currentHistory != null ? currentHistory : List.of());
            updated.add(UserMessage.from(userMessage));
            updated.add(AiMessage.from(botReply));
            chatMemoryStore.updateMessages(sessionId, updated);

            if (userKey != null && !userKey.equals(sessionId) && !"guest".equals(userKey)) {
                List<ChatMessage> userHistory = chatMemoryStore.getMessages(userKey);
                List<ChatMessage> userUpdated = new ArrayList<>(userHistory != null ? userHistory : List.of());
                userUpdated.add(UserMessage.from(userMessage));
                userUpdated.add(AiMessage.from(botReply));
                chatMemoryStore.updateMessages(userKey, userUpdated);
            }
        } catch (Exception e) {
            log.warn("Failed to update chat memory store: {}", e.getMessage());
        }
    }

    private String serializeSources(List<String> sources) {
        if (sources == null || sources.isEmpty()) return null;
        try {
            return OBJECT_MAPPER.writeValueAsString(sources);
        } catch (Exception e) {
            return String.join(", ", sources);
        }
    }

    /**
     * ดึงเอกสารความรู้ที่เกี่ยวข้องจาก PGVector (ตาราง bsru_embeddings)
     */
    private RagRetrieval retrieveRelevantKnowledge(String queryText) {
        if (contentRetriever == null || queryText == null || queryText.isBlank()) {
            return RagRetrieval.empty();
        }

        try {
            List<Content> contents = contentRetriever.retrieve(Query.from(queryText));
            if (contents == null || contents.isEmpty()) {
                return RagRetrieval.empty();
            }

            StringBuilder sb = new StringBuilder();
            List<String> sources = new ArrayList<>();

            for (Content content : contents) {
                if (content == null) continue;
                TextSegment segment = content.textSegment();
                if (segment != null) {
                    String text = segment.text();
                    if (text != null && !text.isBlank()) {
                        sb.append("- ").append(text.trim()).append("\n");
                    }
                    String source = segment.metadata() != null ? segment.metadata().getString("source") : null;
                    if (source != null && !source.isBlank() && !sources.contains(source)) {
                        sources.add(source);
                    }
                }
            }

            return new RagRetrieval(sb.toString().trim(), sources);
        } catch (Exception e) {
            log.warn("Vector similarity search via ContentRetriever failed or offline: {}", e.getMessage());
            return RagRetrieval.empty();
        }
    }

    /**
     * ดึงข้อมูลจริงจาก PostgreSQL ตามสิทธิ์ของผู้ใช้ แล้วส่งให้ Gemini ประมวลผลและวิเคราะห์คำตอบ
     */
    private String askAiWithContext(String entrySessionId, String resolvedSessionId, String userMessage,
                                    RagRetrieval rag, List<AcademicFormInfo> matchedForms) throws Exception {
        String systemPrompt = buildSystemPromptWithDatabaseContext(resolvedSessionId, userMessage, rag, matchedForms);

        StringBuilder conversationContext = new StringBuilder();
        try {
            if (chatMemoryStore != null) {
                List<ChatMessage> history = chatMemoryStore.getMessages(entrySessionId);
                if ((history == null || history.isEmpty()) && !entrySessionId.equals(resolvedSessionId)) {
                    history = chatMemoryStore.getMessages(resolvedSessionId);
                }
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
            }
        } catch (Exception ignored) {}

        String fullPrompt = userMessage;
        if (conversationContext.length() > 0) {
            fullPrompt = "[บทสนทนาก่อนหน้านี้]:\n" + conversationContext + "\n[คำถามล่าสุด]:\n" + userMessage;
        }

        return geminiDirectService.generateContent(systemPrompt, fullPrompt);
    }

    private String buildSystemPromptWithDatabaseContext(String contextSessionId, String userMessage,
                                                        RagRetrieval rag, List<AcademicFormInfo> matchedForms) {
        StringBuilder sb = new StringBuilder();
        sb.append("""
            คุณคือ "BSRU CS AI Assistant" ผู้ช่วยอัจฉริยะประจำสาขาวิชาวิทยาการคอมพิวเตอร์ มหาวิทยาลัยราชภัฏบ้านสมเด็จเจ้าพระยา (BSRU).
            
            หน้าที่และบทบาทของคุณ:
            1. ให้คำปรึกษา แนะนำข้อมูลวิชาการ ผลการเรียน การวิเคราะห์เกรด ตารางเรียน กิจกรรม และเอกสารคำร้อง (ทบ.) อย่างสุภาพ ชัดเจน และถูกต้องตามข้อมูลจริง
            2. ตอบคำถามด้วยภาษาไทยที่สุภาพ มีหางเสียง (ครับ/ค่ะ) จัดรูปแบบให้อ่านง่าย เช่น ใช้ Bullet points, Markdown, ตาราง เมื่อเหมาะสม
            3. ข้อมูลในส่วน [ข้อมูลจริงจากฐานข้อมูลระบบ], [เอกสารอ้างอิงจากคลังความรู้สาขา (RAG)] และ [คลังเอกสารคำร้องและแบบฟอร์มทางการ มบส.] เป็นข้อมูลจริงปัจจุบัน ให้ใช้ข้อมูลนี้เป็นหลักในการตอบคำถามและวิเคราะห์ ห้ามแต่งตัวเลขหรือข้อมูลเอง หากคำถามเกี่ยวข้องกับเอกสารอ้างอิงหรือใบคำร้อง ให้ตอบโดยอิงตามเนื้อหาในเอกสารอย่างเคร่งครัด พร้อมอธิบายวัตถุประสงค์ เงื่อนไข เอกสารแนบ ค่าธรรมเนียม และขั้นตอนดำเนินการให้ครบถ้วน
            4. เมื่อวิเคราะห์ผลการเรียน ให้สรุปให้เข้าใจง่าย เช่น วิชาที่ทำได้ดี วิชาที่ควรพัฒนา แนวโน้ม GPA และสิ่งที่ยังขาดเพื่อสำเร็จการศึกษา
            5. หากนักศึกษาถามเรื่องการคำนวณ GPA ล่วงหน้า ให้แสดงวิธีคำนวณอย่างเป็นขั้นตอนตามเกณฑ์จริง (แต้มรวมเดิม + แต้มเทอมใหม่ หารด้วยหน่วยกิตรวม)
            6. หากผู้ใช้เป็นอาจารย์ที่ปรึกษา ให้ช่วยวิเคราะห์ความเสี่ยงของนักศึกษาในความดูแลรายบุคคลที่สอบถาม (พ้นสภาพ/ตก/ถอนวิชา/จบช้า) อย่างละเอียดจากข้อมูลจริง พร้อมข้อเสนอแนะเชิงช่วยเหลือที่เป็นรูปธรรม
            7. วิชาที่เกรดเป็น "ยังไม่ออกผล" ไม่นำมาคิด GPA
            """);

        if (rag != null && rag.contextText() != null && !rag.contextText().isBlank()) {
            sb.append("\n[เอกสารอ้างอิงจากคลังความรู้สาขา (RAG)]:\n");
            sb.append(rag.contextText()).append("\n");
        }

        String q = userMessage.toLowerCase();
        if ((matchedForms != null && !matchedForms.isEmpty())
                || q.contains("คำร้อง") || q.contains("แบบฟอร์ม") || q.contains("เอกสาร")
                || q.contains("ทบ") || q.contains("ใบลา") || q.contains("ใบรับรอง") || q.contains("ทรานสคริป")) {
            sb.append(formCatalog().buildPromptContext(userMessage, matchedForms != null ? matchedForms : List.of())).append("\n");
        }
        if (q.contains("กิจกรรม") || q.contains("ปัจฉิม") || q.contains("จิตสาธารณะ") || q.contains("วันพิราลัย")) {
            sb.append("\n[เกณฑ์กิจกรรมนักศึกษา BSRU]:\n").append(BSRU_ACTIVITY_CRITERIA_TEXT).append("\n");
        }
        if (contextSessionId != null && contextSessionId.startsWith(StudentRecordTools.STUDENT_MEMORY_PREFIX)) {
            sb.append("\n[ข้อมูลจริงจากฐานข้อมูลระบบสำหรับนักศึกษาคนนี้]:\n");
            try {
                String profile = studentRecordTools.getMyProfile(contextSessionId);
                if (profile != null && !profile.isBlank()) {
                    sb.append("--- ข้อมูลประวัตินักศึกษา ---\n").append(profile).append("\n");
                }
            } catch (Exception ignored) {}

            try {
                String grades = studentRecordTools.getMyGrades(contextSessionId);
                if (grades != null && !grades.isBlank()) {
                    sb.append("--- ข้อมูลผลการเรียนทุกภาคเรียน ---\n").append(grades).append("\n");
                }
            } catch (Exception ignored) {}

            if (q.contains("จบ") || q.contains("ขาด") || q.contains("หน่วยกิต") || q.contains("หมวด") || q.contains("audit") || q.contains("กิจกรรม")) {
                try {
                    String audit = studentRecordTools.getMyGraduationProgress(contextSessionId);
                    if (audit != null && !audit.isBlank()) {
                        sb.append("--- ข้อมูลการตรวจสอบจบและโครงสร้างหลักสูตร ---\n").append(audit).append("\n");
                    }
                } catch (Exception ignored) {}
            }

            if (q.contains("ตาราง") || q.contains("เรียน") || q.contains("วัน") || q.contains("เวลา") || q.contains("ห้อง") || q.contains("ลงทะเบียน") || q.contains("ชน")) {
                try {
                    String timetable = studentRecordTools.getMyTimetable(contextSessionId);
                    if (timetable != null && !timetable.isBlank()) {
                        sb.append("--- ข้อมูลตารางเรียนและการลงทะเบียน ---\n").append(timetable).append("\n");
                    }
                } catch (Exception ignored) {}
            }

            // AI Study Planner context
            if (q.contains("วางแผน") || q.contains("เทอมหน้า") || q.contains("เทอมถัดไป") || q.contains("ควรลง")) {
                try {
                    String audit = studentRecordTools.getMyGraduationProgress(contextSessionId);
                    if (audit != null && !audit.isBlank()) {
                        sb.append("--- ข้อมูลการตรวจสอบจบและโครงสร้างหลักสูตร ---\n").append(audit).append("\n");
                    }
                } catch (Exception ignored) {}
                try {
                    String timetable = studentRecordTools.getMyTimetable(contextSessionId);
                    if (timetable != null && !timetable.isBlank()) {
                        sb.append("--- ข้อมูลตารางเรียนปัจจุบัน ---\n").append(timetable).append("\n");
                    }
                } catch (Exception ignored) {}
                try {
                    String offered = studentRecordTools.findOfferedSections(contextSessionId, "");
                    if (offered != null && !offered.isBlank()) {
                        sb.append("--- รายวิชาและ section ที่เปิดสอนสำหรับวางแผนลงทะเบียน ---\n").append(offered).append("\n");
                    }
                } catch (Exception ignored) {}
            }

            if (q.contains("คำร้อง") || q.contains("petition") || q.contains("ยื่น")) {
                try {
                    String petitions = studentRecordTools.getMyPetitions(contextSessionId);
                    if (petitions != null && !petitions.isBlank()) {
                        sb.append("--- ข้อมูลคำร้องวิชาการ ---\n").append(petitions).append("\n");
                    }
                } catch (Exception ignored) {}
            }
        } else if (contextSessionId != null && contextSessionId.startsWith(AdvisorTools.ADVISOR_MEMORY_PREFIX)) {
            sb.append("\n[ข้อมูลจริงจากฐานข้อมูลระบบสำหรับอาจารย์ที่ปรึกษา]:\n");
            Matcher m = Pattern.compile("\\b(\\d{10})\\b").matcher(userMessage);
            if (m.find()) {
                String targetStudentId = m.group(1);
                try {
                    String detail = advisorTools.getAdviseeRecord(contextSessionId, targetStudentId);
                    if (detail != null && !detail.isBlank()) {
                        sb.append("--- ข้อมูลเชิงลึกรายบุคคลของนักศึกษารหัส ").append(targetStudentId).append(" ---\n")
                          .append(detail).append("\n");
                    }
                } catch (Exception ignored) {}
            } else {
                try {
                    String risks = advisorTools.getMyAdviseesRiskOverview(contextSessionId);
                    if (risks != null && !risks.isBlank()) {
                        sb.append("--- ข้อมูลภาพรวมความเสี่ยงของนักศึกษาในความดูแล ---\n").append(risks).append("\n");
                    }
                } catch (Exception ignored) {}
            }
        }

        return sb.toString();
    }

    private String resolveSessionId(ChatRequest request, Authentication authentication) {
        if (!CurrentUser.isLoggedIn(authentication)) {
            String guestId = (request != null && request.getSessionId() != null && !request.getSessionId().isBlank())
                    ? request.getSessionId().trim()
                    : "guest-session";
            return "guest:" + guestId;
        }
        return CurrentUser.studentId(authentication)
                .map(id -> StudentRecordTools.STUDENT_MEMORY_PREFIX + id)
                .or(() -> CurrentUser.advisorId(authentication).map(id -> AdvisorTools.ADVISOR_MEMORY_PREFIX + id))
                .orElse("staff:" + authentication.getName());
    }

    private String generateFallbackResponse(String contextSessionId, String query,
                                            RagRetrieval rag, List<AcademicFormInfo> matchedForms) {
        String q = query.toLowerCase();

        // หากเป็นอาจารย์ที่ปรึกษาและขอวิเคราะห์นักศึกษารายบุคคล ให้ดึงข้อมูลและการประเมินความเสี่ยงรายบุคคลจากฐานข้อมูลทันที
        if (contextSessionId != null && contextSessionId.startsWith(AdvisorTools.ADVISOR_MEMORY_PREFIX)) {
            Matcher m = Pattern.compile("\\b(\\d{10})\\b").matcher(query);
            if (m.find()) {
                String targetStudentId = m.group(1);
                try {
                    String detail = advisorTools.getAdviseeRecord(contextSessionId, targetStudentId);
                    if (detail != null && !detail.isBlank()) {
                        return "ผลการวิเคราะห์ความเสี่ยงและข้อมูลวิชาการรายบุคคลของนักศึกษารหัส **" + targetStudentId + "** จากฐานข้อมูลระบบ:\n\n" + detail;
                    }
                } catch (Exception ignored) {}
            }
        }

        // หากคำถามตรงกับเอกสาร/แบบฟอร์มคำร้อง (ทบ. / ใบลา / กยศ.) ให้ส่งคำอธิบายรายละเอียดของเอกสารนั้นทันทีควบคู่กับไฟล์แนบ PDF
        if (matchedForms != null && !matchedForms.isEmpty()) {
            String formReply = formCatalog().buildFallbackReply(query, matchedForms);
            if (formReply != null && !formReply.isBlank()) {
                return formReply;
            }
        }

        // หากเป็นนักศึกษาและถามเรื่องเกรด ให้ดึงข้อมูลจริงจากฐานข้อมูลตอบทันที
        if (contextSessionId != null && contextSessionId.startsWith(StudentRecordTools.STUDENT_MEMORY_PREFIX)
                && (q.contains("เกรด") || q.contains("ผลการเรียน") || q.contains("gpa"))) {
            try {
                String profile = studentRecordTools.getMyProfile(contextSessionId);
                String grades = studentRecordTools.getMyGrades(contextSessionId);
                if (grades != null && !grades.isBlank()) {
                    return "ผลการเรียนของคุณที่บันทึกในฐานข้อมูลระบบมีดังนี้ครับ:\n\n" + profile + "\n\n" + grades;
                }
            } catch (Exception ignored) {}
        }

        if (rag != null && rag.contextText() != null && !rag.contextText().isBlank()) {
            return "จากข้อมูลในคลังความรู้สาขา (BSRU Knowledge Base):\n" + rag.contextText();
        }

        if (q.contains("คำร้อง") || q.contains("ยื่นคำร้อง") || q.contains("petition")) {
            return "สำหรับการยื่นคำร้องวิชาการ คุณสามารถไปที่เมนู **'ยื่นคำร้องวิชาการ'** ในแถบเมนูด้านซ้าย เลือกประเภทคำร้อง กรอกรายละเอียด และแนบไฟล์ PDF เพื่อส่งพิจารณาได้ทันทีครับ\n\n📄 **ต้องการขอไฟล์แบบฟอร์มเอกสารทางการหรือไม่ครับ?** สามารถพิมพ์ขอเอกสารกับผมได้เลย เช่น **ทบ.1** (คำร้องทั่วไป), **ทบ.2** (ทำบัตรนักศึกษา), **ทบ.4** (ขอ Transcript), **ทบ.5** (ใบรับรองสถานภาพ), **ทบ.6** (พักการเรียน/คืนสภาพ), **ทบ.7** (ลาออก/ย้าย ม.), **ทบ.8–11** (เรียนสมทบ/ยกเว้น/โอนเกรด), **ทบ.12** (ถอนรายวิชา W), **ทบ.14** (ขอเปิดวิชาพิเศษ), **ทบ.15** (เปลี่ยนสาขา/คณะ), **ทบ.17** (แจ้งเรียนภาคสุดท้าย), **ใบลาป่วย/ลากิจ** หรือ **แบบฟอร์มจิตอาสา กยศ./กรอ.** ระบบจะส่งไฟล์ PDF พร้อมคำอธิบายให้ดาวน์โหลดทันทีครับ";
        } else if (q.contains("วางแผน") || q.contains("เทอมหน้า") || q.contains("เทอมถัดไป") || q.contains("ควรลง")) {
            return "สำหรับการวางแผนลงทะเบียนเรียนเทอมถัดไป แนะนำให้ตรวจสอบวิชาบังคับตามโครงสร้างหลักสูตรที่ยังไม่ได้เรียนในเมนู **'ตรวจสอบจบ'** ควบคู่กับตารางสอนในเมนู **'ตารางเรียน'** เพื่อเลือก Section ที่เวลาไม่ชนกันครับ หากต้องการคำแนะนำเฉพาะเจาะจง สามารถปรึกษาอาจารย์ที่ปรึกษาได้ครับ";
        } else if (q.contains("เกรด") || q.contains("ผลการเรียน") || q.contains("gpa")) {
            return "คุณสามารถตรวจสอบผลการเรียนรายภาคเรียนและเกรดเฉลี่ยสะสม (GPA) ได้ที่เมนู **'ผลการเรียน'** โดยระบบจะแสดงรายการวิชาที่ผ่าน หน่วยกิตสะสม และกราฟแนวโน้มผลการเรียนครับ";
        } else if (q.contains("ตารางเรียน") || q.contains("ตารางสอบ") || q.contains("schedule")) {
            return "ตารางเรียนและตารางสอบภาคเรียนปัจจุบัน สามารถดูได้ที่เมนู **'ตารางเรียน'** ในรูปแบบ Matrix Grid รายสัปดาห์ พร้อมทั้งสามารถเพิ่ม/ลบรายวิชาได้ครับ";
        } else if (q.contains("กิจกรรม") || q.contains("ปัจฉิม") || q.contains("จิตสาธารณะ") || q.contains("วันพิราลัย")) {
            return BSRU_ACTIVITY_CRITERIA_TEXT;
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
