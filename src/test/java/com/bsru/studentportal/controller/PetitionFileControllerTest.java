package com.bsru.studentportal.controller;

import com.bsru.studentportal.model.AcademicPetition;
import com.bsru.studentportal.model.Advisor;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.repository.AcademicPetitionRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PetitionFileControllerTest {

    @Mock
    private AcademicPetitionRepository petitionRepository;

    @InjectMocks
    private PetitionFileController controller;

    private Authentication studentAuth;
    private Authentication otherStudentAuth;
    private Authentication advisorAuth;
    private Authentication otherAdvisorAuth;
    private Authentication adminAuth;

    private Student student1;
    private Advisor advisor1;
    private AcademicPetition petition1;

    private static final byte[] VALID_PDF_BYTES = "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n".getBytes();

    @BeforeEach
    void setUp() {
        studentAuth = new UsernamePasswordAuthenticationToken(
                "6421100042", "n/a", List.of(new SimpleGrantedAuthority("ROLE_STUDENT")));

        otherStudentAuth = new UsernamePasswordAuthenticationToken(
                "6421100099", "n/a", List.of(new SimpleGrantedAuthority("ROLE_STUDENT")));

        advisorAuth = new UsernamePasswordAuthenticationToken(
                "ADV-01", "n/a", List.of(new SimpleGrantedAuthority("ROLE_ADVISOR")));

        otherAdvisorAuth = new UsernamePasswordAuthenticationToken(
                "ADV-02", "n/a", List.of(new SimpleGrantedAuthority("ROLE_ADVISOR")));

        adminAuth = new UsernamePasswordAuthenticationToken(
                "admin", "n/a", List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));

        advisor1 = new Advisor("ADV-01", "ผศ.ดร.สมชาย", "Somchai", "somchai@bsru.ac.th", "0812345678", "CS");

        student1 = new Student();
        student1.setStudentId("6421100042");
        student1.setNameTh("สมหมาย ปรีชา");
        student1.setAdvisor(advisor1);

        petition1 = new AcademicPetition();
        petition1.setId("PET-2569-001");
        petition1.setTitle("คำร้องขอลงทะเบียนเกินหน่วยกิต");
        petition1.setType("ลงทะเบียน");
        petition1.setStatus("รออาจารย์ที่ปรึกษาพิจารณา");
        petition1.setStudent(student1);
    }

    @AfterEach
    void tearDown() {
        try {
            Files.deleteIfExists(Paths.get("./uploads/petitions/PET-2569-001.pdf"));
        } catch (IOException ignored) {}
    }

    // =========================================================================
    // POST /api/petitions/{id}/attachment Tests
    // =========================================================================

    @Test
    @DisplayName("Upload: Owner student can successfully upload valid PDF attachment")
    void testUploadAttachment_OwnerStudent_Success() {
        when(petitionRepository.findById("PET-2569-001")).thenReturn(Optional.of(petition1));
        when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(inv -> inv.getArgument(0));

        MockMultipartFile file = new MockMultipartFile(
                "file", "proposal.pdf", "application/pdf", VALID_PDF_BYTES);

        ResponseEntity<?> response = controller.uploadAttachment("PET-2569-001", file, null, studentAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(petitionRepository).save(petition1);
        assertEquals("proposal.pdf", petition1.getAttachmentName());
        assertNotNull(petition1.getAttachmentPath());
    }

    @Test
    @DisplayName("Upload: Admin can successfully upload valid PDF attachment on behalf of student")
    void testUploadAttachment_Admin_Success() {
        when(petitionRepository.findById("PET-2569-001")).thenReturn(Optional.of(petition1));
        when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(inv -> inv.getArgument(0));

        MockMultipartFile file = new MockMultipartFile(
                "attachment", "admin_upload.pdf", "application/pdf", VALID_PDF_BYTES);

        ResponseEntity<?> response = controller.uploadAttachment("PET-2569-001", null, file, adminAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(petitionRepository).save(petition1);
        assertEquals("admin_upload.pdf", petition1.getAttachmentName());
    }

    @Test
    @DisplayName("Upload: Cross-student upload attempt returns 403 Forbidden")
    void testUploadAttachment_CrossStudent_Returns403() {
        when(petitionRepository.findById("PET-2569-001")).thenReturn(Optional.of(petition1));

        MockMultipartFile file = new MockMultipartFile(
                "file", "spoof.pdf", "application/pdf", VALID_PDF_BYTES);

        ResponseEntity<?> response = controller.uploadAttachment("PET-2569-001", file, null, otherStudentAuth);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verify(petitionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Upload: Non-existent petition ID returns 404 Not Found")
    void testUploadAttachment_NotFound_Returns404() {
        when(petitionRepository.findById("PET-NONEXISTENT")).thenReturn(Optional.empty());

        MockMultipartFile file = new MockMultipartFile(
                "file", "proposal.pdf", "application/pdf", VALID_PDF_BYTES);

        ResponseEntity<?> response = controller.uploadAttachment("PET-NONEXISTENT", file, null, studentAuth);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(petitionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Upload: Empty file payload returns 400 Bad Request")
    void testUploadAttachment_EmptyFile_Returns400() {
        when(petitionRepository.findById("PET-2569-001")).thenReturn(Optional.of(petition1));

        MockMultipartFile emptyFile = new MockMultipartFile(
                "file", "empty.pdf", "application/pdf", new byte[0]);

        ResponseEntity<?> response = controller.uploadAttachment("PET-2569-001", emptyFile, null, studentAuth);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(petitionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Upload: Oversized file (> 5MB) returns 400 Bad Request")
    void testUploadAttachment_OversizedFile_Returns400() {
        when(petitionRepository.findById("PET-2569-001")).thenReturn(Optional.of(petition1));

        byte[] largeBytes = new byte[5 * 1024 * 1024 + 100]; // > 5MB
        System.arraycopy(VALID_PDF_BYTES, 0, largeBytes, 0, VALID_PDF_BYTES.length);

        MockMultipartFile largeFile = new MockMultipartFile(
                "file", "large.pdf", "application/pdf", largeBytes);

        ResponseEntity<?> response = controller.uploadAttachment("PET-2569-001", largeFile, null, studentAuth);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(petitionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Upload: Non-PDF extension (e.g. .txt) returns 400 Bad Request")
    void testUploadAttachment_NonPdfExtension_Returns400() {
        when(petitionRepository.findById("PET-2569-001")).thenReturn(Optional.of(petition1));

        MockMultipartFile textFile = new MockMultipartFile(
                "file", "notes.txt", "text/plain", "Not a PDF file".getBytes());

        ResponseEntity<?> response = controller.uploadAttachment("PET-2569-001", textFile, null, studentAuth);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(petitionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Upload: Corrupt magic bytes disguised as .pdf returns 400 Bad Request")
    void testUploadAttachment_InvalidMagicBytes_Returns400() {
        when(petitionRepository.findById("PET-2569-001")).thenReturn(Optional.of(petition1));

        byte[] fakePdfBytes = "FAKE_PDF_HEADER_CONTENT".getBytes();
        MockMultipartFile fakeFile = new MockMultipartFile(
                "file", "fake.pdf", "application/pdf", fakePdfBytes);

        ResponseEntity<?> response = controller.uploadAttachment("PET-2569-001", fakeFile, null, studentAuth);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(petitionRepository, never()).save(any());
    }

    // =========================================================================
    // GET /api/petitions/{id}/attachment Tests
    // =========================================================================

    @Test
    @DisplayName("Download: Owner student can download their uploaded attachment")
    void testGetAttachment_OwnerStudent_Success(@TempDir Path tempDir) throws IOException {
        Path testPdf = tempDir.resolve("test_doc.pdf");
        Files.write(testPdf, VALID_PDF_BYTES);

        petition1.setAttachmentPath(testPdf.toString());
        petition1.setAttachmentName("my_petition.pdf");

        when(petitionRepository.findById("PET-2569-001")).thenReturn(Optional.of(petition1));

        ResponseEntity<?> response = controller.getAttachment("PET-2569-001", studentAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(Objects.requireNonNull(response.getHeaders().getContentType()).toString().contains("application/pdf"));
        byte[] body = (byte[]) response.getBody();
        assertArrayEquals(VALID_PDF_BYTES, body);
    }

    @Test
    @DisplayName("Download: Assigned advisor can download advisee's attachment")
    void testGetAttachment_AssignedAdvisor_Success(@TempDir Path tempDir) throws IOException {
        Path testPdf = tempDir.resolve("advisor_view.pdf");
        Files.write(testPdf, VALID_PDF_BYTES);

        petition1.setAttachmentPath(testPdf.toString());
        petition1.setAttachmentName("advisor_view.pdf");

        when(petitionRepository.findById("PET-2569-001")).thenReturn(Optional.of(petition1));

        ResponseEntity<?> response = controller.getAttachment("PET-2569-001", advisorAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        byte[] body = (byte[]) response.getBody();
        assertArrayEquals(VALID_PDF_BYTES, body);
    }

    @Test
    @DisplayName("Download: Admin can download any student's attachment")
    void testGetAttachment_Admin_Success(@TempDir Path tempDir) throws IOException {
        Path testPdf = tempDir.resolve("admin_view.pdf");
        Files.write(testPdf, VALID_PDF_BYTES);

        petition1.setAttachmentPath(testPdf.toString());
        petition1.setAttachmentName("admin_view.pdf");

        when(petitionRepository.findById("PET-2569-001")).thenReturn(Optional.of(petition1));

        ResponseEntity<?> response = controller.getAttachment("PET-2569-001", adminAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        byte[] body = (byte[]) response.getBody();
        assertArrayEquals(VALID_PDF_BYTES, body);
    }

    @Test
    @DisplayName("Download: Cross-student download attempt returns 403 Forbidden")
    void testGetAttachment_CrossStudent_Returns403() {
        petition1.setAttachmentPath("./uploads/petitions/PET-2569-001.pdf");
        when(petitionRepository.findById("PET-2569-001")).thenReturn(Optional.of(petition1));

        ResponseEntity<?> response = controller.getAttachment("PET-2569-001", otherStudentAuth);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
    }

    @Test
    @DisplayName("Download: Cross-advisor download attempt returns 403 Forbidden")
    void testGetAttachment_CrossAdvisor_Returns403() {
        petition1.setAttachmentPath("./uploads/petitions/PET-2569-001.pdf");
        when(petitionRepository.findById("PET-2569-001")).thenReturn(Optional.of(petition1));

        ResponseEntity<?> response = controller.getAttachment("PET-2569-001", otherAdvisorAuth);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
    }

    @Test
    @DisplayName("Download: Petition not found returns 404 Not Found")
    void testGetAttachment_PetitionNotFound_Returns404() {
        when(petitionRepository.findById("PET-NOTFOUND")).thenReturn(Optional.empty());

        ResponseEntity<?> response = controller.getAttachment("PET-NOTFOUND", studentAuth);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }

    @Test
    @DisplayName("Download: File missing on disk returns 404 Not Found")
    void testGetAttachment_FileMissingOnDisk_Returns404() {
        petition1.setAttachmentPath("./uploads/petitions/non_existent_file_xyz.pdf");
        when(petitionRepository.findById("PET-2569-001")).thenReturn(Optional.of(petition1));

        ResponseEntity<?> response = controller.getAttachment("PET-2569-001", studentAuth);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }
}
