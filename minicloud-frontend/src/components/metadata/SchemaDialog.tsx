import React from 'react';
import { Copy, FileText, Info } from 'lucide-react';
import type { Column } from '../../types/api';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import {
  Table as UITable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

interface SchemaDialogProps {
  tableName: string;
  schema: Column[];
  trigger?: React.ReactNode;
}

const SchemaDialog: React.FC<SchemaDialogProps> = ({ 
  tableName, 
  schema, 
  trigger 
}) => {
  const getTypeIcon = (type: string): string => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('int') || lowerType.includes('number') || lowerType.includes('decimal')) {
      return '🔢';
    }
    if (lowerType.includes('string') || lowerType.includes('varchar') || lowerType.includes('text')) {
      return '📝';
    }
    if (lowerType.includes('date') || lowerType.includes('time')) {
      return '📅';
    }
    if (lowerType.includes('bool')) {
      return '✓';
    }
    return '📄';
  };

  const getTypeDescription = (type: string): string => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('int')) {
      return 'Integer number';
    }
    if (lowerType.includes('decimal') || lowerType.includes('float') || lowerType.includes('double')) {
      return 'Decimal number';
    }
    if (lowerType.includes('varchar') || lowerType.includes('string')) {
      return 'Text string';
    }
    if (lowerType.includes('text')) {
      return 'Long text';
    }
    if (lowerType.includes('date')) {
      return 'Date value';
    }
    if (lowerType.includes('time')) {
      return 'Time value';
    }
    if (lowerType.includes('bool')) {
      return 'True/false value';
    }
    return 'Data value';
  };

  const copySchemaAsSQL = () => {
    const sqlSchema = `CREATE TABLE ${tableName} (\n${schema
      .map(col => `  ${col.name} ${col.type}${col.nullable ? '' : ' NOT NULL'}`)
      .join(',\n')}\n);`;
    
    navigator.clipboard.writeText(sqlSchema).then(() => {
      console.log('SQL schema copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy schema:', err);
    });
  };

  const copySchemaAsJSON = () => {
    const jsonSchema = JSON.stringify(schema, null, 2);
    
    navigator.clipboard.writeText(jsonSchema).then(() => {
      console.log('JSON schema copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy schema:', err);
    });
  };

  const copyColumnNames = () => {
    const columnNames = schema.map(col => col.name).join(', ');
    
    navigator.clipboard.writeText(columnNames).then(() => {
      console.log('Column names copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy column names:', err);
    });
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Info className="h-4 w-4 mr-2" />
      View Schema
    </Button>
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Schema: {tableName}
          </DialogTitle>
          <DialogDescription>
            Detailed column information and data types for this table
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={copySchemaAsSQL}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy as SQL
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={copySchemaAsJSON}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy as JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={copyColumnNames}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Column Names
            </Button>
          </div>

          {/* Schema table */}
          <div className="flex-1 overflow-auto border rounded-lg">
            <UITable>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Type</TableHead>
                  <TableHead className="min-w-[150px]">Column Name</TableHead>
                  <TableHead className="min-w-[120px]">Data Type</TableHead>
                  <TableHead className="w-20">Nullable</TableHead>
                  <TableHead className="min-w-[200px]">Description</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schema.map((column: Column, index: number) => (
                  <TableRow key={`${column.name}-${index}`}>
                    <TableCell>
                      <span 
                        className="text-lg" 
                        title={getTypeDescription(column.type)}
                      >
                        {getTypeIcon(column.type)}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      <code className="text-sm bg-muted px-1 py-0.5 rounded">
                        {column.name}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {column.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={column.nullable ? "secondary" : "outline"}
                        className="text-xs"
                      >
                        {column.nullable ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {column.description || (
                        <span className="italic">
                          {getTypeDescription(column.type)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(column.name)}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </UITable>
          </div>

          {/* Summary */}
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Total columns: {schema.length}
              </span>
              <span className="text-muted-foreground">
                Nullable columns: {schema.filter(col => col.nullable).length}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SchemaDialog;