package com.bsru.studentportal.controller;

import com.bsru.studentportal.model.AcademicPetition;
import com.bsru.studentportal.repository.AcademicPetitionRepository;
import com.bsru.studentportal.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/petitions")
@RequiredArgsConstructor
public class PetitionFileController {

    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    private static final Path UPLOAD_DIR = Paths.get("./uploads/petitions").toAbsolutePath().normalize();

    private final AcademicPetitionRepository petitionRepository;

    @PostMapping("/{id}/attachment")
    public ResponseEntity<?> uploadAttachment(
            @PathVariable String id,
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "attachment", required = false) MultipartFile attachment,
            Authentication authentication) {

        AcademicPetition petition = id != null ? petitionRepository.findById(id).orElse(null) : null;
        if (petition == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Petition not found with ID: " + id));
        }

        boolean isAdmin = CurrentUser.isAdmin(authentication);
        Optional<String> callerStudentId = CurrentUser.studentId(authentication);

        if (!isAdmin) {
            if (callerStudentId.isEmpty() || petition.getStudent() == null
                    || !callerStudentId.get().equals(petition.getStudent().getStudentId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "ไม่อนุญาตให้อัปโหลดไฟล์แนบสำหรับคำร้องของผู้อื่น"));
            }
        }

        MultipartFile uploadFile = file != null ? file : attachment;
        if (uploadFile == null || uploadFile.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "กรุณาเลือกไฟล์ PDF ที่ต้องการอัปโหลด"));
        }

        if (uploadFile.getSize() > MAX_FILE_SIZE) {
            return ResponseEntity.badRequest().body(Map.of("error", "ขนาดไฟล์ต้องไม่เกิน 5MB"));
        }

        String originalFilename = uploadFile.getOriginalFilename();
        if (originalFilename == null || !originalFilename.toLowerCase().endsWith(".pdf")) {
            return ResponseEntity.badRequest().body(Map.of("error", "ไฟล์ต้องมีนามสกุล .pdf เท่านั้น"));
        }

        // Validate PDF magic bytes: 0x25, 0x50, 0x44, 0x46 (%PDF)
        try (InputStream is = uploadFile.getInputStream()) {
            byte[] magic = new byte[4];
            int read = is.read(magic);
            if (read < 4 || magic[0] != 0x25 || magic[1] != 0x50 || magic[2] != 0x44 || magic[3] != 0x46) {
                return ResponseEntity.badRequest().body(Map.of("error", "ไฟล์ไม่ใช่เอกสาร PDF ที่ถูกต้อง"));
            }
        } catch (IOException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "ไม่สามารถอ่านไฟล์ได้"));
        }

        try {
            if (!Files.exists(UPLOAD_DIR)) {
                Files.createDirectories(UPLOAD_DIR);
            }

            String safeId = id.replaceAll("[^a-zA-Z0-9_-]", "_");
            Path targetPath = UPLOAD_DIR.resolve(safeId + ".pdf").normalize();
            if (!targetPath.startsWith(UPLOAD_DIR)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid path traversal attempt"));
            }

            try (InputStream copyStream = uploadFile.getInputStream()) {
                Files.copy(copyStream, targetPath, StandardCopyOption.REPLACE_EXISTING);
            }

            petition.setAttachmentPath(targetPath.toString());
            petition.setAttachmentName(originalFilename);
            petition.setAttachment(originalFilename);
            petitionRepository.save(petition);

            return ResponseEntity.ok(Map.of(
                    "message", "File uploaded successfully",
                    "petitionId", id,
                    "fileName", originalFilename,
                    "attachmentPath", targetPath.toString(),
                    "size", uploadFile.getSize()
            ));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "ไม่สามารถบันทึกไฟล์ได้: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}/attachment")
    public ResponseEntity<?> getAttachment(
            @PathVariable String id,
            Authentication authentication) {

        AcademicPetition petition = id != null ? petitionRepository.findById(id).orElse(null) : null;
        if (petition == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Petition not found with ID: " + id));
        }

        boolean isOwner = CurrentUser.studentId(authentication).isPresent()
                && petition.getStudent() != null
                && CurrentUser.studentId(authentication).get().equals(petition.getStudent().getStudentId());

        boolean isAdvisor = CurrentUser.advisorId(authentication).isPresent()
                && petition.getStudent() != null
                && petition.getStudent().getAdvisor() != null
                && CurrentUser.advisorId(authentication).get().equals(petition.getStudent().getAdvisor().getId());

        boolean isAdmin = CurrentUser.isAdmin(authentication);

        if (!isOwner && !isAdvisor && !isAdmin) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "ไม่อนุญาตให้เข้าถึงไฟล์แนบของคำร้องนี้"));
        }

        Path targetPath = null;
        if (petition.getAttachmentPath() != null && !petition.getAttachmentPath().isBlank()) {
            Path p = Paths.get(petition.getAttachmentPath()).normalize();
            if (Files.exists(p)) {
                targetPath = p;
            } else {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "ไม่พบไฟล์แนบสำหรับคำร้องนี้"));
            }
        } else {
            String safeId = id.replaceAll("[^a-zA-Z0-9_-]", "_");
            Path defaultPath = UPLOAD_DIR.resolve(safeId + ".pdf").normalize();
            if (Files.exists(defaultPath)) {
                targetPath = defaultPath;
            }
        }

        if (targetPath == null || !Files.exists(targetPath)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "ไม่พบไฟล์แนบสำหรับคำร้องนี้"));
        }

        try {
            byte[] content = Files.readAllBytes(targetPath);
            String fileName = petition.getAttachmentName() != null ? petition.getAttachmentName() : id + ".pdf";

            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_PDF)
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + fileName + "\"")
                    .body(content);
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "ไม่สามารถอ่านไฟล์แนบได้: " + e.getMessage()));
        }
    }
}
