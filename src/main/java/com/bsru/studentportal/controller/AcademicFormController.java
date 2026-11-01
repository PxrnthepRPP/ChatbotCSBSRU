package com.bsru.studentportal.controller;

import com.bsru.studentportal.dto.FormAttachmentDto;
import com.bsru.studentportal.service.AcademicFormCatalogService;
import com.bsru.studentportal.service.AcademicFormCatalogService.AcademicFormInfo;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@RestController
@RequestMapping({"/api/forms", "/api/uploads/forms"})
@RequiredArgsConstructor
@Slf4j
public class AcademicFormController {

    private static final Path UPLOAD_FORMS_DIR = Paths.get("./uploads/forms").toAbsolutePath().normalize();

    private final AcademicFormCatalogService formCatalogService;

    /**
     * คัดลอกไฟล์แบบฟอร์ม PDF ทั้ง 16 ฉบับจาก classpath ไปยัง ./uploads/forms อัตโนมัติเมื่อเริ่มระบบ
     */
    @PostConstruct
    public void ensureFormsInUploadsDirectory() {
        try {
            if (!Files.exists(UPLOAD_FORMS_DIR)) {
                Files.createDirectories(UPLOAD_FORMS_DIR);
            }
            for (AcademicFormInfo form : formCatalogService.getAllForms()) {
                Path target = UPLOAD_FORMS_DIR.resolve(form.fileName()).normalize();
                if (target.startsWith(UPLOAD_FORMS_DIR) && !Files.exists(target)) {
                    ClassPathResource cp = new ClassPathResource("forms/" + form.fileName());
                    if (cp.exists()) {
                        try (InputStream is = cp.getInputStream()) {
                            Files.copy(is, target, StandardCopyOption.REPLACE_EXISTING);
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Could not seed forms into ./uploads/forms directory: {}", e.getMessage());
        }
    }

    @GetMapping
    public ResponseEntity<List<FormAttachmentDto>> listForms() {
        List<FormAttachmentDto> forms = formCatalogService.getAllForms().stream()
                .map(AcademicFormInfo::toAttachmentDto)
                .toList();
        return ResponseEntity.ok(forms);
    }

    @GetMapping("/{fileName:.+}")
    public ResponseEntity<?> getFormPdf(
            @PathVariable String fileName,
            @RequestParam(defaultValue = "false") boolean download
    ) {
        Optional<AcademicFormInfo> formOpt = formCatalogService.findByFileName(fileName);
        if (formOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "ไม่พบเอกสารแบบฟอร์มที่ระบุ: " + fileName));
        }

        AcademicFormInfo form = formOpt.get();
        Resource resource = resolveFormResource(form.fileName());
        if (resource == null || !resource.exists()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "ไม่พบไฟล์เอกสารในระบบ: " + form.fileName()));
        }

        ContentDisposition disposition = (download ? ContentDisposition.attachment() : ContentDisposition.inline())
                .filename(Objects.requireNonNull(form.downloadName()), StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .contentType(Objects.requireNonNull(MediaType.APPLICATION_PDF))
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .body(resource);
    }

    private Resource resolveFormResource(String safeFileName) {
        try {
            Path uploadFile = UPLOAD_FORMS_DIR.resolve(safeFileName).normalize();
            if (uploadFile.startsWith(UPLOAD_FORMS_DIR)) {
                if (!Files.exists(uploadFile)) {
                    ClassPathResource cp = new ClassPathResource("forms/" + safeFileName);
                    if (cp.exists()) {
                        Files.createDirectories(UPLOAD_FORMS_DIR);
                        try (InputStream is = cp.getInputStream()) {
                            Files.copy(is, uploadFile, StandardCopyOption.REPLACE_EXISTING);
                        }
                    }
                }
                if (Files.exists(uploadFile)) {
                    return new FileSystemResource(Objects.requireNonNull(uploadFile));
                }
            }
        } catch (Exception ignored) {}
        return new ClassPathResource("forms/" + safeFileName);
    }
}
