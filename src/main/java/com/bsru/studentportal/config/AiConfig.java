package com.bsru.studentportal.config;

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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AiConfig {

    @Value("${gemini.api.key:demo-api-key}")
    private String geminiApiKey;

    @Value("${gemini.model-name:gemini-1.5-flash}")
    private String modelName;

    @Value("${gemini.embedding-model-name:text-embedding-004}")
    private String embeddingModelName;

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
                .maxOutputTokens(1024)
                .build();
    }

    @Bean
    public EmbeddingModel embeddingModel() {
        return GoogleAiEmbeddingModel.builder()
                .apiKey(geminiApiKey)
                .modelName(embeddingModelName)
                .build();
    }

    @Bean
    public EmbeddingStore<TextSegment> embeddingStore() {
        return PgVectorEmbeddingStore.builder()
                .host("localhost")
                .port(5432)
                .database("bsru_student_portal")
                .user(dbUser)
                .password(dbPassword)
                .table("bsru_embeddings")
                .dimension(768)
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

    @Bean
    public ChatMemoryProvider chatMemoryProvider() {
        return memoryId -> MessageWindowChatMemory.withMaxMessages(20);
    }
}
