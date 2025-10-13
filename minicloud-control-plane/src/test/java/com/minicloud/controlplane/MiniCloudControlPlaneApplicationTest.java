package com.minicloud.controlplane;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Basic integration test to verify the application starts correctly
 */
@SpringBootTest
@ActiveProfiles("test")
class MiniCloudControlPlaneApplicationTest {

    @Test
    void contextLoads() {
        // This test verifies that the Spring Boot application context loads successfully
        // If the application has configuration issues, this test will fail
    }
}