package com.bsru.studentportal.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;

/**
 * In-memory sliding window rate limiter for POST /api/chat.
 * Limits users/IPs to at most 15 chat queries within a 60-second window
 * to protect Gemini API quota and prevent spam.
 */
@Slf4j
public class ChatRateLimitFilter extends OncePerRequestFilter {

    private static final int MAX_REQUESTS = 15;
    private static final long WINDOW_MS = 60_000L; // 60 seconds

    private final Map<String, Deque<Long>> requestLog = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        String uri = request.getRequestURI();
        if ("POST".equalsIgnoreCase(request.getMethod()) && uri != null && (uri.endsWith("/api/chat") || uri.endsWith("/api/chat/"))) {
            String clientKey = resolveClientKey(request);
            long now = System.currentTimeMillis();

            Deque<Long> timestamps = requestLog.computeIfAbsent(clientKey, k -> new ConcurrentLinkedDeque<>());
            boolean rateLimited = false;

            synchronized (timestamps) {
                while (!timestamps.isEmpty() && (now - timestamps.peekFirst() > WINDOW_MS)) {
                    timestamps.pollFirst();
                }

                if (timestamps.size() >= MAX_REQUESTS) {
                    rateLimited = true;
                } else {
                    timestamps.addLast(now);
                }
            }

            if (rateLimited) {
                log.warn("Rate limit exceeded for client: {}", clientKey);
                response.setStatus(429); // 429 Too Many Requests
                response.setContentType("application/json;charset=UTF-8");
                response.setCharacterEncoding("UTF-8");
                response.getWriter().write("{\"error\":\"คุณส่งข้อความถี่เกินไป กรุณารอสักครู่ (Rate limit exceeded)\"}");
                return;
            }

            // Periodic cleanup if map grows large (> 2000 active clients)
            if (requestLog.size() > 2000) {
                cleanStaleClients(now);
            }
        }

        filterChain.doFilter(request, response);
    }

    private String resolveClientKey(HttpServletRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equalsIgnoreCase(auth.getName())) {
            return "user:" + auth.getName();
        }

        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            for (String part : xff.split(",")) {
                String candidate = part.trim();
                if (!candidate.isBlank() && !"unknown".equalsIgnoreCase(candidate)) {
                    if (candidate.contains(":") && !candidate.contains("::")) {
                        candidate = candidate.split(":")[0];
                    }
                    return "ip:" + candidate;
                }
            }
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return "ip:" + realIp.trim();
        }
        String remoteAddr = request.getRemoteAddr();
        return "ip:" + (remoteAddr != null && !remoteAddr.isBlank() ? remoteAddr.trim() : "unknown");
    }

    private void cleanStaleClients(long now) {
        requestLog.entrySet().removeIf(entry -> {
            Deque<Long> queue = entry.getValue();
            synchronized (queue) {
                while (!queue.isEmpty() && (now - queue.peekFirst() > WINDOW_MS)) {
                    queue.pollFirst();
                }
                return queue.isEmpty();
            }
        });
    }
}

