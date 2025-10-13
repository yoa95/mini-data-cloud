package com.minicloud.controlplane.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * REST controller for health checks and system status
 */
@RestController
@RequestMapping("/api/v1/health")
public class HealthController {
    
    @Autowired
    private DataSource dataSource;
    
    /**
     * Basic health check endpoint
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> status = new HashMap<>();
        status.put("status", "UP");
        status.put("timestamp", LocalDateTime.now());
        status.put("service", "minicloud-control-plane");
        status.put("version", "1.0.0-SNAPSHOT");
        
        // Check database connectivity
        try (Connection connection = dataSource.getConnection()) {
            status.put("database", "UP");
        } catch (Exception e) {
            status.put("database", "DOWN");
            status.put("database_error", e.getMessage());
        }
        
        return ResponseEntity.ok(status);
    }
    
    /**
     * Detailed system information
     */
    @GetMapping("/info")
    public ResponseEntity<Map<String, Object>> info() {
        Map<String, Object> info = new HashMap<>();
        
        // System information
        Runtime runtime = Runtime.getRuntime();
        info.put("java_version", System.getProperty("java.version"));
        info.put("java_vendor", System.getProperty("java.vendor"));
        info.put("os_name", System.getProperty("os.name"));
        info.put("os_version", System.getProperty("os.version"));
        
        // Memory information
        Map<String, Object> memory = new HashMap<>();
        memory.put("total_mb", runtime.totalMemory() / (1024 * 1024));
        memory.put("free_mb", runtime.freeMemory() / (1024 * 1024));
        memory.put("used_mb", (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024));
        memory.put("max_mb", runtime.maxMemory() / (1024 * 1024));
        info.put("memory", memory);
        
        // Application information
        info.put("application", "Mini Data Cloud Control Plane");
        info.put("version", "1.0.0-SNAPSHOT");
        info.put("build_time", LocalDateTime.now()); // In real app, this would be build timestamp
        
        return ResponseEntity.ok(info);
    }
    

}