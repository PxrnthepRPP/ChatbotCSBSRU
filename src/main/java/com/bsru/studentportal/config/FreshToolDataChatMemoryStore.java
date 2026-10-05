package com.bsru.studentportal.config;

import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.data.message.ToolExecutionResultMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.store.memory.chat.ChatMemoryStore;
import dev.langchain4j.store.memory.chat.InMemoryChatMemoryStore;

import java.util.ArrayList;
import java.util.List;

/**
 * Chat memory that hides tool calls and tool results from earlier questions.
 *
 * Grades, timetables and registration status can be edited by admins and teachers at any time.
 * When old tool results stay in the history the model answers from them instead of calling the
 * tool again (seen in testing: a room that had been changed back was still reported). Only the
 * tool exchange of the question being answered right now is kept, so every question reads the
 * database again. The plain question/answer text of earlier turns is kept for conversation context.
 */
public class FreshToolDataChatMemoryStore implements ChatMemoryStore {

    private final InMemoryChatMemoryStore delegate = new InMemoryChatMemoryStore();

    @Override
    public List<ChatMessage> getMessages(Object memoryId) {
        List<ChatMessage> messages = delegate.getMessages(memoryId);
        int currentQuestion = -1;
        for (int i = messages.size() - 1; i >= 0; i--) {
            if (messages.get(i) instanceof UserMessage) {
                currentQuestion = i;
                break;
            }
        }

        List<ChatMessage> visible = new ArrayList<>(messages.size());
        for (int i = 0; i < messages.size(); i++) {
            ChatMessage m = messages.get(i);
            boolean earlierTurn = i < currentQuestion;
            boolean toolExchange = m instanceof ToolExecutionResultMessage
                    || (m instanceof AiMessage ai && ai.hasToolExecutionRequests());
            if (!(earlierTurn && toolExchange)) {
                visible.add(m);
            }
        }
        return visible;
    }

    @Override
    public void updateMessages(Object memoryId, List<ChatMessage> messages) {
        delegate.updateMessages(memoryId, messages);
    }

    @Override
    public void deleteMessages(Object memoryId) {
        delegate.deleteMessages(memoryId);
    }
}
