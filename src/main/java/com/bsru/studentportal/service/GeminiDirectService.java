package com.bsru.studentportal.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class GeminiDirectService {

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${gemini.api.key:demo-api-key}")
    private String geminiApiKey;

    @Value("${gemini.model-name:gemini-3.5-flash-lite}")
    private String primaryModel;

    public String generateContent(String systemInstruction, String userPrompt) throws Exception {
        String fullPrompt = (systemInstruction != null && !systemInstruction.isBlank())
                ? systemInstruction + "\n\n[คำถามของผู้ใช้]:\n" + userPrompt
                : userPrompt;

        List<String> modelsToTry = List.of(primaryModel, "gemini-3.5-flash-lite", "gemini-3.8-flash");

        Exception lastException = null;
        for (String model : modelsToTry) {
            try {
                log.info("Calling Gemini API with model: {}", model);
                return callGemini(model, fullPrompt);
            } catch (Exception e) {
                log.warn("Gemini model {} failed ({}). Attempting next model...", model, e.getMessage());
                lastException = e;
            }
        }
        throw lastException != null ? lastException : new RuntimeException("All Gemini models failed");
    }

    private String callGemini(String model, String prompt) throws Exception {
        String url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + geminiApiKey;

        Map<String, Object> payload = Map.of(
                "contents", List.of(
                        Map.of("parts", List.of(Map.of("text", prompt)))
                ),
                "generationConfig", Map.of(
                        "temperature", 0.3,
                        "maxOutputTokens", 4096
                )
        );

        String jsonBody = objectMapper.writeValueAsString(payload);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json; charset=UTF-8")
                .timeout(Duration.ofSeconds(45))
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            JsonNode errNode = objectMapper.readTree(response.body());
            String errMsg = errNode.path("error").path("message").asText(response.body());
            throw new RuntimeException("HTTP " + response.statusCode() + ": " + errMsg);
        }

        JsonNode root = objectMapper.readTree(response.body());
        JsonNode candidates = root.path("candidates");
        if (candidates.isArray() && !candidates.isEmpty()) {
            JsonNode parts = candidates.get(0).path("content").path("parts");
            if (parts.isArray() && !parts.isEmpty()) {
                for (JsonNode part : parts) {
                    if (part.has("text")) {
                        return part.get("text").asText();
                    }
                }
            }
        }
        throw new RuntimeException("No text in Gemini response: " + response.body());
    }
}
