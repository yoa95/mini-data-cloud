package com.minicloud.controlplane.sql;

import org.apache.calcite.sql.SqlKind;
import org.apache.calcite.sql.SqlNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Test cases for SQL parsing service using Apache Calcite
 */
@SpringBootTest
@ActiveProfiles("test")
class SqlParsingServiceTest {
    
    @Autowired
    private SqlParsingService sqlParsingService;
    
    @Test
    void testParseSimpleSelectQuery() throws Exception {
        String sql = "SELECT id, name FROM users WHERE age > 18";
        
        // Test just parsing without validation (since tables don't exist)
        SqlNode sqlNode = sqlParsingService.parseQuery(sql);
        
        assertNotNull(sqlNode);
        assertEquals(SqlKind.SELECT, sqlNode.getKind());
    }
    
    @Test
    void testParseSelectWithGroupBy() throws Exception {
        String sql = "SELECT category, COUNT(*) as cnt FROM products GROUP BY category";
        
        // Test just parsing without validation
        SqlNode sqlNode = sqlParsingService.parseQuery(sql);
        
        assertNotNull(sqlNode);
        assertEquals(SqlKind.SELECT, sqlNode.getKind());
    }
    
    @Test
    void testParseSelectWithJoin() throws Exception {
        String sql = "SELECT u.name, o.total FROM users u JOIN orders o ON u.id = o.user_id";
        
        // Test just parsing without validation
        SqlNode sqlNode = sqlParsingService.parseQuery(sql);
        
        assertNotNull(sqlNode);
        assertEquals(SqlKind.SELECT, sqlNode.getKind());
    }
    
    @Test
    void testParseSelectWithOrderBy() throws Exception {
        String sql = "SELECT name, age FROM users ORDER BY age DESC, name ASC";
        
        // Test just parsing without validation
        SqlNode sqlNode = sqlParsingService.parseQuery(sql);
        
        assertNotNull(sqlNode);
        assertEquals(SqlKind.ORDER_BY, sqlNode.getKind());
    }
    
    @Test
    void testParseInvalidSql() {
        String sql = "SELECT FROM WHERE";
        
        assertThrows(Exception.class, () -> {
            sqlParsingService.parseQuery(sql);
        });
    }
    
    @Test
    void testIsQuerySupported() {
        // Test basic parsing support (without full validation)
        assertTrue(sqlParsingService.isQuerySupported("SELECT * FROM users"));
        assertTrue(sqlParsingService.isQuerySupported("SELECT COUNT(*) FROM orders WHERE status = 'completed'"));
        
        // Unsupported queries (these should return false, not throw exceptions)
        assertFalse(sqlParsingService.isQuerySupported("INSERT INTO users VALUES (1, 'John')"));
        assertFalse(sqlParsingService.isQuerySupported("CREATE TABLE test (id INT)"));
    }
    
    @Test
    void testGetUnsupportedFeatureReason() {
        String sql = "INSERT INTO users VALUES (1, 'John')";
        String reason = sqlParsingService.getUnsupportedFeatureReason(sql);
        
        assertNotNull(reason);
        assertTrue(reason.contains("not supported") || reason.contains("DML"));
    }
    
    @Test
    void testSqlFeatureValidator() throws Exception {
        // Test feature lists
        assertFalse(SqlFeatureValidator.getSupportedFeatures().isEmpty());
        assertFalse(SqlFeatureValidator.getUnsupportedFeatures().isEmpty());
        
        // Test basic feature validation
        SqlNode selectNode = sqlParsingService.parseQuery("SELECT 1");
        assertTrue(SqlFeatureValidator.isSupported(selectNode));
        
        SqlNode insertNode = sqlParsingService.parseQuery("INSERT INTO test VALUES (1)");
        assertFalse(SqlFeatureValidator.isSupported(insertNode));
    }
}