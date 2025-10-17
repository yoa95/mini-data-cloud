package com.minicloud.controlplane.orchestration;

import com.github.dockerjava.api.DockerClient;
import com.github.dockerjava.api.command.CreateContainerResponse;
import com.github.dockerjava.api.command.InspectContainerResponse;
import com.github.dockerjava.api.exception.DockerException;
import com.github.dockerjava.api.model.*;
import com.github.dockerjava.core.DefaultDockerClientConfig;
import com.github.dockerjava.core.DockerClientImpl;
import com.github.dockerjava.httpclient5.ApacheDockerHttpClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Service for managing Docker containers for worker scaling and lifecycle management.
 * Handles container creation, health monitoring, and cleanup.
 */
@Service
@ConditionalOnProperty(name = "minicloud.docker.enabled", havingValue = "true", matchIfMissing = false)
public class DockerOrchestrationService {
    
    private static final Logger logger = LoggerFactory.getLogger(DockerOrchestrationService.class);
    
    @Value("${minicloud.docker.worker-image:minicloud-worker:latest}")
    private String workerImage;
    
    @Value("${minicloud.docker.network:minicloud-network}")
    private String networkName;
    
    @Value("${minicloud.docker.data-volume:/data}")
    private String dataVolume;
    
    @Value("${minicloud.control-plane.endpoint:control-plane:9090}")
    private String controlPlaneEndpoint;
    
    @Value("${minicloud.docker.worker-memory:2g}")
    private String workerMemoryLimit;
    
    @Value("${minicloud.docker.worker-cpu:1.0}")
    private String workerCpuLimit;
    
    private DockerClient dockerClient;
    private final Map<String, ContainerInfo> managedContainers = new ConcurrentHashMap<>();
    
    @PostConstruct
    public void initialize() {
        try {
            logger.info("Initializing Docker orchestration service");
            
            DefaultDockerClientConfig config = DefaultDockerClientConfig.createDefaultConfigBuilder()
                    .withDockerHost("unix:///var/run/docker.sock")
                    .build();
            
            ApacheDockerHttpClient httpClient = new ApacheDockerHttpClient.Builder()
                    .dockerHost(config.getDockerHost())
                    .sslConfig(config.getSSLConfig())
                    .maxConnections(100)
                    .connectionTimeout(Duration.ofSeconds(30))
                    .responseTimeout(Duration.ofSeconds(45))
                    .build();
            
            dockerClient = DockerClientImpl.getInstance(config, httpClient);
            
            // Test Docker connection
            Info dockerInfo = dockerClient.infoCmd().exec();
            logger.info("Connected to Docker daemon - version: {}, containers: {}", 
                       dockerInfo.getServerVersion(), dockerInfo.getContainers());
            
            // Ensure network exists
            ensureNetworkExists();
            
            // Discover existing managed containers
            discoverExistingContainers();
            
        } catch (Exception e) {
            logger.error("Failed to initialize Docker client", e);
            throw new RuntimeException("Docker orchestration initialization failed", e);
        }
    }
    
    @PreDestroy
    public void cleanup() {
        if (dockerClient != null) {
            try {
                dockerClient.close();
                logger.info("Docker client closed");
            } catch (Exception e) {
                logger.warn("Error closing Docker client", e);
            }
        }
    }
    
    /**
     * Create and start a new worker container
     */
    public WorkerContainer createWorker(String workerId, Map<String, String> environmentVariables) {
        logger.info("Creating worker container: {}", workerId);
        
        try {
            // Prepare environment variables
            Map<String, String> env = new HashMap<>();
            env.put("WORKER_ID", workerId);
            env.put("CONTROL_PLANE_ENDPOINT", controlPlaneEndpoint);
            env.put("DATA_PATH", "/data");
            env.put("SPRING_PROFILES_ACTIVE", "docker");
            env.putAll(environmentVariables);
            
            List<String> envList = env.entrySet().stream()
                    .map(entry -> entry.getKey() + "=" + entry.getValue())
                    .collect(Collectors.toList());
            
            // Create container
            CreateContainerResponse container = dockerClient.createContainerCmd(workerImage)
                    .withName("minicloud-worker-" + workerId)
                    .withEnv(envList)
                    .withNetworkMode(networkName)
                    .withHostConfig(HostConfig.newHostConfig()
                            .withMemory(parseMemoryLimit(workerMemoryLimit))
                            .withCpuQuota(parseCpuLimit(workerCpuLimit))
                            .withCpuPeriod(100000L) // 100ms period for CPU quota
                            .withBinds(Bind.parse(dataVolume + ":/data:ro"))
                            .withRestartPolicy(RestartPolicy.unlessStoppedRestart())
                            .withLogConfig(new LogConfig(LogConfig.LoggingType.JSON_FILE, 
                                    Map.of("max-size", "10m", "max-file", "3"))))
                    .withLabels(Map.of(
                            "minicloud.component", "worker",
                            "minicloud.worker-id", workerId,
                            "minicloud.managed", "true"
                    ))
                    .exec();
            
            String containerId = container.getId();
            logger.info("Created container {} for worker {}", containerId, workerId);
            
            // Start container
            dockerClient.startContainerCmd(containerId).exec();
            logger.info("Started container {} for worker {}", containerId, workerId);
            
            // Get container details
            InspectContainerResponse containerInfo = dockerClient.inspectContainerCmd(containerId).exec();
            
            WorkerContainer workerContainer = new WorkerContainer(
                    workerId,
                    containerId,
                    containerInfo.getName(),
                    getContainerIpAddress(containerInfo),
                    ContainerStatus.STARTING,
                    System.currentTimeMillis()
            );
            
            // Track container
            managedContainers.put(workerId, new ContainerInfo(workerContainer, containerInfo));
            
            logger.info("Worker container {} created successfully with IP: {}", 
                       workerId, workerContainer.getIpAddress());
            
            return workerContainer;
            
        } catch (DockerException e) {
            logger.error("Failed to create worker container: {}", workerId, e);
            throw new RuntimeException("Failed to create worker container: " + workerId, e);
        }
    }
    
    /**
     * Stop and remove a worker container
     */
    public boolean removeWorker(String workerId, boolean force) {
        logger.info("Removing worker container: {} (force: {})", workerId, force);
        
        ContainerInfo containerInfo = managedContainers.get(workerId);
        if (containerInfo == null) {
            logger.warn("Worker container not found: {}", workerId);
            return false;
        }
        
        try {
            String containerId = containerInfo.getWorkerContainer().getContainerId();
            
            if (force) {
                // Force kill container
                dockerClient.killContainerCmd(containerId).exec();
                logger.info("Force killed container {} for worker {}", containerId, workerId);
            } else {
                // Graceful stop
                dockerClient.stopContainerCmd(containerId)
                        .withTimeout(30) // 30 second graceful shutdown
                        .exec();
                logger.info("Gracefully stopped container {} for worker {}", containerId, workerId);
            }
            
            // Remove container
            dockerClient.removeContainerCmd(containerId)
                    .withForce(force)
                    .withRemoveVolumes(true)
                    .exec();
            
            logger.info("Removed container {} for worker {}", containerId, workerId);
            
            // Remove from tracking
            managedContainers.remove(workerId);
            
            return true;
            
        } catch (DockerException e) {
            logger.error("Failed to remove worker container: {}", workerId, e);
            return false;
        }
    }
    
    /**
     * Get status of a worker container
     */
    public Optional<WorkerContainer> getWorkerContainer(String workerId) {
        ContainerInfo containerInfo = managedContainers.get(workerId);
        if (containerInfo == null) {
            return Optional.empty();
        }
        
        try {
            // Refresh container status
            InspectContainerResponse inspectResponse = dockerClient
                    .inspectContainerCmd(containerInfo.getWorkerContainer().getContainerId())
                    .exec();
            
            ContainerStatus status = mapContainerState(inspectResponse.getState());
            WorkerContainer updatedContainer = containerInfo.getWorkerContainer().withStatus(status);
            
            // Update tracking
            containerInfo.setWorkerContainer(updatedContainer);
            
            return Optional.of(updatedContainer);
            
        } catch (DockerException e) {
            logger.warn("Failed to inspect container for worker {}", workerId, e);
            return Optional.of(containerInfo.getWorkerContainer().withStatus(ContainerStatus.UNKNOWN));
        }
    }
    
    /**
     * List all managed worker containers
     */
    public List<WorkerContainer> listWorkerContainers() {
        List<WorkerContainer> containers = new ArrayList<>();
        
        for (ContainerInfo containerInfo : managedContainers.values()) {
            Optional<WorkerContainer> container = getWorkerContainer(containerInfo.getWorkerContainer().getWorkerId());
            container.ifPresent(containers::add);
        }
        
        return containers;
    }
    
    /**
     * Get Docker system information
     */
    public DockerSystemInfo getSystemInfo() {
        try {
            Info dockerInfo = dockerClient.infoCmd().exec();
            
            return new DockerSystemInfo(
                    dockerInfo.getServerVersion(),
                    dockerInfo.getContainers(),
                    dockerInfo.getContainersRunning(),
                    dockerInfo.getContainersStopped(),
                    dockerInfo.getImages(),
                    dockerInfo.getMemTotal(),
                    dockerInfo.getNCPU()
            );
            
        } catch (DockerException e) {
            logger.error("Failed to get Docker system info", e);
            throw new RuntimeException("Failed to get Docker system info", e);
        }
    }
    
    /**
     * Health check for a worker container
     */
    public ContainerHealthStatus checkWorkerHealth(String workerId) {
        ContainerInfo containerInfo = managedContainers.get(workerId);
        if (containerInfo == null) {
            return new ContainerHealthStatus(workerId, false, "Container not found", null);
        }
        
        try {
            String containerId = containerInfo.getWorkerContainer().getContainerId();
            InspectContainerResponse inspectResponse = dockerClient.inspectContainerCmd(containerId).exec();
            
            InspectContainerResponse.ContainerState state = inspectResponse.getState();
            boolean isHealthy = state.getRunning() && !state.getPaused() && !state.getRestarting();
            
            String healthMessage = isHealthy ? "Container running normally" : 
                    String.format("Container state - Running: %s, Paused: %s, Restarting: %s, ExitCode: %d",
                            state.getRunning(), state.getPaused(), state.getRestarting(), state.getExitCodeLong());
            
            Map<String, Object> details = Map.of(
                    "containerId", containerId,
                    "status", state.getStatus(),
                    "startedAt", state.getStartedAt(),
                    "finishedAt", state.getFinishedAt(),
                    "exitCode", state.getExitCodeLong(),
                    "oomKilled", state.getOOMKilled()
            );
            
            return new ContainerHealthStatus(workerId, isHealthy, healthMessage, details);
            
        } catch (DockerException e) {
            logger.warn("Failed to check health for worker container {}", workerId, e);
            return new ContainerHealthStatus(workerId, false, "Health check failed: " + e.getMessage(), null);
        }
    }
    
    private void ensureNetworkExists() {
        try {
            // Check if network exists
            List<Network> networks = dockerClient.listNetworksCmd()
                    .withNameFilter(networkName)
                    .exec();
            
            if (networks.isEmpty()) {
                logger.info("Creating Docker network: {}", networkName);
                dockerClient.createNetworkCmd()
                        .withName(networkName)
                        .withDriver("bridge")
                        .withLabels(Map.of("minicloud.managed", "true"))
                        .exec();
                logger.info("Created Docker network: {}", networkName);
            } else {
                logger.info("Docker network already exists: {}", networkName);
            }
            
        } catch (DockerException e) {
            logger.error("Failed to ensure network exists: {}", networkName, e);
            throw new RuntimeException("Failed to create Docker network", e);
        }
    }
    
    private void discoverExistingContainers() {
        try {
            List<Container> containers = dockerClient.listContainersCmd()
                    .withShowAll(true)
                    .withLabelFilter(Map.of("minicloud.managed", "true", "minicloud.component", "worker"))
                    .exec();
            
            logger.info("Discovered {} existing managed worker containers", containers.size());
            
            for (Container container : containers) {
                String workerId = container.getLabels().get("minicloud.worker-id");
                if (workerId != null) {
                    InspectContainerResponse inspectResponse = dockerClient.inspectContainerCmd(container.getId()).exec();
                    
                    WorkerContainer workerContainer = new WorkerContainer(
                            workerId,
                            container.getId(),
                            container.getNames()[0],
                            getContainerIpAddress(inspectResponse),
                            mapContainerState(inspectResponse.getState()),
                            System.currentTimeMillis()
                    );
                    
                    managedContainers.put(workerId, new ContainerInfo(workerContainer, inspectResponse));
                    logger.info("Discovered existing worker container: {} ({})", workerId, container.getStatus());
                }
            }
            
        } catch (DockerException e) {
            logger.warn("Failed to discover existing containers", e);
        }
    }
    
    private String getContainerIpAddress(InspectContainerResponse containerInfo) {
        try {
            NetworkSettings networkSettings = containerInfo.getNetworkSettings();
            if (networkSettings != null && networkSettings.getNetworks() != null) {
                ContainerNetwork network = networkSettings.getNetworks().get(networkName);
                if (network != null && network.getIpAddress() != null) {
                    return network.getIpAddress();
                }
            }
            
            // Fallback to default network
            if (networkSettings != null && networkSettings.getIpAddress() != null) {
                return networkSettings.getIpAddress();
            }
            
            return "unknown";
            
        } catch (Exception e) {
            logger.warn("Failed to get container IP address", e);
            return "unknown";
        }
    }
    
    private ContainerStatus mapContainerState(InspectContainerResponse.ContainerState state) {
        if (state.getRunning()) {
            return ContainerStatus.RUNNING;
        } else if (state.getPaused()) {
            return ContainerStatus.PAUSED;
        } else if (state.getRestarting()) {
            return ContainerStatus.RESTARTING;
        } else if (state.getExitCodeLong() != null && state.getExitCodeLong() == 0) {
            return ContainerStatus.STOPPED;
        } else if (state.getExitCodeLong() != null && state.getExitCodeLong() != 0) {
            return ContainerStatus.FAILED;
        } else {
            return ContainerStatus.UNKNOWN;
        }
    }
    
    private long parseMemoryLimit(String memoryLimit) {
        // Parse memory limit like "2g", "512m", "1024k"
        if (memoryLimit == null || memoryLimit.isEmpty()) {
            return 2L * 1024 * 1024 * 1024; // Default 2GB
        }
        
        String unit = memoryLimit.substring(memoryLimit.length() - 1).toLowerCase();
        String value = memoryLimit.substring(0, memoryLimit.length() - 1);
        
        try {
            long numValue = Long.parseLong(value);
            switch (unit) {
                case "g": return numValue * 1024 * 1024 * 1024;
                case "m": return numValue * 1024 * 1024;
                case "k": return numValue * 1024;
                default: return Long.parseLong(memoryLimit); // Assume bytes
            }
        } catch (NumberFormatException e) {
            logger.warn("Invalid memory limit format: {}, using default 2GB", memoryLimit);
            return 2L * 1024 * 1024 * 1024;
        }
    }
    
    private long parseCpuLimit(String cpuLimit) {
        // Parse CPU limit like "1.0", "0.5", "2"
        try {
            double cpuValue = Double.parseDouble(cpuLimit);
            return (long) (cpuValue * 100000); // Convert to CPU quota (100000 = 1 CPU)
        } catch (NumberFormatException e) {
            logger.warn("Invalid CPU limit format: {}, using default 1.0", cpuLimit);
            return 100000L; // Default 1 CPU
        }
    }
    
    /**
     * Container information holder
     */
    private static class ContainerInfo {
        private WorkerContainer workerContainer;
        private final InspectContainerResponse inspectResponse;
        
        public ContainerInfo(WorkerContainer workerContainer, InspectContainerResponse inspectResponse) {
            this.workerContainer = workerContainer;
            this.inspectResponse = inspectResponse;
        }
        
        public WorkerContainer getWorkerContainer() { return workerContainer; }
        public void setWorkerContainer(WorkerContainer workerContainer) { this.workerContainer = workerContainer; }
        public InspectContainerResponse getInspectResponse() { return inspectResponse; }
    }
}