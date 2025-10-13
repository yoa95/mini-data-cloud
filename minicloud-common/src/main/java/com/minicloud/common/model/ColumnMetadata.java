package com.minicloud.common.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Objects;

/**
 * Metadata for a column in query results
 */
public class ColumnMetadata {
    private final String name;
    private final DataType type;
    private final boolean nullable;
    private final String comment;

    @JsonCreator
    public ColumnMetadata(
            @JsonProperty("name") String name,
            @JsonProperty("type") DataType type,
            @JsonProperty("nullable") boolean nullable,
            @JsonProperty("comment") String comment) {
        this.name = Objects.requireNonNull(name);
        this.type = Objects.requireNonNull(type);
        this.nullable = nullable;
        this.comment = comment;
    }

    public static ColumnMetadata of(String name, DataType type) {
        return new ColumnMetadata(name, type, true, null);
    }

    public static ColumnMetadata of(String name, DataType type, boolean nullable) {
        return new ColumnMetadata(name, type, nullable, null);
    }

    public String getName() {
        return name;
    }

    public DataType getType() {
        return type;
    }

    public boolean isNullable() {
        return nullable;
    }

    public String getComment() {
        return comment;
    }

    public enum DataType {
        BOOLEAN,
        INTEGER,
        LONG,
        FLOAT,
        DOUBLE,
        DECIMAL,
        DATE,
        TIME,
        TIMESTAMP,
        STRING,
        UUID,
        BINARY
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ColumnMetadata that = (ColumnMetadata) o;
        return nullable == that.nullable &&
                Objects.equals(name, that.name) &&
                type == that.type;
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, type, nullable);
    }

    @Override
    public String toString() {
        return "ColumnMetadata{" +
                "name='" + name + '\'' +
                ", type=" + type +
                ", nullable=" + nullable +
                '}';
    }
}