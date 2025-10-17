import React, { useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { 
  FileText, 
  Search, 
  Play, 
  Copy,
  Database,
  BarChart3,
  Filter,
  Zap,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import { useAllTables } from '@/hooks/api/metadata';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

interface QueryTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  sql: string;
  variables: string[];
  tags: string[];
}

interface QueryTemplatesProps {
  onSelectTemplate?: (sql: string) => void;
  onExecuteTemplate?: (sql: string) => void;
  className?: string;
}

export const QueryTemplates: React.FC<QueryTemplatesProps> = ({
  onSelectTemplate,
  onExecuteTemplate,
  className,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  const { toast } = useToast();
  const { data: tables = [] } = useAllTables();

  // Built-in query templates
  const templates: QueryTemplate[] = [
    // Basic Queries
    {
      id: 'select-all',
      name: 'Select All Records',
      description: 'Retrieve all records from a table',
      category: 'Basic',
      icon: <Database className="w-4 h-4" />,
      sql: 'SELECT * FROM {table_name} LIMIT 100;',
      variables: ['table_name'],
      tags: ['select', 'basic'],
    },
    {
      id: 'count-records',
      name: 'Count Records',
      description: 'Count total number of records in a table',
      category: 'Basic',
      icon: <BarChart3 className="w-4 h-4" />,
      sql: 'SELECT COUNT(*) as total_records FROM {table_name};',
      variables: ['table_name'],
      tags: ['count', 'aggregate'],
    },
    {
      id: 'table-schema',
      name: 'Describe Table Schema',
      description: 'Show column information for a table',
      category: 'Basic',
      icon: <FileText className="w-4 h-4" />,
      sql: 'DESCRIBE {table_name};',
      variables: ['table_name'],
      tags: ['schema', 'metadata'],
    },

    // Filtering
    {
      id: 'filter-by-value',
      name: 'Filter by Value',
      description: 'Filter records by a specific column value',
      category: 'Filtering',
      icon: <Filter className="w-4 h-4" />,
      sql: 'SELECT * FROM {table_name}\nWHERE {column_name} = \'{value}\'\nLIMIT 100;',
      variables: ['table_name', 'column_name', 'value'],
      tags: ['filter', 'where'],
    },
    {
      id: 'filter-by-range',
      name: 'Filter by Range',
      description: 'Filter records within a numeric range',
      category: 'Filtering',
      icon: <Filter className="w-4 h-4" />,
      sql: 'SELECT * FROM {table_name}\nWHERE {column_name} BETWEEN {min_value} AND {max_value}\nLIMIT 100;',
      variables: ['table_name', 'column_name', 'min_value', 'max_value'],
      tags: ['filter', 'range', 'between'],
    },
    {
      id: 'filter-by-date',
      name: 'Filter by Date Range',
      description: 'Filter records within a date range',
      category: 'Filtering',
      icon: <Calendar className="w-4 h-4" />,
      sql: 'SELECT * FROM {table_name}\nWHERE {date_column} >= \'{start_date}\'\n  AND {date_column} <= \'{end_date}\'\nLIMIT 100;',
      variables: ['table_name', 'date_column', 'start_date', 'end_date'],
      tags: ['filter', 'date', 'time'],
    },

    // Aggregation
    {
      id: 'group-by-count',
      name: 'Group by Count',
      description: 'Count records grouped by a column',
      category: 'Aggregation',
      icon: <BarChart3 className="w-4 h-4" />,
      sql: 'SELECT {column_name}, COUNT(*) as count\nFROM {table_name}\nGROUP BY {column_name}\nORDER BY count DESC;',
      variables: ['table_name', 'column_name'],
      tags: ['group by', 'count', 'aggregate'],
    },
    {
      id: 'sum-by-group',
      name: 'Sum by Group',
      description: 'Sum numeric values grouped by a column',
      category: 'Aggregation',
      icon: <TrendingUp className="w-4 h-4" />,
      sql: 'SELECT {group_column}, SUM({sum_column}) as total\nFROM {table_name}\nGROUP BY {group_column}\nORDER BY total DESC;',
      variables: ['table_name', 'group_column', 'sum_column'],
      tags: ['group by', 'sum', 'aggregate'],
    },
    {
      id: 'avg-by-group',
      name: 'Average by Group',
      description: 'Calculate average values grouped by a column',
      category: 'Aggregation',
      icon: <TrendingUp className="w-4 h-4" />,
      sql: 'SELECT {group_column}, AVG({avg_column}) as average\nFROM {table_name}\nGROUP BY {group_column}\nORDER BY average DESC;',
      variables: ['table_name', 'group_column', 'avg_column'],
      tags: ['group by', 'average', 'aggregate'],
    },

    // Analysis
    {
      id: 'top-n-records',
      name: 'Top N Records',
      description: 'Get top N records ordered by a column',
      category: 'Analysis',
      icon: <TrendingUp className="w-4 h-4" />,
      sql: 'SELECT * FROM {table_name}\nORDER BY {order_column} DESC\nLIMIT {n};',
      variables: ['table_name', 'order_column', 'n'],
      tags: ['top', 'order by', 'limit'],
    },
    {
      id: 'distinct-values',
      name: 'Distinct Values',
      description: 'Get unique values from a column',
      category: 'Analysis',
      icon: <Zap className="w-4 h-4" />,
      sql: 'SELECT DISTINCT {column_name}\nFROM {table_name}\nORDER BY {column_name};',
      variables: ['table_name', 'column_name'],
      tags: ['distinct', 'unique'],
    },
    {
      id: 'null-check',
      name: 'Check for Null Values',
      description: 'Find records with null values in a column',
      category: 'Analysis',
      icon: <Search className="w-4 h-4" />,
      sql: 'SELECT COUNT(*) as null_count\nFROM {table_name}\nWHERE {column_name} IS NULL;',
      variables: ['table_name', 'column_name'],
      tags: ['null', 'data quality'],
    },

    // Performance
    {
      id: 'sample-data',
      name: 'Sample Data',
      description: 'Get a random sample of records',
      category: 'Performance',
      icon: <Zap className="w-4 h-4" />,
      sql: 'SELECT * FROM {table_name}\nORDER BY RANDOM()\nLIMIT {sample_size};',
      variables: ['table_name', 'sample_size'],
      tags: ['sample', 'random'],
    },
  ];

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category)))];

  // Filter templates
  const filteredTemplates = React.useMemo(() => {
    let filtered = templates;

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(template => 
        template.name.toLowerCase().includes(searchLower) ||
        template.description.toLowerCase().includes(searchLower) ||
        template.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(template => template.category === categoryFilter);
    }

    return filtered;
  }, [searchTerm, categoryFilter]);

  // Handle template selection
  const handleSelectTemplate = useCallback((template: QueryTemplate) => {
    let sql = template.sql;
    
    // If we have tables, try to substitute the first table
    if (tables.length > 0 && template.variables.includes('table_name')) {
      const defaultTable = tables[0];
      sql = sql.replace('{table_name}', `${defaultTable.namespaceName}.${defaultTable.tableName}`);
    }
    
    onSelectTemplate?.(sql);
    toast({
      title: 'Template Loaded',
      description: `"${template.name}" template has been loaded into the editor.`,
      variant: 'success',
    });
  }, [onSelectTemplate, tables, toast]);

  // Handle template execution
  const handleExecuteTemplate = useCallback((template: QueryTemplate) => {
    let sql = template.sql;
    
    // If we have tables, try to substitute the first table
    if (tables.length > 0 && template.variables.includes('table_name')) {
      const defaultTable = tables[0];
      sql = sql.replace('{table_name}', `${defaultTable.namespaceName}.${defaultTable.tableName}`);
    }
    
    onExecuteTemplate?.(sql);
    toast({
      title: 'Template Executing',
      description: `"${template.name}" template has been submitted for execution.`,
      variant: 'info',
    });
  }, [onExecuteTemplate, tables, toast]);

  // Copy template to clipboard
  const handleCopyTemplate = useCallback((template: QueryTemplate) => {
    navigator.clipboard.writeText(template.sql).then(() => {
      toast({
        title: 'Template Copied',
        description: 'Template SQL has been copied to clipboard.',
        variant: 'success',
      });
    }).catch(() => {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy template to clipboard.',
        variant: 'error',
      });
    });
  }, [toast]);

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            <h3 className="font-semibold">Query Templates</h3>
            <Badge variant="outline">{filteredTemplates.length}</Badge>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1 border border-border rounded-md text-sm bg-background"
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All Categories' : category}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Template Grid */}
      <div className="p-4">
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              {searchTerm || categoryFilter !== 'all' 
                ? 'No templates match your filters' 
                : 'No templates available'
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTemplates.map((template) => (
              <Card key={template.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {template.icon}
                    <h4 className="font-medium">{template.name}</h4>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {template.category}
                  </Badge>
                </div>
                
                <p className="text-sm text-muted-foreground mb-3">
                  {template.description}
                </p>
                
                <div className="bg-muted/50 rounded-md p-2 mb-3">
                  <code className="text-xs font-mono text-muted-foreground">
                    {template.sql.split('\n')[0]}
                    {template.sql.includes('\n') && '...'}
                  </code>
                </div>
                
                {template.variables.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-muted-foreground mb-1">Variables:</p>
                    <div className="flex flex-wrap gap-1">
                      {template.variables.map(variable => (
                        <Badge key={variable} variant="secondary" className="text-xs">
                          {variable}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex flex-wrap gap-1 mb-3">
                  {template.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handleSelectTemplate(template)}
                    size="sm"
                    className="flex-1"
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Use Template
                  </Button>
                  
                  <Button
                    onClick={() => handleCopyTemplate(template)}
                    variant="outline"
                    size="sm"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};

export default QueryTemplates;