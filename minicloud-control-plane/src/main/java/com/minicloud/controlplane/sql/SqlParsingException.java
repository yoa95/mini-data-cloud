package com.minicloud.controlplane.sql;

/**
 * Exception thrown when SQL parsing, validation, or conversion fails
 */
public class SqlParsingException extends Exception {
    
    private final String sqlQuery;
    private final String phase;
    
    public SqlParsingException(String message) {
        super(message);
        this.sqlQuery = null;
        this.phase = "unknown";
    }
    
    public SqlParsingException(String message, Throwable cause) {
        super(message, cause);
        this.sqlQuery = null;
        this.phase = "unknown";
    }
    
    public SqlParsingException(String message, String sqlQuery, String phase) {
        super(message);
        this.sqlQuery = sqlQuery;
        this.phase = phase;
    }
    
    public SqlParsingException(String message, Throwable cause, String sqlQuery, String phase) {
        super(message, cause);
        this.sqlQuery = sqlQuery;
        this.phase = phase;
    }
    
    /**
     * Get the SQL query that caused the parsing error
     */
    public String getSqlQuery() {
        return sqlQuery;
    }
    
    /**
     * Get the phase where parsing failed (parsing, validation, conversion)
     */
    public String getPhase() {
        return phase;
    }
    
    /**
     * Get a detailed error message including context
     */
    public String getDetailedMessage() {
        StringBuilder sb = new StringBuilder();
        sb.append("SQL parsing failed");
        
        if (phase != null && !phase.equals("unknown")) {
            sb.append(" during ").append(phase);
        }
        
        sb.append(": ").append(getMessage());
        
        if (sqlQuery != null) {
            String truncatedSql = sqlQuery.length() > 100 
                ? sqlQuery.substring(0, 100) + "..." 
                : sqlQuery;
            sb.append(" [SQL: ").append(truncatedSql).append("]");
        }
        
        return sb.toString();
    }
    
    @Override
    public String toString() {
        return "SqlParsingException{" +
                "message='" + getMessage() + '\'' +
                ", phase='" + phase + '\'' +
                ", sqlQuery='" + (sqlQuery != null ? sqlQuery.substring(0, Math.min(sqlQuery.length(), 50)) + "..." : "null") + '\'' +
                '}';
    }
}