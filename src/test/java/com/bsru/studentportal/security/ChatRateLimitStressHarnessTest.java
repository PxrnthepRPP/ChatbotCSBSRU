package com.bsru.studentportal.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.lang.reflect.Field;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

class ChatRateLimitStressHarnessTest {

    private ChatRateLimitFilter filter;

    @BeforeEach
    void setUp() {
        filter = new ChatRateLimitFilter();
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("Stress Harness: Staggered sliding window sliding across sub-windows")
    void testStaggeredSlidingWindowPrecision() throws Exception {
        String testIp = "192.168.100.5";
        String clientKey = "ip:" + testIp;

        Field field = ChatRateLimitFilter.class.getDeclaredField("requestLog");
        field.setAccessible(true);
        @SuppressWarnings("unchecked")
        Map<String, Deque<Long>> log = (Map<String, Deque<Long>>) field.get(filter);

        long now = System.currentTimeMillis();

        // Simulate 3 bursts of 5 requests across the past 50 seconds:
        // Burst 1: 5 requests at now - 50,000ms
        // Burst 2: 5 requests at now - 30,000ms
        // Burst 3: 5 requests at now - 10,000ms
        Deque<Long> queue = new ConcurrentLinkedDeque<>();
        for (int i = 0; i < 5; i++) queue.addLast(now - 50_000L);
        for (int i = 0; i < 5; i++) queue.addLast(now - 30_000L);
        for (int i = 0; i < 5; i++) queue.addLast(now - 10_000L);
        log.put(clientKey, queue);

        assertEquals(15, queue.size(), "Initial 15 requests in window");

        // 16th request right now (now - 0ms) must be rejected with 429
        MockHttpServletRequest req16 = new MockHttpServletRequest("POST", "/api/chat");
        req16.setRemoteAddr(testIp);
        MockHttpServletResponse res16 = new MockHttpServletResponse();
        filter.doFilter(req16, res16, new MockFilterChain());
        assertEquals(429, res16.getStatus(), "16th request must be rate limited (429)");

        // Now simulate time shifting by 10,005ms:
        // The first 5 requests from now - 50,000ms are now at now - 60,005ms (EXPIRED).
        // The remaining 10 requests are still within the 60s window (now - 40,000ms and now - 20,000ms).
        queue.clear();
        for (int i = 0; i < 5; i++) queue.addLast(now - 60_005L); // Expired
        for (int i = 0; i < 5; i++) queue.addLast(now - 40_000L); // Active
        for (int i = 0; i < 5; i++) queue.addLast(now - 20_000L); // Active
        log.put(clientKey, queue);

        // Send 5 new requests — all 5 must be accepted (HTTP 200) as expired requests are evicted
        for (int i = 1; i <= 5; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/chat");
            req.setRemoteAddr(testIp);
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(req, res, new MockFilterChain());
            assertEquals(200, res.getStatus(), "Allowed request #" + i + " after partial sliding window eviction");
        }

        // The 6th request at this point should hit the limit (15 active requests in window)
        MockHttpServletRequest reqOver = new MockHttpServletRequest("POST", "/api/chat");
        reqOver.setRemoteAddr(testIp);
        MockHttpServletResponse resOver = new MockHttpServletResponse();
        filter.doFilter(reqOver, resOver, new MockFilterChain());
        assertEquals(429, resOver.getStatus(), "Request exceeding reopened capacity must be blocked with 429");
    }

    @Test
    @DisplayName("Stress Harness: High contention 100 concurrent threads hitting same client key")
    void testHighContentionBurst() throws Exception {
        int threads = 100;
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch fire = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(threads);

        AtomicInteger allowed = new AtomicInteger(0);
        AtomicInteger throttled = new AtomicInteger(0);
        AtomicInteger errors = new AtomicInteger(0);

        String clientIp = "192.168.254.1";

        try (ExecutorService executor = Executors.newFixedThreadPool(threads)) {
            for (int i = 0; i < threads; i++) {
                executor.submit(() -> {
                    ready.countDown();
                    try {
                        fire.await();
                        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/chat");
                        req.setRemoteAddr(clientIp);
                        MockHttpServletResponse res = new MockHttpServletResponse();
                        filter.doFilter(req, res, new MockFilterChain());

                        if (res.getStatus() == 200) {
                            allowed.incrementAndGet();
                        } else if (res.getStatus() == 429) {
                            throttled.incrementAndGet();
                        } else {
                            errors.incrementAndGet();
                        }
                    } catch (Exception e) {
                        errors.incrementAndGet();
                    } finally {
                        done.countDown();
                    }
                });
            }

            assertTrue(ready.await(5, TimeUnit.SECONDS), "Threads must be ready");
            fire.countDown();
            assertTrue(done.await(10, TimeUnit.SECONDS), "Threads must finish execution");
            executor.shutdown();
        }

        assertEquals(15, allowed.get(), "Under 100 concurrent threads, exactly 15 requests allowed");
        assertEquals(85, throttled.get(), "Under 100 concurrent threads, exactly 85 requests throttled");
        assertEquals(0, errors.get(), "Zero exceptions or unexpected status codes under contention");
    }

    @Test
    @DisplayName("Stress Harness: Memory eviction under high IP churn (3,000 distinct IPs)")
    void testMemoryEvictionUnderHeavyChurn() throws Exception {
        Field field = ChatRateLimitFilter.class.getDeclaredField("requestLog");
        field.setAccessible(true);
        @SuppressWarnings("unchecked")
        Map<String, Deque<Long>> log = (Map<String, Deque<Long>>) field.get(filter);

        long now = System.currentTimeMillis();

        // Pre-populate 2,100 expired entries (> 60s ago)
        for (int i = 0; i < 2100; i++) {
            Deque<Long> q = new ConcurrentLinkedDeque<>();
            q.addLast(now - 65_000L);
            log.put("ip:old-" + i, q);
        }

        assertTrue(log.size() > 2000, "Map size exceeds threshold of 2000");

        // Incoming fresh request triggers cleanStaleClients because log.size() > 2000
        MockHttpServletRequest triggerReq = new MockHttpServletRequest("POST", "/api/chat");
        triggerReq.setRemoteAddr("10.10.10.10");
        MockHttpServletResponse triggerRes = new MockHttpServletResponse();
        filter.doFilter(triggerReq, triggerRes, new MockFilterChain());

        assertEquals(200, triggerRes.getStatus());

        // Check that cleanup successfully pruned stale entries
        // Should only contain the 1 new entry
        assertEquals(1, log.size(), "All 2,100 stale entries should have been evicted cleanly");
        assertTrue(log.containsKey("ip:10.10.10.10"));
    }

    @Test
    @DisplayName("Stress Harness: Exhaustive X-Forwarded-For and X-Real-IP permutations")
    void testExhaustiveHeaderParsing() throws Exception {
        // 1. Whitespace commas
        MockHttpServletRequest req1 = new MockHttpServletRequest("POST", "/api/chat");
        req1.addHeader("X-Forwarded-For", "   ,   ,   ");
        req1.setRemoteAddr("198.51.100.1");
        MockHttpServletResponse res1 = new MockHttpServletResponse();
        assertDoesNotThrow(() -> filter.doFilter(req1, res1, new MockFilterChain()));
        assertEquals(200, res1.getStatus());

        // 2. Unknown tokens skipped until valid IP found
        MockHttpServletRequest req2 = new MockHttpServletRequest("POST", "/api/chat");
        req2.addHeader("X-Forwarded-For", "unknown, UNKNOWN, 203.0.113.77:8080");
        MockHttpServletResponse res2 = new MockHttpServletResponse();
        filter.doFilter(req2, res2, new MockFilterChain());
        assertEquals(200, res2.getStatus());

        // 3. IPv6 without port
        MockHttpServletRequest req3 = new MockHttpServletRequest("POST", "/api/chat");
        req3.addHeader("X-Forwarded-For", "2001:0db8:85a3::8a2e:0370:7334");
        MockHttpServletResponse res3 = new MockHttpServletResponse();
        filter.doFilter(req3, res3, new MockFilterChain());
        assertEquals(200, res3.getStatus());

        // 4. X-Real-IP fallback when X-Forwarded-For is missing
        MockHttpServletRequest req4 = new MockHttpServletRequest("POST", "/api/chat");
        req4.addHeader("X-Real-IP", "198.51.100.88");
        req4.setRemoteAddr("127.0.0.1");
        MockHttpServletResponse res4 = new MockHttpServletResponse();
        filter.doFilter(req4, res4, new MockFilterChain());
        assertEquals(200, res4.getStatus());

        // Inspect requestLog to verify correct bucket keys
        Field field = ChatRateLimitFilter.class.getDeclaredField("requestLog");
        field.setAccessible(true);
        @SuppressWarnings("unchecked")
        Map<String, Deque<Long>> log = (Map<String, Deque<Long>>) field.get(filter);

        assertTrue(log.containsKey("ip:198.51.100.1"), "Req1 fell back to remoteAddr");
        assertTrue(log.containsKey("ip:203.0.113.77"), "Req2 extracted IP and stripped port");
        assertTrue(log.containsKey("ip:2001:0db8:85a3::8a2e:0370:7334"), "Req3 preserved IPv6");
        assertTrue(log.containsKey("ip:198.51.100.88"), "Req4 used X-Real-IP");
    }

    @Test
    @DisplayName("Stress Harness: Non-POST chat endpoints and other paths are never throttled")
    void testNonChatEndpointsNeverThrottled() throws Exception {
        // Send 30 GET requests to /api/chat — must all return 200
        for (int i = 0; i < 30; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/chat");
            req.setRemoteAddr("10.0.0.2");
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(req, res, new MockFilterChain());
            assertEquals(200, res.getStatus());
        }

        // Send 30 POST requests to /api/petitions — must all return 200
        for (int i = 0; i < 30; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/petitions");
            req.setRemoteAddr("10.0.0.2");
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(req, res, new MockFilterChain());
            assertEquals(200, res.getStatus());
        }
    }
}
