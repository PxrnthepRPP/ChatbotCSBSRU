package com.bsru.studentportal.controller;

import com.bsru.studentportal.dto.PetitionRequest;
import com.bsru.studentportal.dto.PetitionStatusUpdateRequest;
import com.bsru.studentportal.model.AcademicPetition;
import com.bsru.studentportal.model.Advisor;
import com.bsru.studentportal.model.ClassSection;
import com.bsru.studentportal.model.SectionEnrollment;
import com.bsru.studentportal.model.SectionEnrollment.EnrollmentStatus;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.repository.*;
import com.bsru.studentportal.service.AcademicRecordService;
import com.bsru.studentportal.service.GraduationAuditService;
import com.bsru.studentportal.service.NotificationService;
import com.bsru.studentportal.service.TimetableService;
import com.bsru.studentportal.service.TimetableService.Actor;
import com.bsru.studentportal.service.TimetableService.TimetableException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Adversarial Empirical Verification Suite for Milestone 5 (WP-5)
 * Verifies the Domain Notification Triggers and stress-tests edge cases:
 *
 * 1. Petition Submission: POST /api/petitions -> notifies advisor (targetModule = "advisor-petitions")
 * 2. Advisor Endorsement: PATCH /api/petitions/{id}/status -> notifies admin ("manage-petitions") and student ("petitions")
 * 3. Advisor Rejection: PATCH /api/petitions/{id}/status -> notifies student ("petitions")
 * 4. Admin Decision: Final approval/rejection -> notifies student ("petitions")
 * (Course registration no longer has an admin review step, so it sends no review notification.)
 */
@ExtendWith(MockitoExtension.class)
class DomainNotificationTriggerAdversarialTest {

    // Common Mocks
    @Mock
    private NotificationService notificationService;

    // ApiController Mocks
    @Mock
    private StudentRepository studentRepository;
    @Mock
    private AdvisorRepository advisorRepository;
    @Mock
    private AcademicPetitionRepository petitionRepository;
    @Mock
    private AcademicRecordService academicRecordService;
    @Mock
    private GraduationAuditService graduationAuditService;

    // TimetableService Mocks
    @Mock
    private ClassSectionRepository sectionRepository;
    @Mock
    private SectionEnrollmentRepository enrollmentRepository;
    @Mock
    private RegistrationPeriodRepository periodRepository;

    private ApiController apiController;
    private TimetableService timetableService;

    private Authentication studentAuth;
    private Authentication advisorAuth;
    private Authentication adminAuth;

    private Student student1;
    private Student student2;
    private Advisor advisor1;

    @BeforeEach
    void setUp() {
        apiController = new ApiController(
                studentRepository,
                advisorRepository,
                petitionRepository,
                academicRecordService,
                graduationAuditService,
                notificationService
        );

        timetableService = new TimetableService(
                sectionRepository,
                enrollmentRepository,
                periodRepository,
                studentRepository,
                advisorRepository,
                notificationService
        );

        studentAuth = new UsernamePasswordAuthenticationToken(
                "6621100042", "n/a", List.of(new SimpleGrantedAuthority("ROLE_STUDENT")));
        advisorAuth = new UsernamePasswordAuthenticationToken(
                "ADV-01", "n/a", List.of(new SimpleGrantedAuthority("ROLE_ADVISOR")));
        adminAuth = new UsernamePasswordAuthenticationToken(
                "admin", "n/a", List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));

        advisor1 = new Advisor("ADV-01", "ผศ.ดร.สมชาย ใจดี", "Somchai", "somchai@bsru.ac.th", "0812345678", "CS");

        student1 = new Student();
        student1.setStudentId("6621100042");
        student1.setNameTh("นายสมศักดิ์ ทดสอบ");
        student1.setAdvisor(advisor1);

        student2 = new Student();
        student2.setStudentId("6621100099");
        student2.setNameTh("นางสาวใจดี เรียนเก่ง");
        student2.setAdvisor(advisor1);
    }

    // =========================================================================
    // TRIGGER 1: Petition Submission -> Advisor Notification
    // =========================================================================
    @Nested
    @DisplayName("Trigger 1: POST /api/petitions -> Advisor Notification")
    class Trigger1_PetitionSubmission {

        @Test
        @DisplayName("1.1 Standard petition submission notifies student's advisor with targetModule='advisor-petitions'")
        void testPetitionSubmission_NotifiesAdvisor() {
            PetitionRequest request = new PetitionRequest();
            request.setTitle("ขอผ่อนผันค่าธรรมเนียมการศึกษา");
            request.setType("การเงิน");
            request.setDetails("เนื่องจากประสบปัญหาอุทกภัย");

            when(studentRepository.findById("6621100042")).thenReturn(Optional.of(student1));
            when(petitionRepository.findPetitionIdsStartingWith(anyString())).thenReturn(List.of());
            when(petitionRepository.existsById(anyString())).thenReturn(false);
            when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(i -> i.getArgument(0));

            ResponseEntity<?> res = apiController.submitPetition(request, studentAuth);
            assertEquals(HttpStatus.CREATED, res.getStatusCode());

            ArgumentCaptor<String> recipientCap = ArgumentCaptor.forClass(String.class);
            ArgumentCaptor<String> titleCap = ArgumentCaptor.forClass(String.class);
            ArgumentCaptor<String> msgCap = ArgumentCaptor.forClass(String.class);
            ArgumentCaptor<String> targetCap = ArgumentCaptor.forClass(String.class);
            ArgumentCaptor<String> typeCap = ArgumentCaptor.forClass(String.class);

            verify(notificationService, times(1)).notifyUser(
                    recipientCap.capture(),
                    titleCap.capture(),
                    msgCap.capture(),
                    targetCap.capture(),
                    typeCap.capture()
            );

            assertEquals("ADV-01", recipientCap.getValue(), "Recipient must be the student's advisor ID");
            assertEquals("advisor-petitions", targetCap.getValue(), "Target module must be advisor-petitions");
            assertEquals("PETITION", typeCap.getValue(), "Type must be PETITION");
            assertEquals("มีคำร้องใหม่รอการพิจารณา", titleCap.getValue());
            assertTrue(msgCap.getValue().contains("6621100042"), "Message must contain student ID");
            assertTrue(msgCap.getValue().contains("ขอผ่อนผันค่าธรรมเนียมการศึกษา"), "Message must contain petition title");
        }

        @Test
        @DisplayName("1.2 Edge case: Student has no advisor assigned -> petition succeeds without sending notification (no NPE)")
        void testPetitionSubmission_StudentWithoutAdvisor_SucceedsWithoutNotification() {
            student1.setAdvisor(null);

            PetitionRequest request = new PetitionRequest();
            request.setTitle("ขอหนังสือรับรอง");
            request.setType("เอกสาร");

            when(studentRepository.findById("6621100042")).thenReturn(Optional.of(student1));
            when(petitionRepository.findPetitionIdsStartingWith(anyString())).thenReturn(List.of());
            when(petitionRepository.existsById(anyString())).thenReturn(false);
            when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(i -> i.getArgument(0));

            ResponseEntity<?> res = apiController.submitPetition(request, studentAuth);
            assertEquals(HttpStatus.CREATED, res.getStatusCode());

            verify(notificationService, never()).notifyUser(any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("1.3 Edge case: Advisor object exists but advisorId is null -> gracefully avoids sending notification")
        void testPetitionSubmission_AdvisorIdNull_GracefullyAvoidsNotification() {
            Advisor emptyAdvisor = new Advisor();
            emptyAdvisor.setId(null);
            student1.setAdvisor(emptyAdvisor);

            PetitionRequest request = new PetitionRequest();
            request.setTitle("ขอหนังสือรับรอง");
            request.setType("เอกสาร");

            when(studentRepository.findById("6621100042")).thenReturn(Optional.of(student1));
            when(petitionRepository.findPetitionIdsStartingWith(anyString())).thenReturn(List.of());
            when(petitionRepository.existsById(anyString())).thenReturn(false);
            when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(i -> i.getArgument(0));

            ResponseEntity<?> res = apiController.submitPetition(request, studentAuth);
            assertEquals(HttpStatus.CREATED, res.getStatusCode());

            verify(notificationService, never()).notifyUser(any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("1.4 Edge case: Student nameTh is null -> notification falls back to student ID in message")
        void testPetitionSubmission_StudentNameNull_FallsBackToStudentIdInMessage() {
            student1.setNameTh(null);

            PetitionRequest request = new PetitionRequest();
            request.setTitle("ขอลาพักการเรียน");
            request.setType("วิชาการ");

            when(studentRepository.findById("6621100042")).thenReturn(Optional.of(student1));
            when(petitionRepository.findPetitionIdsStartingWith(anyString())).thenReturn(List.of());
            when(petitionRepository.existsById(anyString())).thenReturn(false);
            when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(i -> i.getArgument(0));

            ResponseEntity<?> res = apiController.submitPetition(request, studentAuth);
            assertEquals(HttpStatus.CREATED, res.getStatusCode());

            ArgumentCaptor<String> msgCap = ArgumentCaptor.forClass(String.class);
            verify(notificationService).notifyUser(any(), any(), msgCap.capture(), any(), any());

            assertTrue(msgCap.getValue().contains("นักศึกษา 6621100042 (6621100042)"));
        }
    }

    // =========================================================================
    // TRIGGER 2: Advisor Endorsement -> Admin & Student Notifications
    // =========================================================================
    @Nested
    @DisplayName("Trigger 2: Advisor Endorsement -> Admin & Student Notifications")
    class Trigger2_AdvisorEndorsement {

        @Test
        @DisplayName("2.1 Advisor endorses petition ('รอผู้ดูแลระบบอนุมัติ') -> notifies both admin and student")
        void testAdvisorEndorsement_NotifiesAdminAndStudent() {
            AcademicPetition petition = new AcademicPetition();
            petition.setId("PET-2569-001");
            petition.setTitle("ขอลงทะเบียนเรียนเกินหน่วยกิต");
            petition.setStatus("รออาจารย์ที่ปรึกษาพิจารณา");
            petition.setStudent(student1);

            when(petitionRepository.findById("PET-2569-001")).thenReturn(Optional.of(petition));
            when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(i -> i.getArgument(0));

            PetitionStatusUpdateRequest req = new PetitionStatusUpdateRequest("รอผู้ดูแลระบบอนุมัติ", "เห็นควรอนุญาตตามที่ขอ");
            ResponseEntity<?> res = apiController.updatePetitionStatus("PET-2569-001", req, advisorAuth);
            assertEquals(HttpStatus.OK, res.getStatusCode());

            ArgumentCaptor<String> recipientCap = ArgumentCaptor.forClass(String.class);
            ArgumentCaptor<String> titleCap = ArgumentCaptor.forClass(String.class);
            ArgumentCaptor<String> msgCap = ArgumentCaptor.forClass(String.class);
            ArgumentCaptor<String> targetCap = ArgumentCaptor.forClass(String.class);
            ArgumentCaptor<String> typeCap = ArgumentCaptor.forClass(String.class);

            verify(notificationService, times(2)).notifyUser(
                    recipientCap.capture(),
                    titleCap.capture(),
                    msgCap.capture(),
                    targetCap.capture(),
                    typeCap.capture()
            );

            List<String> recipients = recipientCap.getAllValues();
            List<String> titles = titleCap.getAllValues();
            List<String> targets = targetCap.getAllValues();

            // 1st notification: to admin
            assertEquals("admin", recipients.get(0));
            assertEquals("คำร้องรอการอนุมัติขั้นสุดท้าย", titles.get(0));
            assertEquals("manage-petitions", targets.get(0));

            // 2nd notification: to student
            assertEquals("6621100042", recipients.get(1));
            assertEquals("คำร้องผ่านการพิจารณาจากอาจารย์ที่ปรึกษาแล้ว", titles.get(1));
            assertEquals("petitions", targets.get(1));
        }

        @Test
        @DisplayName("2.2 Advisor endorsement comment mapping: falls back from advisorComment to comment to adminComment")
        void testAdvisorEndorsement_CommentFallbacks() {
            AcademicPetition petition = new AcademicPetition();
            petition.setId("PET-2569-002");
            petition.setTitle("ขอเทียบโอนรายวิชา");
            petition.setStatus("รออาจารย์ที่ปรึกษาพิจารณา");
            petition.setStudent(student1);

            when(petitionRepository.findById("PET-2569-002")).thenReturn(Optional.of(petition));
            when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(i -> i.getArgument(0));

            // Request with generic comment field
            PetitionStatusUpdateRequest req = new PetitionStatusUpdateRequest();
            req.setStatus("รอผู้ดูแลระบบอนุมัติ");
            req.setComment("ความเห็นในช่อง generic comment");

            ResponseEntity<?> res = apiController.updatePetitionStatus("PET-2569-002", req, advisorAuth);
            assertEquals(HttpStatus.OK, res.getStatusCode());

            AcademicPetition updated = (AcademicPetition) res.getBody();
            assertNotNull(updated);
            assertEquals("ความเห็นในช่อง generic comment", updated.getAdvisorComment());
        }
    }

    // =========================================================================
    // TRIGGER 3: Advisor Rejection -> Student Notification
    // =========================================================================
    @Nested
    @DisplayName("Trigger 3: Advisor Rejection -> Student Notification")
    class Trigger3_AdvisorRejection {

        @Test
        @DisplayName("3.1 Advisor rejects petition ('ไม่อนุมัติ') -> notifies student and does NOT notify admin")
        void testAdvisorRejection_NotifiesOnlyStudent() {
            AcademicPetition petition = new AcademicPetition();
            petition.setId("PET-2569-003");
            petition.setTitle("ขอเปลี่ยนวิชาเอก");
            petition.setStatus("รออาจารย์ที่ปรึกษาพิจารณา");
            petition.setStudent(student1);

            when(petitionRepository.findById("PET-2569-003")).thenReturn(Optional.of(petition));
            when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(i -> i.getArgument(0));

            PetitionStatusUpdateRequest req = new PetitionStatusUpdateRequest("ไม่อนุมัติ", "เกรดเฉลี่ยไม่ถึงเกณฑ์");
            ResponseEntity<?> res = apiController.updatePetitionStatus("PET-2569-003", req, advisorAuth);
            assertEquals(HttpStatus.OK, res.getStatusCode());

            ArgumentCaptor<String> recipientCap = ArgumentCaptor.forClass(String.class);
            ArgumentCaptor<String> titleCap = ArgumentCaptor.forClass(String.class);
            ArgumentCaptor<String> msgCap = ArgumentCaptor.forClass(String.class);
            ArgumentCaptor<String> targetCap = ArgumentCaptor.forClass(String.class);

            verify(notificationService, times(1)).notifyUser(
                    recipientCap.capture(),
                    titleCap.capture(),
                    msgCap.capture(),
                    targetCap.capture(),
                    eq("PETITION")
            );

            assertEquals("6621100042", recipientCap.getValue());
            assertEquals("คำร้องไม่ผ่านความเห็นชอบจากอาจารย์ที่ปรึกษา", titleCap.getValue());
            assertEquals("petitions", targetCap.getValue());
            assertTrue(msgCap.getValue().contains("เนื่องจาก: เกรดเฉลี่ยไม่ถึงเกณฑ์"));
        }

        @Test
        @DisplayName("3.2 Advisor rejects with 'ปฏิเสธ' synonym status -> behaves identically")
        void testAdvisorRejection_SynonymStatus() {
            AcademicPetition petition = new AcademicPetition();
            petition.setId("PET-2569-004");
            petition.setTitle("ขอยกเว้นค่าปรับ");
            petition.setStatus("รออาจารย์ที่ปรึกษาพิจารณา");
            petition.setStudent(student1);

            when(petitionRepository.findById("PET-2569-004")).thenReturn(Optional.of(petition));
            when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(i -> i.getArgument(0));

            PetitionStatusUpdateRequest req = new PetitionStatusUpdateRequest("ปฏิเสธ", "ยื่นพ้นกำหนดเวลา");
            ResponseEntity<?> res = apiController.updatePetitionStatus("PET-2569-004", req, advisorAuth);
            assertEquals(HttpStatus.OK, res.getStatusCode());

            verify(notificationService, times(1)).notifyUser(
                    eq("6621100042"),
                    eq("คำร้องไม่ผ่านความเห็นชอบจากอาจารย์ที่ปรึกษา"),
                    contains("เนื่องจาก: ยื่นพ้นกำหนดเวลา"),
                    eq("petitions"),
                    eq("PETITION")
            );
        }

        @Test
        @DisplayName("3.3 Advisor rejects without comment -> message omits 'เนื่องจาก:' cleanly")
        void testAdvisorRejection_WithoutComment_CleanMessage() {
            AcademicPetition petition = new AcademicPetition();
            petition.setId("PET-2569-005");
            petition.setTitle("ขอเอกสารด่วน");
            petition.setStatus("รออาจารย์ที่ปรึกษาพิจารณา");
            petition.setStudent(student1);

            when(petitionRepository.findById("PET-2569-005")).thenReturn(Optional.of(petition));
            when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(i -> i.getArgument(0));

            PetitionStatusUpdateRequest req = new PetitionStatusUpdateRequest("ไม่อนุมัติ", null);
            ResponseEntity<?> res = apiController.updatePetitionStatus("PET-2569-005", req, advisorAuth);
            assertEquals(HttpStatus.OK, res.getStatusCode());

            ArgumentCaptor<String> msgCap = ArgumentCaptor.forClass(String.class);
            verify(notificationService).notifyUser(any(), any(), msgCap.capture(), any(), any());

            assertFalse(msgCap.getValue().contains("เนื่องจาก:"));
            assertEquals("คำร้องของคุณ (ขอเอกสารด่วน) ไม่ได้รับความเห็นชอบจากอาจารย์ที่ปรึกษา", msgCap.getValue());
        }
    }

    // =========================================================================
    // TRIGGER 4: Admin Decision -> Final Approval/Rejection Notifications
    // =========================================================================
    @Nested
    @DisplayName("Trigger 4: Admin Decision -> Student Notifications")
    class Trigger4_AdminDecision {

        @Test
        @DisplayName("4.1 Admin approves petition ('อนุมัติ') -> notifies student with targetModule='petitions'")
        void testAdminApproval_NotifiesStudent() {
            AcademicPetition petition = new AcademicPetition();
            petition.setId("PET-2569-010");
            petition.setTitle("ขอผ่อนผันค่าเทอม");
            petition.setStatus("รอผู้ดูแลระบบอนุมัติ");
            petition.setStudent(student1);

            when(petitionRepository.findById("PET-2569-010")).thenReturn(Optional.of(petition));
            when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(i -> i.getArgument(0));

            PetitionStatusUpdateRequest req = new PetitionStatusUpdateRequest("อนุมัติ", "อนุมัติเรียบร้อย");
            ResponseEntity<?> res = apiController.updatePetitionStatus("PET-2569-010", req, adminAuth);
            assertEquals(HttpStatus.OK, res.getStatusCode());

            ArgumentCaptor<String> recipientCap = ArgumentCaptor.forClass(String.class);
            ArgumentCaptor<String> titleCap = ArgumentCaptor.forClass(String.class);
            ArgumentCaptor<String> targetCap = ArgumentCaptor.forClass(String.class);

            verify(notificationService, times(1)).notifyUser(
                    recipientCap.capture(),
                    titleCap.capture(),
                    anyString(),
                    targetCap.capture(),
                    eq("PETITION")
            );

            assertEquals("6621100042", recipientCap.getValue());
            assertEquals("คำร้องได้รับการอนุมัติแล้ว", titleCap.getValue());
            assertEquals("petitions", targetCap.getValue());
        }

        @Test
        @DisplayName("4.2 Admin rejects petition ('ไม่อนุมัติ') -> notifies student with reason")
        void testAdminRejection_NotifiesStudentWithReason() {
            AcademicPetition petition = new AcademicPetition();
            petition.setId("PET-2569-011");
            petition.setTitle("ขอเปิดรายวิชาเพิ่ม");
            petition.setStatus("รอผู้ดูแลระบบอนุมัติ");
            petition.setStudent(student1);

            when(petitionRepository.findById("PET-2569-011")).thenReturn(Optional.of(petition));
            when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(i -> i.getArgument(0));

            PetitionStatusUpdateRequest req = new PetitionStatusUpdateRequest("ไม่อนุมัติ", "จำนวนผู้เรียนไม่ครบตามเกณฑ์ขั้นต่ำ");
            ResponseEntity<?> res = apiController.updatePetitionStatus("PET-2569-011", req, adminAuth);
            assertEquals(HttpStatus.OK, res.getStatusCode());

            verify(notificationService, times(1)).notifyUser(
                    eq("6621100042"),
                    eq("คำร้องไม่ได้รับการอนุมัติ"),
                    contains("เนื่องจาก: จำนวนผู้เรียนไม่ครบตามเกณฑ์ขั้นต่ำ"),
                    eq("petitions"),
                    eq("PETITION")
            );
        }

        @Test
        @DisplayName("4.3 Admin rejects petition ('ปฏิเสธ') without comment -> notifies student without 'เนื่องจาก:'")
        void testAdminRejection_NoComment_CleanMessage() {
            AcademicPetition petition = new AcademicPetition();
            petition.setId("PET-2569-012");
            petition.setTitle("ขอเพิ่มรายวิชา");
            petition.setStatus("รอผู้ดูแลระบบอนุมัติ");
            petition.setStudent(student1);

            when(petitionRepository.findById("PET-2569-012")).thenReturn(Optional.of(petition));
            when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(i -> i.getArgument(0));

            PetitionStatusUpdateRequest req = new PetitionStatusUpdateRequest("ปฏิเสธ", "");
            ResponseEntity<?> res = apiController.updatePetitionStatus("PET-2569-012", req, adminAuth);
            assertEquals(HttpStatus.OK, res.getStatusCode());

            ArgumentCaptor<String> msgCap = ArgumentCaptor.forClass(String.class);
            verify(notificationService).notifyUser(any(), any(), msgCap.capture(), any(), any());

            assertFalse(msgCap.getValue().contains("เนื่องจาก:"));
            assertEquals("คำร้องของคุณ (ขอเพิ่มรายวิชา) ไม่ได้รับการอนุมัติจากผู้ดูแลระบบ", msgCap.getValue());
        }

        @Test
        @DisplayName("4.4 Edge case: Petition student is null -> admin decision updates status without NPE and skips notification")
        void testAdminDecision_NullStudent_SkipsNotificationWithoutCrash() {
            AcademicPetition orphanPetition = new AcademicPetition();
            orphanPetition.setId("PET-2569-099");
            orphanPetition.setTitle("คำร้องตกหล่น");
            orphanPetition.setStatus("รอผู้ดูแลระบบอนุมัติ");
            orphanPetition.setStudent(null);

            when(petitionRepository.findById("PET-2569-099")).thenReturn(Optional.of(orphanPetition));
            when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(i -> i.getArgument(0));

            PetitionStatusUpdateRequest req = new PetitionStatusUpdateRequest("อนุมัติ", "อนุมัติ");
            ResponseEntity<?> res = apiController.updatePetitionStatus("PET-2569-099", req, adminAuth);
            assertEquals(HttpStatus.OK, res.getStatusCode());

            verify(notificationService, never()).notifyUser(any(), any(), any(), any(), any());
        }
    }
}
