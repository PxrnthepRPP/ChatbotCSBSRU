package com.bsru.studentportal.controller;

import com.bsru.studentportal.model.AdvisingNote;
import com.bsru.studentportal.model.Advisor;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.repository.AdvisingNoteRepository;
import com.bsru.studentportal.repository.AdvisorRepository;
import com.bsru.studentportal.repository.StudentRepository;
import com.bsru.studentportal.service.AdvisorInsightService;
import com.bsru.studentportal.service.StudentAdminService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdvisorNotesTest {

    @Mock
    private AdvisorInsightService insights;
    @Mock
    private AdvisorRepository advisorRepository;
    @Mock
    private StudentAdminService studentAdminService;
    @Mock
    private AdvisingNoteRepository advisingNoteRepository;
    @Mock
    private StudentRepository studentRepository;

    private AdvisorController advisorController;

    private Authentication advisorAuth;
    private Authentication studentAuth;
    private Authentication adminAuth;

    private final String studentId = "6421100042";
    private final String otherStudentId = "6421100099";
    private final String advisorId = "ADV-01";
    private final String otherAdvisorId = "ADV-02";

    private Student adviseeStudent;
    private Student otherAdviseeStudent;
    private Advisor advisor;
    private Advisor otherAdvisor;

    @BeforeEach
    void setUp() {
        advisorController = new AdvisorController(
                insights,
                advisorRepository,
                studentAdminService,
                advisingNoteRepository,
                studentRepository
        );

        advisorAuth = new UsernamePasswordAuthenticationToken(
                "advisor", "n/a", List.of(new SimpleGrantedAuthority("ROLE_ADVISOR")));
        studentAuth = new UsernamePasswordAuthenticationToken(
                studentId, "n/a", List.of(new SimpleGrantedAuthority("ROLE_STUDENT")));
        adminAuth = new UsernamePasswordAuthenticationToken(
                "admin", "n/a", List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));

        advisor = new Advisor(advisorId, "อ.วิชัย", "Wichai", "wichai@bsru.ac.th", "0812345678", "วิทยาการคอมพิวเตอร์");
        otherAdvisor = new Advisor(otherAdvisorId, "อ.สุภา", "Supa", "supa@bsru.ac.th", "0812345679", "วิทยาการคอมพิวเตอร์");

        adviseeStudent = new Student();
        adviseeStudent.setStudentId(studentId);
        adviseeStudent.setNameTh("สมชาย ใจดี");
        adviseeStudent.setAdvisor(advisor);

        otherAdviseeStudent = new Student();
        otherAdviseeStudent.setStudentId(otherStudentId);
        otherAdviseeStudent.setNameTh("สมหญิง รักดี");
        otherAdviseeStudent.setAdvisor(otherAdvisor);
    }

    @Test
    @DisplayName("List Notes: Advisor can view advising notes of their own advisee")
    void testListNotes_byAdvisorForAdvisee_returns200AndList() {
        when(studentRepository.findById(studentId)).thenReturn(Optional.of(adviseeStudent));

        AdvisingNote note = new AdvisingNote(1L, studentId, advisorId, "ติดตามผลการเรียน", LocalDate.of(2026, 11, 20), "NORMAL", LocalDateTime.now());
        when(advisingNoteRepository.findByStudentIdOrderByCreatedAtDesc(studentId)).thenReturn(List.of(note));

        ResponseEntity<?> response = advisorController.listNotes(studentId, advisorAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<?> list = assertInstanceOf(List.class, Objects.requireNonNull(response.getBody()));
        assertEquals(1, list.size());
    }

    @Test
    @DisplayName("List Notes: Student attempting to access notes endpoint receives 403 Forbidden")
    void testListNotes_byStudent_returns403Forbidden() {
        ResponseEntity<?> response = advisorController.listNotes(studentId, studentAuth);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verify(advisingNoteRepository, never()).findByStudentIdOrderByCreatedAtDesc(anyString());
    }

    @Test
    @DisplayName("List Notes: Advisor viewing advisee of another advisor receives 404 Not Found")
    void testListNotes_byAdvisorForNonAdvisee_returns404NotFound() {
        when(studentRepository.findById(otherStudentId)).thenReturn(Optional.of(otherAdviseeStudent));

        ResponseEntity<?> response = advisorController.listNotes(otherStudentId, advisorAuth);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(advisingNoteRepository, never()).findByStudentIdOrderByCreatedAtDesc(anyString());
    }

    @Test
    @DisplayName("Create Note: Advisor can create a consultation note for advisee returning 201 Created")
    void testCreateNote_byAdvisor_returns201CreatedWithId() {
        when(studentRepository.findById(studentId)).thenReturn(Optional.of(adviseeStudent));

        AdvisingNote saved = new AdvisingNote(10L, studentId, advisorId, "วางแผนลงทะเบียนวิชาโครงงาน", LocalDate.of(2026, 12, 1), "NORMAL", LocalDateTime.now());
        when(advisingNoteRepository.save(any(AdvisingNote.class))).thenReturn(saved);

        Map<String, Object> body = Map.of(
                "summary", "วางแผนลงทะเบียนวิชาโครงงาน",
                "followUpDate", "2026-12-01",
                "riskLevelSnapshot", "NORMAL"
        );

        ResponseEntity<?> response = advisorController.createNote(studentId, body, advisorAuth);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        AdvisingNote result = (AdvisingNote) response.getBody();
        assertNotNull(result);
        assertEquals(10L, result.getId());
        assertEquals("วางแผนลงทะเบียนวิชาโครงงาน", result.getSummary());
    }

    @Test
    @DisplayName("Create Note: Blank summary returns 400 Bad Request")
    void testCreateNote_withBlankSummary_returns400BadRequest() {
        when(studentRepository.findById(studentId)).thenReturn(Optional.of(adviseeStudent));

        Map<String, Object> body = Map.of("summary", "   ");
        ResponseEntity<?> response = advisorController.createNote(studentId, body, advisorAuth);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(advisingNoteRepository, never()).save(any());
    }

    @Test
    @DisplayName("Create Note: Invalid follow up date format returns 400 Bad Request")
    void testCreateNote_withInvalidFollowUpDate_returns400BadRequest() {
        when(studentRepository.findById(studentId)).thenReturn(Optional.of(adviseeStudent));

        Map<String, Object> body = Map.of(
                "summary", "ติดตามความคืบหน้า",
                "followUpDate", "not-a-valid-date"
        );
        ResponseEntity<?> response = advisorController.createNote(studentId, body, advisorAuth);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(advisingNoteRepository, never()).save(any());
    }

    @Test
    @DisplayName("Create Note: Student calling returns 403 Forbidden")
    void testCreateNote_byStudent_returns403Forbidden() {
        Map<String, Object> body = Map.of("summary", "นักศึกษาพยายามบันทึก");
        ResponseEntity<?> response = advisorController.createNote(studentId, body, studentAuth);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verify(advisingNoteRepository, never()).save(any());
    }

    @Test
    @DisplayName("Delete Note: Advisor can delete note belonging to advisee")
    void testDeleteNote_byAdvisor_returns200Ok() {
        when(studentRepository.findById(studentId)).thenReturn(Optional.of(adviseeStudent));

        AdvisingNote note = new AdvisingNote(5L, studentId, advisorId, "โน้ตเก่า", null, null, LocalDateTime.now());
        when(advisingNoteRepository.findById(5L)).thenReturn(Optional.of(note));

        ResponseEntity<?> response = advisorController.deleteNote(studentId, 5L, advisorAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(advisingNoteRepository, times(1)).delete(note);
    }

    @Test
    @DisplayName("Delete Note: Non-existent note returns 404 Not Found")
    void testDeleteNote_nonExistent_returns404NotFound() {
        when(studentRepository.findById(studentId)).thenReturn(Optional.of(adviseeStudent));
        when(advisingNoteRepository.findById(999L)).thenReturn(Optional.empty());

        ResponseEntity<?> response = advisorController.deleteNote(studentId, 999L, advisorAuth);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(advisingNoteRepository, never()).delete(any());
    }

    @Test
    @DisplayName("Admin Access: Admin can view and create notes for any student")
    void testAdminAccess_canViewAndCreateNotes() {
        when(studentRepository.existsById(studentId)).thenReturn(true);
        when(advisingNoteRepository.findByStudentIdOrderByCreatedAtDesc(studentId)).thenReturn(List.of());

        ResponseEntity<?> listResp = advisorController.listNotes(studentId, adminAuth);
        assertEquals(HttpStatus.OK, listResp.getStatusCode());

        when(studentRepository.findById(studentId)).thenReturn(Optional.of(adviseeStudent));
        AdvisingNote saved = new AdvisingNote(20L, studentId, advisorId, "Admin Note", null, null, LocalDateTime.now());
        when(advisingNoteRepository.save(any(AdvisingNote.class))).thenReturn(saved);

        ResponseEntity<?> createResp = advisorController.createNote(studentId, Map.of("summary", "Admin Note"), adminAuth);
        assertEquals(HttpStatus.CREATED, createResp.getStatusCode());
    }
}
