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
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PetitionFileAdversarialTest {

    @Mock
    private AcademicPetitionRepository petitionRepository;

    @InjectMocks
    private PetitionFileController controller;

    private Authentication studentAuth;
    private Authentication advisorAuth;

    private Student student1;
    private Advisor advisor1;
    private AcademicPetition petition1;

    private static final byte[] VALID_PDF_BYTES = "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n".getBytes();
    private static final Path UPLOAD_DIR = Paths.get("./uploads/petitions").toAbsolutePath().normalize();

    @BeforeEach
    void setUp() {
        studentAuth = new UsernamePasswordAuthenticationToken(
                "6621100042", "n/a", List.of(new SimpleGrantedAuthority("ROLE_STUDENT")));

        advisorAuth = new UsernamePasswordAuthenticationToken(
                "ADV-01", "n/a", List.of(new SimpleGrantedAuthority("ROLE_ADVISOR")));

        advisor1 = new Advisor("ADV-01", "ผศ.ดร.สมชาย", "Somchai", "somchai@bsru.ac.th", "0812345678", "CS");

        student1 = new Student();
        student1.setStudentId("6621100042");
        student1.setNameTh("สมหมาย ปรีชา");
        student1.setAdvisor(advisor1);

        petition1 = new AcademicPetition();
        petition1.setId("PET-2569-ADV01");
        petition1.setTitle("คำร้องทดสอบความปลอดภัย");
        petition1.setType("วิชาการ");
        petition1.setStatus("รออาจารย์ที่ปรึกษาพิจารณา");
        petition1.setStudent(student1);
    }

    @AfterEach
    void tearDown() {
        try {
            Files.deleteIfExists(UPLOAD_DIR.resolve("PET-2569-ADV01.pdf"));
            Files.deleteIfExists(UPLOAD_DIR.resolve("______etc_passwd.pdf"));
            Files.deleteIfExists(UPLOAD_DIR.resolve("PET_2569_MALICIOUS_CHARS.pdf"));
        } catch (IOException ignored) {}
    }

    // =========================================================================
    // 1. Boundary Size Tests (Exact 5MB vs 5MB + 1 byte)
    // =========================================================================

    @Test
    @DisplayName("Boundary: Exactly 5MB (5,242,880 bytes) valid PDF upload succeeds")
    void testUploadAttachment_Exactly5MB_Succeeds() {
        when(petitionRepository.findById("PET-2569-ADV01")).thenReturn(Optional.of(petition1));
        when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(inv -> inv.getArgument(0));

        byte[] exact5MB = new byte[5 * 1024 * 1024];
        System.arraycopy(VALID_PDF_BYTES, 0, exact5MB, 0, VALID_PDF_BYTES.length);

        MockMultipartFile file = new MockMultipartFile(
                "file", "boundary_5mb.pdf", "application/pdf", exact5MB);

        ResponseEntity<?> response = controller.uploadAttachment("PET-2569-ADV01", file, null, studentAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(petitionRepository).save(petition1);
    }

    @Test
    @DisplayName("Boundary: 5MB + 1 byte (5,242,881 bytes) is rejected with 400 Bad Request")
    void testUploadAttachment_5MBPlus1Byte_Returns400() {
        when(petitionRepository.findById("PET-2569-ADV01")).thenReturn(Optional.of(petition1));

        byte[] overflowBytes = new byte[5 * 1024 * 1024 + 1];
        System.arraycopy(VALID_PDF_BYTES, 0, overflowBytes, 0, VALID_PDF_BYTES.length);

        MockMultipartFile file = new MockMultipartFile(
                "file", "overflow.pdf", "application/pdf", overflowBytes);

        ResponseEntity<?> response = controller.uploadAttachment("PET-2569-ADV01", file, null, studentAuth);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertTrue(response.getBody().toString().contains("ขนาดไฟล์ต้องไม่เกิน 5MB"));
        verify(petitionRepository, never()).save(any());
    }

    // =========================================================================
    // 2. Short File Headers (1, 2, 3 bytes) Stress Testing
    // =========================================================================

    @Test
    @DisplayName("Magic bytes: 1 byte file is rejected with 400")
    void testUploadAttachment_1ByteFile_Returns400() {
        when(petitionRepository.findById("PET-2569-ADV01")).thenReturn(Optional.of(petition1));

        MockMultipartFile file = new MockMultipartFile(
                "file", "one_byte.pdf", "application/pdf", new byte[]{0x25}); // '%'

        ResponseEntity<?> response = controller.uploadAttachment("PET-2569-ADV01", file, null, studentAuth);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertTrue(response.getBody().toString().contains("ไม่ใช่เอกสาร PDF"));
        verify(petitionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Magic bytes: 2 bytes file is rejected with 400")
    void testUploadAttachment_2ByteFile_Returns400() {
        when(petitionRepository.findById("PET-2569-ADV01")).thenReturn(Optional.of(petition1));

        MockMultipartFile file = new MockMultipartFile(
                "file", "two_bytes.pdf", "application/pdf", new byte[]{0x25, 0x50}); // '%P'

        ResponseEntity<?> response = controller.uploadAttachment("PET-2569-ADV01", file, null, studentAuth);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(petitionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Magic bytes: 3 bytes file is rejected with 400")
    void testUploadAttachment_3ByteFile_Returns400() {
        when(petitionRepository.findById("PET-2569-ADV01")).thenReturn(Optional.of(petition1));

        MockMultipartFile file = new MockMultipartFile(
                "file", "three_bytes.pdf", "application/pdf", new byte[]{0x25, 0x50, 0x44}); // '%PD'

        ResponseEntity<?> response = controller.uploadAttachment("PET-2569-ADV01", file, null, studentAuth);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(petitionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Magic bytes: Exact 4 bytes '%PDF' succeeds")
    void testUploadAttachment_Exact4BytesPDF_Succeeds() {
        when(petitionRepository.findById("PET-2569-ADV01")).thenReturn(Optional.of(petition1));
        when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(inv -> inv.getArgument(0));

        MockMultipartFile file = new MockMultipartFile(
                "file", "min.pdf", "application/pdf", new byte[]{0x25, 0x50, 0x44, 0x46}); // '%PDF'

        ResponseEntity<?> response = controller.uploadAttachment("PET-2569-ADV01", file, null, studentAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(petitionRepository).save(petition1);
    }

    // =========================================================================
    // 3. Fake Magic Bytes (Disguised Images, Zip, Lowercase %pdf)
    // =========================================================================

    @Test
    @DisplayName("Magic bytes: Lowercase '%pdf' is rejected with 400")
    void testUploadAttachment_LowercasePdfMagic_Returns400() {
        when(petitionRepository.findById("PET-2569-ADV01")).thenReturn(Optional.of(petition1));

        byte[] lowercaseMagic = new byte[]{0x25, 0x70, 0x64, 0x66}; // '%pdf'
        MockMultipartFile file = new MockMultipartFile(
                "file", "lower.pdf", "application/pdf", lowercaseMagic);

        ResponseEntity<?> response = controller.uploadAttachment("PET-2569-ADV01", file, null, studentAuth);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(petitionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Magic bytes: PNG file disguised as .pdf is rejected with 400")
    void testUploadAttachment_DisguisedPng_Returns400() {
        when(petitionRepository.findById("PET-2569-ADV01")).thenReturn(Optional.of(petition1));

        byte[] pngHeader = new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
        MockMultipartFile file = new MockMultipartFile(
                "file", "disguised.pdf", "application/pdf", pngHeader);

        ResponseEntity<?> response = controller.uploadAttachment("PET-2569-ADV01", file, null, studentAuth);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(petitionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Magic bytes: ZIP file disguised as .pdf is rejected with 400")
    void testUploadAttachment_DisguisedZip_Returns400() {
        when(petitionRepository.findById("PET-2569-ADV01")).thenReturn(Optional.of(petition1));

        byte[] zipHeader = new byte[]{0x50, 0x4B, 0x03, 0x04}; // PK\x03\x04
        MockMultipartFile file = new MockMultipartFile(
                "file", "archive.pdf", "application/pdf", zipHeader);

        ResponseEntity<?> response = controller.uploadAttachment("PET-2569-ADV01", file, null, studentAuth);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(petitionRepository, never()).save(any());
    }

    // =========================================================================
    // 4. Filename & Extension Variations
    // =========================================================================

    @Test
    @DisplayName("Extension: Uppercase .PDF succeeds")
    void testUploadAttachment_UppercaseExtension_Succeeds() {
        when(petitionRepository.findById("PET-2569-ADV01")).thenReturn(Optional.of(petition1));
        when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(inv -> inv.getArgument(0));

        MockMultipartFile file = new MockMultipartFile(
                "file", "REPORT.PDF", "application/pdf", VALID_PDF_BYTES);

        ResponseEntity<?> response = controller.uploadAttachment("PET-2569-ADV01", file, null, studentAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(petitionRepository).save(petition1);
    }

    @Test
    @DisplayName("Extension: Mixed-case .Pdf succeeds")
    void testUploadAttachment_MixedCaseExtension_Succeeds() {
        when(petitionRepository.findById("PET-2569-ADV01")).thenReturn(Optional.of(petition1));
        when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(inv -> inv.getArgument(0));

        MockMultipartFile file = new MockMultipartFile(
                "file", "Document.Pdf", "application/pdf", VALID_PDF_BYTES);

        ResponseEntity<?> response = controller.uploadAttachment("PET-2569-ADV01", file, null, studentAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(petitionRepository).save(petition1);
    }

    @Test
    @DisplayName("Extension: Double extension ending in .exe (.pdf.exe) returns 400")
    void testUploadAttachment_DoubleExtensionExe_Returns400() {
        when(petitionRepository.findById("PET-2569-ADV01")).thenReturn(Optional.of(petition1));

        MockMultipartFile file = new MockMultipartFile(
                "file", "malware.pdf.exe", "application/octet-stream", VALID_PDF_BYTES);

        ResponseEntity<?> response = controller.uploadAttachment("PET-2569-ADV01", file, null, studentAuth);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(petitionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Extension: Null filename returns 400")
    void testUploadAttachment_NullFilename_Returns400() {
        when(petitionRepository.findById("PET-2569-ADV01")).thenReturn(Optional.of(petition1));

        MockMultipartFile file = new MockMultipartFile(
                "file", null, "application/pdf", VALID_PDF_BYTES);

        ResponseEntity<?> response = controller.uploadAttachment("PET-2569-ADV01", file, null, studentAuth);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(petitionRepository, never()).save(any());
    }

    // =========================================================================
    // 5. Parameter Name Flexibility (file vs attachment vs null)
    // =========================================================================

    @Test
    @DisplayName("Params: Upload via 'attachment' parameter succeeds")
    void testUploadAttachment_UsingAttachmentParam_Succeeds() {
        when(petitionRepository.findById("PET-2569-ADV01")).thenReturn(Optional.of(petition1));
        when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(inv -> inv.getArgument(0));

        MockMultipartFile attachment = new MockMultipartFile(
                "attachment", "evidence.pdf", "application/pdf", VALID_PDF_BYTES);

        ResponseEntity<?> response = controller.uploadAttachment("PET-2569-ADV01", null, attachment, studentAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(petitionRepository).save(petition1);
    }

    @Test
    @DisplayName("Params: Both 'file' and 'attachment' null returns 400")
    void testUploadAttachment_BothParamsNull_Returns400() {
        when(petitionRepository.findById("PET-2569-ADV01")).thenReturn(Optional.of(petition1));

        ResponseEntity<?> response = controller.uploadAttachment("PET-2569-ADV01", null, null, studentAuth);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(petitionRepository, never()).save(any());
    }

    // =========================================================================
    // 6. Adversarial Authorization: Advisor Upload Forbidden
    // =========================================================================

    @Test
    @DisplayName("Auth: Assigned advisor attempting to upload attachment for advisee returns 403 Forbidden")
    void testUploadAttachment_AdvisorAttempt_Returns403() {
        when(petitionRepository.findById("PET-2569-ADV01")).thenReturn(Optional.of(petition1));

        MockMultipartFile file = new MockMultipartFile(
                "file", "advisor_upload.pdf", "application/pdf", VALID_PDF_BYTES);

        ResponseEntity<?> response = controller.uploadAttachment("PET-2569-ADV01", file, null, advisorAuth);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verify(petitionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Auth: Unauthenticated caller attempting upload returns 403 Forbidden")
    void testUploadAttachment_Unauthenticated_Returns403() {
        when(petitionRepository.findById("PET-2569-ADV01")).thenReturn(Optional.of(petition1));

        MockMultipartFile file = new MockMultipartFile(
                "file", "doc.pdf", "application/pdf", VALID_PDF_BYTES);

        ResponseEntity<?> response = controller.uploadAttachment("PET-2569-ADV01", file, null, null);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verify(petitionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Auth: Unauthenticated caller attempting download returns 403 Forbidden")
    void testGetAttachment_Unauthenticated_Returns403() {
        when(petitionRepository.findById("PET-2569-ADV01")).thenReturn(Optional.of(petition1));

        ResponseEntity<?> response = controller.getAttachment("PET-2569-ADV01", null);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
    }

    // =========================================================================
    // 7. Path Traversal & ID Sanitization Stress Test
    // =========================================================================

    @Test
    @DisplayName("Sanitization: Malicious path traversal ID is sanitized and confined to UPLOAD_DIR")
    void testUploadAttachment_PathTraversalId_IsSanitizedSafely() {
        AcademicPetition maliciousIdPetition = new AcademicPetition();
        maliciousIdPetition.setId("../../etc/passwd");
        maliciousIdPetition.setStudent(student1);

        when(petitionRepository.findById("../../etc/passwd")).thenReturn(Optional.of(maliciousIdPetition));
        when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(inv -> inv.getArgument(0));

        MockMultipartFile file = new MockMultipartFile(
                "file", "doc.pdf", "application/pdf", VALID_PDF_BYTES);

        ResponseEntity<?> response = controller.uploadAttachment("../../etc/passwd", file, null, studentAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(petitionRepository).save(maliciousIdPetition);
        // The saved path must be inside UPLOAD_DIR and sanitized
        assertTrue(maliciousIdPetition.getAttachmentPath().startsWith(UPLOAD_DIR.toString()));
        assertTrue(maliciousIdPetition.getAttachmentPath().contains("______etc_passwd.pdf"));
    }

    @Test
    @DisplayName("Sanitization: Special injection characters in ID are replaced by underscores")
    void testUploadAttachment_SpecialCharsInId_SanitizedSafely() {
        AcademicPetition specialCharsPetition = new AcademicPetition();
        specialCharsPetition.setId("PET:2569;MALICIOUS?CHARS");
        specialCharsPetition.setStudent(student1);

        when(petitionRepository.findById("PET:2569;MALICIOUS?CHARS")).thenReturn(Optional.of(specialCharsPetition));
        when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(inv -> inv.getArgument(0));

        MockMultipartFile file = new MockMultipartFile(
                "file", "doc.pdf", "application/pdf", VALID_PDF_BYTES);

        ResponseEntity<?> response = controller.uploadAttachment("PET:2569;MALICIOUS?CHARS", file, null, studentAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(specialCharsPetition.getAttachmentPath().startsWith(UPLOAD_DIR.toString()));
        assertTrue(specialCharsPetition.getAttachmentPath().contains("PET_2569_MALICIOUS_CHARS.pdf"));
    }
}
