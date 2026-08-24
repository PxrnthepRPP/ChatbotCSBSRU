package com.bsru.studentportal.controller;

import com.bsru.studentportal.dto.ChatRequest;
import com.bsru.studentportal.dto.ChatResponse;
import com.bsru.studentportal.service.ChatbotService;
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

    @PostMapping("/chat")
    public ResponseEntity<?> chat(
            @RequestBody ChatRequest request,
            Authentication authentication
    ) {
        if (request.getMessage() == null || request.getMessage().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Message cannot be empty"));
        }

        String userMessage = request.getMessage().trim();
        String sessionId = (authentication != null && authentication.getName() != null)
                ? authentication.getName()
                : (request.getSessionId() != null ? request.getSessionId() : "guest-session");

        log.info("Incoming chat request from sessionId: {}, message: {}", sessionId, userMessage);

        try {
            String aiReply = chatbotService.chat(sessionId, userMessage);
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
        } else if (q.contains("สวัสดี") || q.contains("hello") || q.contains("hi")) {
            return "สวัสดีครับ! ผมคือ **BSRU CS AI Assistant** ยินดีให้คำแนะนำและตอบคำถามเกี่ยวกับระบบสารสนเทศนักศึกษา การลงทะเบียนเรียน ตารางเรียน ผลการเรียน และการยื่นคำร้องวิชาการครับ มีอะไรให้ผมช่วยเหลือไหมครับ?";
        } else {
            return "ขอบคุณสำหรับคำถามครับ! หากมีข้อสงสัยเกี่ยวกับระบบสารสนเทศนักศึกษา สาขาวิทยาการคอมพิวเตอร์ มหาวิทยาลัยราชภัฏบ้านสมเด็จเจ้าพระยา (BSRU) เช่น การยื่นคำร้องวิชาการ, ตารางเรียน, การตรวจสอบจบ หรือการติดต่ออาจารย์ที่ปรึกษา สามารถสอบถามผมได้ตลอดเวลาเลยนะครับ!";
        }
    }
}
