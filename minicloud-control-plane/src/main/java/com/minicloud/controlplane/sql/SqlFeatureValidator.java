package com.minicloud.controlplane.sql;

import org.apache.calcite.sql.SqlCall;
import org.apache.calcite.sql.SqlIdentifier;
import org.apache.calcite.sql.SqlJoin;
import org.apache.calcite.sql.SqlKind;
import org.apache.calcite.sql.SqlNode;
import org.apache.calcite.sql.SqlNodeList;
import org.apache.calcite.sql.SqlOrderBy;
import org.apache.calcite.sql.SqlSelect;
import org.apache.calcite.sql.util.SqlBasicVisitor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * Validates SQL features against supported functionality in Mini Data Cloud
 */
public class SqlFeatureValidator {
    
    private static final Logger logger = LoggerFactory.getLogger(SqlFeatureValidator.class);
    
    // Supported SQL statement types
    private static final Set<SqlKind> SUPPORTED_STATEMENT_TYPES = EnumSet.of(
            SqlKind.SELECT,
            SqlKind.ORDER_BY,
            SqlKind.UNION,
            SqlKind.EXCEPT,
            SqlKind.INTERSECT
    );
    
    // Supported SQL operators and functions
    private static final Set<SqlKind> SUPPORTED_OPERATORS = EnumSet.of(
            // Arithmetic operators
            SqlKind.PLUS, SqlKind.MINUS, SqlKind.TIMES, SqlKind.DIVIDE,
            
            // Comparison operators
            SqlKind.EQUALS, SqlKind.NOT_EQUALS, SqlKind.LESS_THAN, SqlKind.LESS_THAN_OR_EQUAL,
            SqlKind.GREATER_THAN, SqlKind.GREATER_THAN_OR_EQUAL,
            
            // Logical operators
            SqlKind.AND, SqlKind.OR, SqlKind.NOT,
            
            // Pattern matching
            SqlKind.LIKE, SqlKind.SIMILAR,
            
            // Null handling
            SqlKind.IS_NULL, SqlKind.IS_NOT_NULL,
            
            // Set operations
            SqlKind.IN, SqlKind.NOT_IN, SqlKind.EXISTS,
            
            // Aggregate functions
            SqlKind.COUNT, SqlKind.SUM, SqlKind.AVG, SqlKind.MIN, SqlKind.MAX,
            
            // String functions
            SqlKind.TRIM,
            
            // Date/time functions
            SqlKind.EXTRACT,
            
            // Case expressions
            SqlKind.CASE,
            
            // Cast operations
            SqlKind.CAST
    );
    
    // Supported join types
    private static final Set<org.apache.calcite.sql.JoinType> SUPPORTED_JOIN_TYPES = EnumSet.of(
            org.apache.calcite.sql.JoinType.INNER,
            org.apache.calcite.sql.JoinType.LEFT,
            org.apache.calcite.sql.JoinType.RIGHT,
            org.apache.calcite.sql.JoinType.FULL
    );
    
    /**
     * Check if a SQL query is supported
     */
    public static boolean isSupported(SqlNode sqlNode) {
        try {
            FeatureCheckVisitor visitor = new FeatureCheckVisitor();
            sqlNode.accept(visitor);
            return visitor.isSupported();
        } catch (Exception e) {
            logger.debug("Feature validation failed: {}", e.getMessage());
            return false;
        }
    }
    
    /**
     * Get detailed reason why a query is not supported
     */
    public static String getUnsupportedFeatureReason(SqlNode sqlNode) {
        try {
            FeatureCheckVisitor visitor = new FeatureCheckVisitor();
            sqlNode.accept(visitor);
            
            if (visitor.isSupported()) {
                return "Query is supported";
            } else {
                return visitor.getUnsupportedReason();
            }
        } catch (Exception e) {
            return "Feature validation error: " + e.getMessage();
        }
    }
    
    /**
     * Get list of all supported SQL features
     */
    public static List<String> getSupportedFeatures() {
        List<String> features = new ArrayList<>();
        
        features.add("SELECT statements with WHERE, GROUP BY, HAVING, ORDER BY");
        features.add("Basic arithmetic and comparison operators");
        features.add("Logical operators (AND, OR, NOT)");
        features.add("Aggregate functions (COUNT, SUM, AVG, MIN, MAX)");
        features.add("String functions (UPPER, LOWER, TRIM, SUBSTRING)");
        features.add("Date/time functions and EXTRACT");
        features.add("CASE expressions and CAST operations");
        features.add("INNER, LEFT, RIGHT, and FULL OUTER joins");
        features.add("Subqueries in WHERE and FROM clauses");
        features.add("Set operations (UNION, EXCEPT, INTERSECT)");
        features.add("Pattern matching with LIKE");
        features.add("NULL handling (IS NULL, IS NOT NULL)");
        
        return features;
    }
    
    /**
     * Get list of unsupported SQL features
     */
    public static List<String> getUnsupportedFeatures() {
        List<String> features = new ArrayList<>();
        
        features.add("Window functions (ROW_NUMBER, RANK, etc.)");
        features.add("Recursive CTEs (WITH RECURSIVE)");
        features.add("Advanced analytical functions");
        features.add("User-defined functions (UDFs)");
        features.add("Stored procedures and triggers");
        features.add("Complex data types (ARRAY, JSON, XML)");
        features.add("Advanced join types (CROSS APPLY, etc.)");
        features.add("Pivot and unpivot operations");
        
        return features;
    }
    
    /**
     * Visitor class to check SQL features
     */
    private static class FeatureCheckVisitor extends SqlBasicVisitor<Void> {
        
        private boolean supported = true;
        private String unsupportedReason = "";
        
        public boolean isSupported() {
            return supported;
        }
        
        public String getUnsupportedReason() {
            return unsupportedReason;
        }
        
        public Void visit(SqlCall call) {
            SqlKind kind = call.getKind();
            
            // Check if the statement type is supported
            if (!SUPPORTED_STATEMENT_TYPES.contains(kind) && !SUPPORTED_OPERATORS.contains(kind)) {
                // Special cases for some complex operations
                if (kind == SqlKind.OTHER_FUNCTION) {
                    // Check function name for user-defined functions
                    if (call.getOperator().getName().startsWith("UDF_")) {
                        markUnsupported("User-defined functions are not supported: " + call.getOperator().getName());
                        return null;
                    }
                } else if (kind == SqlKind.OVER) {
                    markUnsupported("Window functions are not supported");
                    return null;
                } else if (kind == SqlKind.WITH) {
                    markUnsupported("Common Table Expressions (CTEs) are not supported");
                    return null;
                } else if (kind.belongsTo(SqlKind.DML)) {
                    markUnsupported("DML operations (INSERT, UPDATE, DELETE) are not supported in this phase");
                    return null;
                } else if (kind.belongsTo(SqlKind.DDL)) {
                    markUnsupported("DDL operations (CREATE, DROP, ALTER) are not supported in this phase");
                    return null;
                } else {
                    markUnsupported("Unsupported SQL operation: " + kind);
                    return null;
                }
            }
            
            // Check join types
            if (call instanceof SqlJoin) {
                SqlJoin join = (SqlJoin) call;
                if (!SUPPORTED_JOIN_TYPES.contains(join.getJoinType())) {
                    markUnsupported("Unsupported join type: " + join.getJoinType());
                    return null;
                }
            }
            
            // Continue visiting child nodes
            return super.visit(call);
        }
        
        public Void visit(SqlSelect select) {
            // Check for unsupported SELECT features
            
            // Check for DISTINCT
            if (select.isDistinct()) {
                // DISTINCT is supported, but log it
                logger.debug("Query uses DISTINCT - supported but may impact performance");
            }
            
            // Check for complex window specifications
            if (select.getWindowList() != null && select.getWindowList().size() > 0) {
                markUnsupported("Window specifications are not supported");
                return null;
            }
            
            return super.visit(select);
        }
        
        public Void visit(SqlOrderBy orderBy) {
            // ORDER BY is supported, check for complex expressions
            SqlNodeList orderList = orderBy.orderList;
            if (orderList != null) {
                for (SqlNode orderItem : orderList) {
                    // Basic ORDER BY validation - could be extended
                    if (orderItem.getKind() == SqlKind.DESCENDING) {
                        // These are fine
                        continue;
                    }
                }
            }
            
            return super.visit(orderBy);
        }
        
        public Void visit(SqlIdentifier identifier) {
            // Check for reserved keywords or unsupported identifiers
            if (identifier.names.size() > 0) {
                String name = identifier.names.get(identifier.names.size() - 1).toUpperCase();
                
                // Check for system tables or functions that might not be supported
                if (name.startsWith("SYS_") || name.startsWith("INFORMATION_SCHEMA")) {
                    markUnsupported("System tables and information schema are not supported: " + name);
                    return null;
                }
            }
            
            return super.visit(identifier);
        }
        
        private void markUnsupported(String reason) {
            this.supported = false;
            this.unsupportedReason = reason;
            logger.debug("SQL feature not supported: {}", reason);
        }
    }
}