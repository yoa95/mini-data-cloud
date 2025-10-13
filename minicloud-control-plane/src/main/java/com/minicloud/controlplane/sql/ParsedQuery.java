package com.minicloud.controlplane.sql;

import org.apache.calcite.rel.RelNode;
import org.apache.calcite.sql.SqlNode;

/**
 * Represents a parsed and validated SQL query with all intermediate representations
 */
public class ParsedQuery {
    
    private final String originalSql;
    private final SqlNode sqlNode;
    private final SqlNode validatedSqlNode;
    private final RelNode relNode;
    
    public ParsedQuery(String originalSql, SqlNode sqlNode, SqlNode validatedSqlNode, RelNode relNode) {
        this.originalSql = originalSql;
        this.sqlNode = sqlNode;
        this.validatedSqlNode = validatedSqlNode;
        this.relNode = relNode;
    }
    
    /**
     * Get the original SQL string
     */
    public String getOriginalSql() {
        return originalSql;
    }
    
    /**
     * Get the parsed SQL AST
     */
    public SqlNode getSqlNode() {
        return sqlNode;
    }
    
    /**
     * Get the validated SQL AST
     */
    public SqlNode getValidatedSqlNode() {
        return validatedSqlNode;
    }
    
    /**
     * Get the RelNode tree (relational algebra representation)
     */
    public RelNode getRelNode() {
        return relNode;
    }
    
    /**
     * Get the SQL kind (SELECT, INSERT, etc.)
     */
    public org.apache.calcite.sql.SqlKind getSqlKind() {
        return sqlNode.getKind();
    }
    
    /**
     * Check if this is a SELECT query
     */
    public boolean isSelectQuery() {
        return sqlNode.getKind() == org.apache.calcite.sql.SqlKind.SELECT;
    }
    
    /**
     * Check if this is a DML query (INSERT, UPDATE, DELETE)
     */
    public boolean isDmlQuery() {
        return sqlNode.getKind() == org.apache.calcite.sql.SqlKind.INSERT ||
               sqlNode.getKind() == org.apache.calcite.sql.SqlKind.UPDATE ||
               sqlNode.getKind() == org.apache.calcite.sql.SqlKind.DELETE;
    }
    
    /**
     * Check if this is a DDL query (CREATE, DROP, ALTER)
     */
    public boolean isDdlQuery() {
        return sqlNode.getKind() == org.apache.calcite.sql.SqlKind.CREATE_TABLE ||
               sqlNode.getKind() == org.apache.calcite.sql.SqlKind.DROP_TABLE ||
               sqlNode.getKind() == org.apache.calcite.sql.SqlKind.ALTER_TABLE;
    }
    
    /**
     * Get a summary of the parsed query
     */
    public String getSummary() {
        return String.format("ParsedQuery{kind=%s, relNodeType=%s}", 
                           getSqlKind(), 
                           relNode.getRelTypeName());
    }
    
    @Override
    public String toString() {
        return "ParsedQuery{" +
                "sqlKind=" + getSqlKind() +
                ", relNodeType=" + relNode.getRelTypeName() +
                ", originalSql='" + originalSql.substring(0, Math.min(originalSql.length(), 50)) + "...'" +
                '}';
    }
}