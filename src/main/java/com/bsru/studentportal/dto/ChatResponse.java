package com.bsru.studentportal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatResponse {
    private String reply;
    private String sessionId;

    @Builder.Default
    private List<String> sources = new ArrayList<>();

    @Builder.Default
    private List<FormAttachmentDto> attachments = new ArrayList<>();

    public ChatResponse(String reply, String sessionId, List<String> sources) {
        this.reply = reply;
        this.sessionId = sessionId;
        this.sources = sources != null ? sources : new ArrayList<>();
        this.attachments = new ArrayList<>();
    }
}
