package com.bsru.studentportal.config;

import com.bsru.studentportal.ai.FreshToolDataChatMemoryStore;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.memory.chat.ChatMemoryProvider;
import dev.langchain4j.memory.chat.MessageWindowChatMemory;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.googleai.GoogleAiEmbeddingModel;
import dev.langchain4j.model.googleai.GoogleAiGeminiChatModel;
import dev.langchain4j.rag.content.retriever.ContentRetriever;
import dev.langchain4j.rag.content.retriever.EmbeddingStoreContentRetriever;
import dev.langchain4j.store.embedding.EmbeddingStore;
import dev.langchain4j.store.embedding.pgvector.PgVectorEmbeddingStore;
import dev.langchain4j.store.memory.chat.ChatMemoryStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

@Configuration
public class AiConfig {

    private static final int EMBEDDING_DIMENSION = 768;

    @Value("${gemini.api.key:demo-api-key}")
    private String geminiApiKey;

    @Value("${gemini.model-name:gemini-3.5-flash-lite}")
    private String modelName;

    @Value("${gemini.embedding-model-name:gemini-embedding-001}")
    private String embeddingModelName;

    // ใน Docker ให้ตั้ง PGVECTOR_HOST=database (ชื่อ service ใน docker-compose.yml)
    @Value("${pgvector.host:localhost}")
    private String pgvectorHost;

    @Value("${pgvector.port:5432}")
    private int pgvectorPort;

    @Value("${spring.datasource.username:bsru_admin}")
    private String dbUser;

    @Value("${spring.datasource.password:bsru_password}")
    private String dbPassword;

    @Bean
    public ChatLanguageModel chatLanguageModel() {
        return GoogleAiGeminiChatModel.builder()
                .apiKey(geminiApiKey)
                .modelName(modelName)
                .temperature(0.2)
                // Gemini 3.x นับ token ที่ใช้ "คิด" รวมในเพดานนี้ด้วย ถ้าตั้งต่ำ คำตอบยาวจะถูกตัดกลางคัน
                .maxOutputTokens(8192)
                // ค่าเริ่มต้นของ library คือ 10 วินาที ซึ่งสั้นเกินไปสำหรับโมเดลที่คิดก่อนตอบ
                .timeout(Duration.ofSeconds(60))
                // ลองใหม่อัตโนมัติเมื่อ Gemini ตอบ 503 (คนใช้เยอะชั่วคราว)
                .maxRetries(3)
                .build();
    }

    @Bean
    public EmbeddingModel embeddingModel() {
        return GoogleAiEmbeddingModel.builder()
                .apiKey(geminiApiKey)
                .modelName(embeddingModelName)
                // gemini-embedding-001 คืน 3072 มิติเป็นค่าเริ่มต้น บังคับให้เป็น 768 ให้ตรงกับตาราง bsru_embeddings เดิม
                .outputDimensionality(EMBEDDING_DIMENSION)
                .build();
    }

    @Bean
    public EmbeddingStore<TextSegment> embeddingStore() {
        return PgVectorEmbeddingStore.builder()
                .host(pgvectorHost)
                .port(pgvectorPort)
                .database("bsru_student_portal")
                .user(dbUser)
                .password(dbPassword)
                .table("bsru_embeddings")
                .dimension(EMBEDDING_DIMENSION)
                .build();
    }

    @Bean
    public ContentRetriever contentRetriever(
            EmbeddingStore<TextSegment> embeddingStore,
            EmbeddingModel embeddingModel) {
        return EmbeddingStoreContentRetriever.builder()
                .embeddingStore(embeddingStore)
                .embeddingModel(embeddingModel)
                .maxResults(3)
                .minScore(0.5)
                .build();
    }

    /** แยก store ออกมาเป็น bean เพื่อให้ ChatController ล้างประวัติแชทที่เสียได้ และซ่อนผลจาก tool ของคำถามก่อนๆ */
    @Bean
    public ChatMemoryStore chatMemoryStore() {
        return new FreshToolDataChatMemoryStore();
    }

    @Bean
    public ChatMemoryProvider chatMemoryProvider(ChatMemoryStore chatMemoryStore) {
        return memoryId -> MessageWindowChatMemory.builder()
                .id(memoryId)
                .maxMessages(20)
                .chatMemoryStore(chatMemoryStore)
                .build();
    }
}
