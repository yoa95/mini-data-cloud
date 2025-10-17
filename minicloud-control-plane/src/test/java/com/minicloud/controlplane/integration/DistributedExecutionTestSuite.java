package com.minicloud.controlplane.integration;

import org.junit.platform.suite.api.SelectClasses;
import org.junit.platform.suite.api.Suite;
import org.junit.platform.suite.api.SuiteDisplayName;

/**
 * Test suite for distributed execution integration tests.
 * 
 * This suite runs all integration tests related to distributed query execution,
 * fault tolerance, and result aggregation in a coordinated manner.
 * 
 * To run this suite:
 * mvn test -Dtest=DistributedExecutionTestSuite
 * 
 * Prerequisites:
 * - Docker daemon must be running
 * - Docker Compose file must be available
 * - Test data should be loaded
 */
@Suite
@SuiteDisplayName("Distributed Execution Integration Test Suite")
@SelectClasses({
    DistributedExecutionIntegrationTest.class,
    QueryAggregationIntegrationTest.class,
    FaultToleranceIntegrationTest.class
})
public class DistributedExecutionTestSuite {
    // This class serves as a test suite runner
    // The actual test logic is in the individual test classes
}