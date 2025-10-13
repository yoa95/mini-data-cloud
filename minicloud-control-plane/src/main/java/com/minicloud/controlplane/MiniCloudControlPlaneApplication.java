package com.minicloud.controlplane;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Main application class for the Mini Data Cloud Control Plane
 */
@SpringBootApplication
@EnableAsync
@EnableScheduling
public class MiniCloudControlPlaneApplication {

    public static void main(String[] args) {
        SpringApplication.run(MiniCloudControlPlaneApplication.class, args);
    }
}