package com.bsru.studentportal.dto;

public record FormAttachmentDto(
        String code,
        String title,
        String fileName,
        String downloadName,
        String summary
) {
}

