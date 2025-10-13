package com.minicloud.controlplane.sql;

import org.apache.calcite.config.CalciteConnectionConfig;
import org.apache.calcite.config.CalciteConnectionConfigImpl;
import org.apache.calcite.config.Lex;
import org.apache.calcite.jdbc.CalciteSchema;
import org.apache.calcite.plan.Contexts;
import org.apache.calcite.plan.ConventionTraitDef;
import org.apache.calcite.plan.RelOptCluster;
import org.apache.calcite.plan.RelOptPlanner;
import org.apache.calcite.plan.volcano.VolcanoPlanner;
import org.apache.calcite.prepare.CalciteCatalogReader;
import org.apache.calcite.rel.type.RelDataTypeFactory;
import org.apache.calcite.rex.RexBuilder;
import org.apache.calcite.schema.SchemaPlus;
import org.apache.calcite.schema.impl.AbstractSchema;
import org.apache.calcite.sql.SqlOperatorTable;
import org.apache.calcite.sql.fun.SqlStdOperatorTable;
import org.apache.calcite.sql.parser.SqlParser;
import org.apache.calcite.sql.type.SqlTypeFactoryImpl;
import org.apache.calcite.sql.validate.SqlConformanceEnum;
import org.apache.calcite.sql.validate.SqlValidator;
import org.apache.calcite.sql.validate.SqlValidatorUtil;
import org.apache.calcite.tools.FrameworkConfig;
import org.apache.calcite.tools.Frameworks;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Collections;
import java.util.Properties;

/**
 * Configuration for Apache Calcite SQL parsing and validation
 */
@Configuration
public class CalciteConfiguration {
    
    private static final Logger logger = LoggerFactory.getLogger(CalciteConfiguration.class);
    
    /**
     * Create the main Calcite framework configuration
     */
    @Bean
    public FrameworkConfig frameworkConfig() {
        logger.info("Initializing Calcite framework configuration");
        
        // Create root schema
        SchemaPlus rootSchema = Frameworks.createRootSchema(true);
        
        // Add minicloud schema for our tables
        SchemaPlus minicloudSchema = rootSchema.add("minicloud", new MiniCloudSchema());
        
        // Configure SQL parser
        SqlParser.Config parserConfig = SqlParser.config()
                .withLex(Lex.MYSQL)  // Use MySQL-compatible lexical rules
                .withConformance(SqlConformanceEnum.LENIENT)  // Allow common SQL extensions
                .withCaseSensitive(false);  // Case-insensitive identifiers
        
        return Frameworks.newConfigBuilder()
                .defaultSchema(minicloudSchema)
                .parserConfig(parserConfig)
                .operatorTable(SqlStdOperatorTable.instance())
                .build();
    }
    
    /**
     * Create SQL validator for query validation
     */
    @Bean
    public SqlValidator sqlValidator(FrameworkConfig frameworkConfig) {
        logger.info("Initializing SQL validator");
        
        RelDataTypeFactory typeFactory = new SqlTypeFactoryImpl(org.apache.calcite.rel.type.RelDataTypeSystem.DEFAULT);
        
        // Create connection config
        Properties props = new Properties();
        props.setProperty("caseSensitive", "false");
        props.setProperty("conformance", "LENIENT");
        CalciteConnectionConfig connectionConfig = new CalciteConnectionConfigImpl(props);
        
        // Create catalog reader
        CalciteCatalogReader catalogReader = new CalciteCatalogReader(
                CalciteSchema.from(frameworkConfig.getDefaultSchema()),
                Collections.singletonList("minicloud"),
                typeFactory,
                connectionConfig
        );
        
        return SqlValidatorUtil.newValidator(
                frameworkConfig.getOperatorTable(),
                catalogReader,
                typeFactory,
                SqlValidator.Config.DEFAULT
                        .withLenientOperatorLookup(true)
                        .withSqlConformance(SqlConformanceEnum.LENIENT)
                        .withDefaultNullCollation(org.apache.calcite.sql.validate.SqlValidator.Config.DEFAULT.defaultNullCollation())
                        .withTypeCoercionEnabled(true)
        );
    }
    
    /**
     * Create RelOptPlanner for query optimization
     */
    @Bean
    public RelOptPlanner relOptPlanner() {
        logger.info("Initializing RelOpt planner");
        
        VolcanoPlanner planner = new VolcanoPlanner();
        planner.addRelTraitDef(ConventionTraitDef.INSTANCE);
        return planner;
    }
    
    /**
     * Create RelOptCluster for relational algebra operations
     */
    @Bean
    public RelOptCluster relOptCluster(RelOptPlanner planner) {
        RelDataTypeFactory typeFactory = new SqlTypeFactoryImpl(org.apache.calcite.rel.type.RelDataTypeSystem.DEFAULT);
        RexBuilder rexBuilder = new RexBuilder(typeFactory);
        return RelOptCluster.create(planner, rexBuilder);
    }
    
    /**
     * Custom schema for MiniCloud tables
     */
    private static class MiniCloudSchema extends AbstractSchema {
        
        public MiniCloudSchema() {
            super();
        }
        
        protected org.apache.calcite.schema.Table getImplicitTable(String tableName) {
            // For now, return null - tables will be registered dynamically
            // In Phase 2, this will integrate with the metadata service
            return null;
        }
        
        @Override
        public boolean isMutable() {
            return true;  // Allow table creation and modification
        }
    }
}