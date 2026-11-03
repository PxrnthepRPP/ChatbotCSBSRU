package com.bsru.studentportal.controller;

import com.bsru.studentportal.config.SecurityConfig;
import com.bsru.studentportal.repository.AdvisorRepository;
import com.bsru.studentportal.repository.StudentRepository;
import com.bsru.studentportal.security.JwtAuthenticationFilter;
import com.bsru.studentportal.security.JwtUtil;
import com.bsru.studentportal.service.AccountService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The login page asks this before sign-in, so it must be public and must not advertise demo accounts by default */
@WebMvcTest(controllers = AuthController.class)
@AutoConfigureMockMvc(addFilters = true)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JwtUtil.class})
class AuthLoginConfigTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean private StudentRepository studentRepository;
    @MockBean private AdvisorRepository advisorRepository;
    @MockBean private AccountService accountService;

    @Test
    void loginConfig_isPublic_andHidesDemoAccountsByDefault() throws Exception {
        mockMvc.perform(get("/api/auth/config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.showDemoAccounts").value(false));
    }
}
