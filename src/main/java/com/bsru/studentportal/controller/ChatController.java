package com.bsru.studentportal.controller;

import com.bsru.studentportal.ai.AdvisorTools;
import com.bsru.studentportal.ai.StudentRecordTools;
import com.bsru.studentportal.ai.TeachingTools;
import com.bsru.studentportal.dto.ChatRequest;
import com.bsru.studentportal.dto.ChatResponse;
import com.bsru.studentportal.dto.FormAttachmentDto;
import com.bsru.studentportal.model.ChatHistoryEntry;
import com.bsru.studentportal.repository.ChatHistoryRepository;
import com.bsru.studentportal.security.CurrentUser;
import com.bsru.studentportal.service.AcademicFormCatalogService;
import com.bsru.studentportal.service.AcademicFormCatalogService.AcademicFormInfo;
import com.bsru.studentportal.model.ChatLogEntry;
import com.bsru.studentportal.service.ChatLogService;
import com.bsru.studentportal.service.FaqService;
import com.bsru.studentportal.service.GeminiDirectService;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
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
import java.util.UUID;
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
    private final TeachingTools teachingTools;
    private final FaqService faqService;
    private final ChatLogService chatLogService;
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
        // ผู้ใช้ที่ login: key มาจาก JWT เท่านั้น / ผู้ใช้ทั่วไป: id สุ่มจาก browser (ถ้าไม่มีหรือรูปแบบผิด จะสร้างใหม่ให้)
        ChatIdentity identity = resolveChatIdentity(request.getSessionId(), authentication, true);
        String chatKey = identity.key();

        // ไม่ log ข้อความของผู้ใช้ (อาจมีข้อมูลส่วนตัว) — เก็บแค่ key และความยาวข้อความ
        log.info("Incoming chat request from key: {}, message length: {}", chatKey, userMessage.length());

        // AI recall of earlier conversations: read before this message joins the current conversation
        String earlierChats = chatLogService != null ? chatLogService.recallForAi(chatKey) : "";

        // 1. Persist user message to PostgreSQL (panel history + permanent archive)
        saveChatHistoryEntry(chatKey, "USER", userMessage, null);
        ChatLogEntry archivedQuestion = chatLogService != null
                ? chatLogService.record(chatKey, ChatLogEntry.USER, userMessage, null, null) : null;

        List<AcademicFormInfo> matchedForms = formCatalog().findMatchingForms(userMessage);
        List<FormAttachmentDto> attachments = matchedForms.stream()
                .map(AcademicFormInfo::toAttachmentDto)
                .toList();

        // 2. FAQ set by the admin: a close match marked "answer exactly" is sent as written
        List<FaqService.Match> faqMatches = faqService != null ? faqService.matches(userMessage, 3) : List.of();
        FaqService.Match bestFaq = faqMatches.isEmpty() ? null : faqMatches.get(0);
        if (bestFaq != null && bestFaq.answersExactly()) {
            String reply = bestFaq.entry().getAnswer();
            return reply(identity, chatKey, userMessage, reply, List.of(), attachments,
                    archivedQuestion, ChatLogEntry.Source.FAQ_EXACT, bestFaq.entry().getId());
        }

        RagRetrieval rag = retrieveRelevantKnowledge(userMessage);
        Long faqId = bestFaq != null ? bestFaq.entry().getId() : null;

        // หากยังไม่ได้ใส่ Gemini API Key จริง ให้ตอบด้วยระบบผู้ช่วยจำลองทันที
        if (geminiApiKey == null || geminiApiKey.isBlank() || geminiApiKey.equals("demo-api-key")
                || geminiApiKey.startsWith("your-") || geminiApiKey.length() < 25) {
            log.info("Gemini API key not configured with a valid key. Returning instant assistant fallback.");
            return fallbackReply(identity, chatKey, userMessage, rag, matchedForms, attachments, archivedQuestion, bestFaq);
        }

        try {
            String aiReply = askAiWithContext(chatKey, userMessage, rag, matchedForms,
                    faqService != null ? faqService.promptContext(faqMatches) : "", earlierChats);
            ChatLogEntry.Source source = faqId != null ? ChatLogEntry.Source.FAQ_SUGGESTED
                    : aiSaysItDoesNotKnow(aiReply) ? ChatLogEntry.Source.NO_ANSWER : ChatLogEntry.Source.AI;
            return reply(identity, chatKey, userMessage, aiReply, rag.sources(), attachments, archivedQuestion, source, faqId);
        } catch (Exception e) {
            log.error("Gemini API call encountered an issue: ", e);
            return fallbackReply(identity, chatKey, userMessage, rag, matchedForms, attachments, archivedQuestion, bestFaq);
        }
    }

    /** Answer without the AI: the closest FAQ if there is one, else the rule-based reply */
    private ResponseEntity<?> fallbackReply(ChatIdentity identity, String chatKey, String userMessage, RagRetrieval rag,
                                            List<AcademicFormInfo> matchedForms, List<FormAttachmentDto> attachments,
                                            ChatLogEntry archivedQuestion, FaqService.Match bestFaq) {
        if (bestFaq != null) {
            String reply = "คำตอบจากคำถามที่พบบ่อยที่ใกล้เคียงที่สุด (\"" + bestFaq.entry().getQuestion() + "\"):\n\n"
                    + bestFaq.entry().getAnswer();
            return reply(identity, chatKey, userMessage, reply, List.of(), attachments, archivedQuestion,
                    ChatLogEntry.Source.FAQ_SUGGESTED, bestFaq.entry().getId());
        }
        String reply = generateFallbackResponse(chatKey, userMessage, rag, matchedForms);
        ChatLogEntry.Source source = DEFAULT_FALLBACK_REPLY.equals(reply) ? ChatLogEntry.Source.NO_ANSWER : ChatLogEntry.Source.FALLBACK;
        return reply(identity, chatKey, userMessage, reply, rag.sources(), attachments, archivedQuestion, source, null);
    }

    /** Saves the answer (panel history, AI memory, archive, FAQ hit count) and sends it */
    private ResponseEntity<?> reply(ChatIdentity identity, String chatKey, String userMessage, String reply,
                                    List<String> sources, List<FormAttachmentDto> attachments,
                                    ChatLogEntry archivedQuestion, ChatLogEntry.Source source, Long faqId) {
        saveChatHistoryEntry(chatKey, "BOT", reply, sources);
        updateMemoryStore(chatKey, userMessage, reply);
        if (chatLogService != null) {
            chatLogService.markAnswered(archivedQuestion, source, faqId);
            chatLogService.record(chatKey, ChatLogEntry.BOT, reply, source, faqId);
        }
        if (faqService != null && faqId != null) {
            try { faqService.recordHit(faqId); } catch (Exception e) { log.warn("Could not count FAQ hit: {}", e.getMessage()); }
        }
        return ResponseEntity.ok(ChatResponse.builder()
                .reply(reply)
                .sessionId(identity.clientSessionId())
                .sources(sources)
                .attachments(attachments)
                .build());
    }

    // ------------------------------------------------------------------ own past chats + satisfaction

    /** Whether the caller may open their own earlier chats (the admin decides, per role or per person) */
    @GetMapping("/chat/archive/access")
    public ResponseEntity<?> archiveAccess(@RequestParam(required = false) String sessionId, Authentication authentication) {
        ChatIdentity identity = resolveChatIdentity(sessionId, authentication, false);
        boolean allowed = identity != null && chatLogService != null && chatLogService.canSeeOwnHistory(identity.key());
        return ResponseEntity.ok(Map.of("allowed", allowed));
    }

    /** The caller's own earlier chats, only when allowed; never anyone else's */
    @GetMapping("/chat/archive")
    public ResponseEntity<?> ownArchive(@RequestParam(required = false) String sessionId, Authentication authentication) {
        ChatIdentity identity = resolveChatIdentity(sessionId, authentication, false);
        if (identity == null || chatLogService == null) return ResponseEntity.ok(List.of());
        try {
            return ResponseEntity.ok(chatLogService.ownArchive(identity.key()).stream()
                    .map(e -> Map.of("sender", e.getSender(), "message", e.getMessage(), "createdAt", e.getCreatedAt()))
                    .toList());
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).body(Map.of("error", String.valueOf(e.getReason())));
        }
    }

    /** Body: {"level": 1|2|3, "trigger": "IDLE"|"CLOSE", "sessionId": "<guest id>"} */
    @PostMapping("/chat/satisfaction")
    public ResponseEntity<?> rate(@RequestBody Map<String, Object> body, Authentication authentication) {
        Object sid = body.get("sessionId");
        ChatIdentity identity = resolveChatIdentity(sid instanceof String s ? s : null, authentication, true);
        if (chatLogService == null) return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        int level = body.get("level") instanceof Number n ? n.intValue() : 0;
        try {
            chatLogService.rate(identity.key(), level, body.get("trigger") instanceof String t ? t : null);
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).body(Map.of("error", String.valueOf(e.getReason())));
        }
        return ResponseEntity.ok(Map.of("status", "saved"));
    }

    /**
     * ประวัติแชทของผู้เรียกเท่านั้น: ผู้ใช้ที่ login ใช้ key จาก JWT (ไม่สนใจ sessionId/userKey ที่ส่งมา),
     * ผู้ใช้ทั่วไปต้องส่ง id สุ่มของแท็บตัวเอง (sessionId หรือ userKey) ที่ผ่านการตรวจรูปแบบ
     */
    @GetMapping("/chat/history")
    public ResponseEntity<?> getChatHistory(
            @RequestParam(required = false) String sessionId,
            @RequestParam(required = false) String userKey,
            Authentication authentication
    ) {
        String requestedGuestId = firstNonBlank(sessionId, userKey);
        if (!CurrentUser.isLoggedIn(authentication) && requestedGuestId != null && !isValidGuestId(requestedGuestId)) {
            return ResponseEntity.badRequest().body(Map.of("error", INVALID_GUEST_ID_MESSAGE));
        }

        ChatIdentity identity = resolveChatIdentity(requestedGuestId, authentication, false);
        if (identity == null || chatHistoryRepository == null) {
            return ResponseEntity.ok(List.of());
        }

        return ResponseEntity.ok(chatHistoryRepository.findByUserKeyOrderByTimestampAsc(identity.key()));
    }

    @DeleteMapping("/chat/history")
    public ResponseEntity<?> clearChatHistory(
            @RequestParam(required = false) String sessionId,
            @RequestParam(required = false) String userKey,
            Authentication authentication
    ) {
        String requestedGuestId = firstNonBlank(sessionId, userKey);
        if (!CurrentUser.isLoggedIn(authentication) && requestedGuestId != null && !isValidGuestId(requestedGuestId)) {
            return ResponseEntity.badRequest().body(Map.of("error", INVALID_GUEST_ID_MESSAGE));
        }

        ChatIdentity identity = resolveChatIdentity(requestedGuestId, authentication, false);

        int deletedRows = 0;
        if (identity != null) {
            if (chatHistoryRepository != null) {
                deletedRows = chatHistoryRepository.deleteByUserKey(identity.key());
            }
            if (chatMemoryStore != null) {
                try { chatMemoryStore.deleteMessages(identity.key()); } catch (Exception ignored) {}
            }
        }

        return ResponseEntity.ok(Map.of(
                "message", "Chat history and memory cleared successfully",
                "deletedEntries", deletedRows,
                "status", "cleared"
        ));
    }

    /** sessionId และ userKey ของแถวใหม่เป็นค่าเดียวกันเสมอ (key ที่มี prefix student:/advisor:/staff:/guest:) */
    private void saveChatHistoryEntry(String chatKey, String sender, String message, List<String> sources) {
        if (chatHistoryRepository == null) return;
        try {
            chatHistoryRepository.save(ChatHistoryEntry.builder()
                    .sessionId(chatKey)
                    .userKey(chatKey)
                    .sender(sender)
                    .message(message)
                    .sources(serializeSources(sources))
                    .timestamp(LocalDateTime.now())
                    .build());
        } catch (Exception e) {
            log.warn("Failed to persist chat history entry ({}: {}): {}", sender, chatKey, e.getMessage());
        }
    }

    private void updateMemoryStore(String chatKey, String userMessage, String botReply) {
        if (chatMemoryStore == null) return;
        try {
            List<ChatMessage> currentHistory = chatMemoryStore.getMessages(chatKey);
            List<ChatMessage> updated = new ArrayList<>(currentHistory != null ? currentHistory : List.of());
            updated.add(UserMessage.from(userMessage));
            updated.add(AiMessage.from(botReply));
            chatMemoryStore.updateMessages(chatKey, updated);
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
    private String askAiWithContext(String chatKey, String userMessage, RagRetrieval rag, List<AcademicFormInfo> matchedForms,
                                    String faqContext, String earlierChats) throws Exception {
        String systemPrompt = buildSystemPromptWithDatabaseContext(chatKey, userMessage, rag, matchedForms);
        if (faqContext != null && !faqContext.isBlank()) systemPrompt += faqContext;
        if (earlierChats != null && !earlierChats.isBlank()) {
            systemPrompt += "\n[บทสนทนาครั้งก่อน ๆ ของผู้ใช้คนนี้ (เฉพาะของเขาเอง ใช้อ้างอิงเมื่อผู้ใช้ถามถึงเรื่องที่เคยคุย"
                    + " ห้ามนำไปบอกผู้อื่น และข้อมูลเกรด/ตารางให้ยึดข้อมูลจริงจากฐานข้อมูลด้านบนเป็นหลัก)]:\n" + earlierChats;
        }

        StringBuilder conversationContext = new StringBuilder();
        try {
            if (chatMemoryStore != null) {
                List<ChatMessage> history = chatMemoryStore.getMessages(chatKey);
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
            
            หลักการสำคัญที่สุดในการตอบคำถาม:
            1. ตอบเฉพาะเท่าที่ถาม (Answer strictly what is asked) ตรงประเด็น กระชับ ไม่ออกนอกเรื่อง ไม่ตอบยืดยาวเกินจำเป็น:
               - หากผู้ใช้ถามสั้นๆ หรือเพียงขอเอกสาร/ขอไฟล์ (เช่น "ขอใบลา", "ขอ ทบ.4", "ขอฟอร์มจิตอาสา") ให้ตอบสั้นๆ เพียง 1-3 บรรทัด แจ้งว่าจัดเตรียมเอกสารให้แล้วและสรุปสั้นๆ ว่าเอกสารนี้ใช้ทำอะไร พร้อมแนะนำให้เปิดดูหรือดาวน์โหลดจากการ์ดเอกสารแนบด้านล่าง
               - ห้ามร่ายยาวขั้นตอนการยื่น รายละเอียดการกรอก หรือหลักฐานยาวเหยียดที่ผู้ใช้ไม่ได้ขอ เว้นแต่ผู้ใช้จะถามถึง "ขั้นตอน", "วิธีดำเนินการ", หรือ "ต้องใช้อะไรบ้าง"
               - ห้ามกล่าวทักทายซ้ำซ้อนในบทสนทนา เช่น "สวัสดีครับ/ค่ะ BSRU CS AI Assistant ยินดีให้บริการ..." ให้ตอบเข้าประเด็นทันที
               - ห้ามพิมพ์ลิงก์จำลองหรือ URL หลอกในเนื้อหาข้อความ เช่น "[ดาวน์โหลด...](จำลองลิงก์สำหรับดาวน์โหลด)" เพราะระบบหน้าต่างแชทมีการ์ดไฟล์ PDF แนบจริงอยู่ด้านล่างข้อความอยู่แล้ว
               - ห้ามแนะนำหรือยกตัวอย่างชื่อรหัสเอกสารอื่นๆ ที่ผู้ใช้ไม่ได้ถามถึง (เช่น ห้ามปิดท้ายด้วย "หากต้องการเอกสารอื่นๆ เช่น ทบ.1, ทบ.4...") เพื่อป้องกันความสับสน
            2. ให้คำปรึกษา แนะนำข้อมูลวิชาการ ผลการเรียน การวิเคราะห์เกรด ตารางเรียน กิจกรรม และเอกสารคำร้อง (ทบ.) อย่างสุภาพ ชัดเจน และถูกต้องตามข้อมูลจริง
            3. ตอบคำถามด้วยภาษาไทยที่สุภาพ มีหางเสียง (ครับ/ค่ะ) จัดรูปแบบให้อ่านง่าย เช่น ใช้ Bullet points หรือ Markdown เมื่อเหมาะสม
            4. ข้อมูลในส่วน [ข้อมูลจริงจากฐานข้อมูลระบบ], [เอกสารอ้างอิงจากคลังความรู้สาขา (RAG)] และ [คลังเอกสารคำร้องและแบบฟอร์มทางการ มบส.] เป็นข้อมูลจริงปัจจุบัน ให้ใช้ข้อมูลนี้เป็นหลักในการตอบ ห้ามแต่งตัวเลขหรือสร้างข้อมูลเท็จ
            5. เมื่อวิเคราะห์ผลการเรียน ให้สรุปให้เข้าใจง่าย เช่น วิชาที่ทำได้ดี วิชาที่ควรพัฒนา แนวโน้ม GPA และสิ่งที่ยังขาดเพื่อสำเร็จการศึกษา
            6. หากนักศึกษาถามเรื่องการคำนวณ GPA ล่วงหน้า ให้แสดงวิธีคำนวณอย่างเป็นขั้นตอนตามเกณฑ์จริง (แต้มรวมเดิม + แต้มเทอมใหม่ หารด้วยหน่วยกิตรวม)
            7. หากผู้ใช้เป็นอาจารย์ที่ปรึกษา ให้ช่วยวิเคราะห์ความเสี่ยงของนักศึกษาในความดูแลรายบุคคลที่สอบถาม (พ้นสภาพ/ตก/ถอนวิชา/จบช้า) อย่างละเอียดจากข้อมูลจริง พร้อมข้อเสนอแนะเชิงช่วยเหลือที่เป็นรูปธรรม
            8. วิชาที่เกรดเป็น "ยังไม่ออกผล" ไม่นำมาคิด GPA
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
                // Not an advisee? The teacher may still see this student's data in courses they teach
                try {
                    String inCourses = teachingTools.getStudentInMyCourses(contextSessionId, targetStudentId);
                    if (inCourses != null && !inCourses.isBlank()) {
                        sb.append("--- ข้อมูลของนักศึกษารหัส ").append(targetStudentId)
                          .append(" เฉพาะในรายวิชาที่อาจารย์สอน ---\n").append(inCourses).append("\n");
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
            // Courses the teacher teaches (every year/term): only that course's enrollment and grades
            if (q.contains("วิชา") || q.contains("สอน") || q.contains("sec") || q.contains("กลุ่มเรียน")) {
                Matcher course = Pattern.compile("\\b([A-Za-z]{2,4}\\s?\\d{3,4})\\b").matcher(userMessage);
                String courseCode = course.find() ? course.group(1).replace(" ", "").toUpperCase() : null;
                try {
                    String courses = teachingTools.getMyTeachingCourses(contextSessionId);
                    if (courses != null && !courses.isBlank()) {
                        sb.append("--- รายวิชาและ Sec ที่อาจารย์สอน ---\n").append(courses).append("\n");
                    }
                    String roster = teachingTools.getStudentsInMyCourse(contextSessionId, courseCode, null, null);
                    if (roster != null && !roster.isBlank()) {
                        sb.append("--- นักศึกษาและเกรดในรายวิชาที่สอน ---\n").append(roster).append("\n");
                    }
                } catch (Exception ignored) {}
            }
        }

        return sb.toString();
    }

    /**
     * ตัวตนของห้องแชท
     * @param key             key ของประวัติแชทและหน่วยความจำ ขึ้นต้นด้วย student:/advisor:/staff:/guest: เสมอ
     * @param clientSessionId ค่าที่ส่งกลับใน ChatResponse.sessionId (ผู้ใช้ทั่วไป = id ที่ browser ต้องส่งกลับมา)
     */
    record ChatIdentity(String key, String clientSessionId) {}

    static final String GUEST_MEMORY_PREFIX = "guest:";
    static final String STAFF_MEMORY_PREFIX = "staff:";

    /** id ของผู้ใช้ทั่วไปต้องเป็นค่าสุ่ม เช่น UUID จาก crypto.randomUUID() — ห้ามมี ':' จึงอ้างถึง key ของผู้ใช้ที่ login ไม่ได้ */
    private static final Pattern GUEST_ID_PATTERN = Pattern.compile("^[A-Za-z0-9-]{16,64}$");
    private static final String INVALID_GUEST_ID_MESSAGE =
            "รูปแบบ sessionId ไม่ถูกต้อง (ต้องเป็นตัวอักษร/ตัวเลข/ขีด 16-64 ตัว เช่น UUID)";

    static boolean isValidGuestId(String guestId) {
        return guestId != null && GUEST_ID_PATTERN.matcher(guestId).matches();
    }

    private static String firstNonBlank(String a, String b) {
        if (a != null && !a.isBlank()) return a.trim();
        if (b != null && !b.isBlank()) return b.trim();
        return null;
    }

    /**
     * ผู้ใช้ที่ login: key มาจาก JWT เท่านั้น ค่าที่ client ส่งมาจะถูกละเลย
     * ผู้ใช้ทั่วไป: ใช้ id สุ่มของ browser ภายใต้ namespace guest: — ถ้าไม่มีหรือรูปแบบผิด
     * จะสร้าง UUID ใหม่ (generateIfMissing = true) หรือคืน null (สำหรับอ่าน/ลบประวัติ)
     */
    private ChatIdentity resolveChatIdentity(String requestedGuestId, Authentication authentication, boolean generateIfMissing) {
        if (CurrentUser.isLoggedIn(authentication)) {
            String key = CurrentUser.studentId(authentication)
                    .map(id -> StudentRecordTools.STUDENT_MEMORY_PREFIX + id)
                    .or(() -> CurrentUser.advisorId(authentication).map(id -> AdvisorTools.ADVISOR_MEMORY_PREFIX + id
                            + (CurrentUser.isDemoAdvisor(authentication) ? AdvisorTools.SEES_ALL_SUFFIX : "")))
                    .orElse(STAFF_MEMORY_PREFIX + authentication.getName());
            return new ChatIdentity(key, key);
        }

        String guestId = requestedGuestId != null ? requestedGuestId.trim() : null;
        if (!isValidGuestId(guestId)) {
            if (!generateIfMissing) return null;
            guestId = UUID.randomUUID().toString();
        }
        return new ChatIdentity(GUEST_MEMORY_PREFIX + guestId, guestId);
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
            return DEFAULT_FALLBACK_REPLY;
        }
    }

    private static final List<String> NO_INFO_PHRASES = List.of(
            "ไม่มีข้อมูล", "ไม่พบข้อมูล", "ไม่สามารถตอบ", "ไม่สามารถให้ข้อมูล", "ไม่ทราบข้อมูล", "ยังไม่มีข้อมูลเกี่ยวกับ");

    /** The AI said it had no information: counted as "ตอบไม่ได้" so the admin can add a FAQ */
    static boolean aiSaysItDoesNotKnow(String reply) {
        if (reply == null) return true;
        String head = reply.length() > 300 ? reply.substring(0, 300) : reply;
        return NO_INFO_PHRASES.stream().anyMatch(head::contains);
    }

    /** The reply when nothing matched; counted as "ตอบไม่ได้" in the admin's statistics */
    static final String DEFAULT_FALLBACK_REPLY = "ขอบคุณสำหรับคำถามครับ! หากมีข้อสงสัยเกี่ยวกับระบบสารสนเทศนักศึกษา สาขาวิทยาการคอมพิวเตอร์ มหาวิทยาลัยราชภัฏบ้านสมเด็จเจ้าพระยา (BSRU) เช่น การยื่นคำร้องวิชาการ, ตารางเรียน, การตรวจสอบจบ หรือการติดต่ออาจารย์ที่ปรึกษา สามารถสอบถามผมได้ตลอดเวลาเลยนะครับ!";
}
