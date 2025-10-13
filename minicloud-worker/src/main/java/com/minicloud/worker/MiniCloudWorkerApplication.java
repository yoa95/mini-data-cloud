package com.minicloud.worker;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Main application class for the Mini Data Cloud Worker
 */
@SpringBootApplication
@EnableAsync
@EnableScheduling
public class MiniCloudWorkerApplication {

    public static void main(String[] args) {
        SpringApplication.run(MiniCloudWorkerApplication.class, args);
    }
}