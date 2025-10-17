import React, { useCallback, useEffect, useRef, useState } from 'react';
import Editor, { type Monaco } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useTheme } from '@/components/theme/ThemeProvider';
import { useAllTables } from '@/hooks/api/metadata';
import { useValidateQuery } from '@/hooks/api/queries';
import { cn } from '@/lib/utils';
import type { DiagnosticError, DiagnosticWarning } from '@/types/api';

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute?: () => void;
  onFormat?: () => void;
  readOnly?: boolean;
  height?: string | number;
  className?: string;
  showMinimap?: boolean;
  enableValidation?: boolean;
  placeholder?: string;
}

interface CompletionItem {
  label: string;
  kind: monaco.languages.CompletionItemKind;
  insertText: string;
  documentation?: string;
  detail?: string;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({
  value,
  onChange,
  onExecute,
  onFormat,
  readOnly = false,
  height = 300,
  className,
  showMinimap = true,
  enableValidation = true,
  placeholder = 'Enter your SQL query here...',
}) => {
  let theme = 'light';
  try {
    const themeContext = useTheme();
    theme = themeContext.theme;
  } catch (error) {
    // Fallback to light theme if ThemeProvider is not available
    console.warn('ThemeProvider not found, using light theme');
  }
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  
  // Fetch tables for auto-completion
  const { data: tables = [] } = useAllTables();
  
  // Query validation
  const { data: validationResult } = useValidateQuery(value, {
    enabled: enableValidation && value.trim().length > 0,
  });

  // SQL keywords for completion
  const sqlKeywords = [
    'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT',
    'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TABLE',
    'INDEX', 'VIEW', 'DATABASE', 'SCHEMA', 'NAMESPACE',
    'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'CROSS JOIN',
    'UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT',
    'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'IS NULL', 'IS NOT NULL',
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'DISTINCT',
    'AS', 'ASC', 'DESC', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'TRUE', 'FALSE', 'NULL'
  ];

  // SQL functions for completion
  const sqlFunctions = [
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
    'UPPER', 'LOWER', 'LENGTH', 'SUBSTRING', 'TRIM',
    'COALESCE', 'NULLIF', 'CAST', 'CONVERT',
    'NOW', 'CURRENT_DATE', 'CURRENT_TIME', 'CURRENT_TIMESTAMP',
    'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND'
  ];

  // Generate completion items from tables
  const generateCompletionItems = useCallback((): CompletionItem[] => {
    const items: CompletionItem[] = [];

    // Add SQL keywords
    sqlKeywords.forEach(keyword => {
      items.push({
        label: keyword,
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: keyword,
        detail: 'SQL Keyword',
      });
    });

    // Add SQL functions
    sqlFunctions.forEach(func => {
      items.push({
        label: func,
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: `${func}()`,
        detail: 'SQL Function',
      });
    });

    // Add tables
    tables.forEach(table => {
      const fullTableName = `${table.namespaceName}.${table.tableName}`;
      
      // Add full table name
      items.push({
        label: fullTableName,
        kind: monaco.languages.CompletionItemKind.Class,
        insertText: fullTableName,
        detail: `Table (${table.rowCount || 0} rows)`,
        documentation: `Table: ${fullTableName}\nLocation: ${table.tableLocation}`,
      });

      // Add table name without namespace for default namespace
      if (table.namespaceName === 'default') {
        items.push({
          label: table.tableName,
          kind: monaco.languages.CompletionItemKind.Class,
          insertText: table.tableName,
          detail: `Table (${table.rowCount || 0} rows)`,
          documentation: `Table: ${table.tableName}\nLocation: ${table.tableLocation}`,
        });
      }
    });

    return items;
  }, [tables]);

  // Setup Monaco editor
  const handleEditorDidMount = useCallback((editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setIsEditorReady(true);

    // Configure SQL language
    monaco.languages.register({ id: 'sql' });

    // Set SQL language configuration
    monaco.languages.setLanguageConfiguration('sql', {
      comments: {
        lineComment: '--',
        blockComment: ['/*', '*/'],
      },
      brackets: [
        ['(', ')'],
        ['[', ']'],
      ],
      autoClosingPairs: [
        { open: '(', close: ')' },
        { open: '[', close: ']' },
        { open: "'", close: "'" },
        { open: '"', close: '"' },
      ],
      surroundingPairs: [
        { open: '(', close: ')' },
        { open: '[', close: ']' },
        { open: "'", close: "'" },
        { open: '"', close: '"' },
      ],
    });

    // Set SQL syntax highlighting
    monaco.languages.setMonarchTokensProvider('sql', {
      defaultToken: '',
      tokenPostfix: '.sql',
      ignoreCase: true,

      keywords: sqlKeywords.map(k => k.toLowerCase()),
      
      operators: [
        '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
        '<>', '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%',
        '<<', '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=', '^=',
        '%=', '<<=', '>>=', '>>>='
      ],

      symbols: /[=><!~?:&|+\-*\/\^%]+/,

      tokenizer: {
        root: [
          [/[a-z_$][\w$]*/, {
            cases: {
              '@keywords': 'keyword',
              '@default': 'identifier'
            }
          }],
          [/[A-Z][\w\$]*/, {
            cases: {
              '@keywords': 'keyword',
              '@default': 'type.identifier'
            }
          }],

          { include: '@whitespace' },

          [/[{}()\[\]]/, '@brackets'],
          [/[<>](?!@symbols)/, '@brackets'],
          [/@symbols/, {
            cases: {
              '@operators': 'operator',
              '@default': ''
            }
          }],

          [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
          [/0[xX][0-9a-fA-F]+/, 'number.hex'],
          [/\d+/, 'number'],

          [/[;,.]/, 'delimiter'],

          [/'([^'\\]|\\.)*$/, 'string.invalid'],
          [/'/, { token: 'string.quote', bracket: '@open', next: '@string' }],

          [/"([^"\\]|\\.)*$/, 'string.invalid'],
          [/"/, { token: 'string.quote', bracket: '@open', next: '@dblstring' }],
        ],

        comment: [
          [/[^\/*]+/, 'comment'],
          [/\/\*/, 'comment', '@push'],
          ["\\*/", 'comment', '@pop'],
          [/[\/*]/, 'comment']
        ],

        string: [
          [/[^\\']+/, 'string'],
          [/\\./, 'string.escape.invalid'],
          [/'/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
        ],

        dblstring: [
          [/[^\\"]+/, 'string'],
          [/\\./, 'string.escape.invalid'],
          [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
        ],

        whitespace: [
          [/[ \t\r\n]+/, 'white'],
          [/\/\*/, 'comment', '@comment'],
          [/--.*$/, 'comment'],
        ],
      },
    });

    // Register completion provider
    monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const completionItems = generateCompletionItems();

        return {
          suggestions: completionItems.map(item => ({
            label: item.label,
            kind: item.kind,
            insertText: item.insertText,
            range: range,
            detail: item.detail || '',
            documentation: item.documentation || '',
          })),
        };
      },
    });

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onExecute?.();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
      onFormat?.();
    });

    // Set placeholder if empty
    if (!value && placeholder) {
      editor.setValue(placeholder);
      editor.setSelection(new monaco.Selection(1, 1, 1, placeholder.length + 1));
    }
  }, [generateCompletionItems, onExecute, onFormat, placeholder, value]);

  // Update validation markers
  useEffect(() => {
    if (!isEditorReady || !editorRef.current || !monacoRef.current || !enableValidation) {
      return;
    }

    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor.getModel();
    
    if (!model) return;

    const markers: monaco.editor.IMarkerData[] = [];

    // Add error markers
    if (validationResult?.errors) {
      validationResult.errors.forEach((error: DiagnosticError) => {
        markers.push({
          severity: monaco.MarkerSeverity.Error,
          startLineNumber: error.line,
          startColumn: error.column,
          endLineNumber: error.endLine,
          endColumn: error.endColumn,
          message: error.message,
          code: error.code,
        });
      });
    }

    // Add warning markers
    if (validationResult?.warnings) {
      validationResult.warnings.forEach((warning: DiagnosticWarning) => {
        markers.push({
          severity: monaco.MarkerSeverity.Warning,
          startLineNumber: warning.line,
          startColumn: warning.column,
          endLineNumber: warning.line,
          endColumn: warning.column + 1,
          message: warning.message,
          code: warning.code,
        });
      });
    }

    monaco.editor.setModelMarkers(model, 'sql-validation', markers);
  }, [validationResult, isEditorReady, enableValidation]);

  // Format SQL query
  const formatQuery = useCallback(() => {
    if (!editorRef.current) return;
    
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    // Simple SQL formatting - in a real app, you'd use a proper SQL formatter
    const formatted = value
      .replace(/\s+/g, ' ')
      .replace(/\s*,\s*/g, ',\n  ')
      .replace(/\bSELECT\b/gi, 'SELECT')
      .replace(/\bFROM\b/gi, '\nFROM')
      .replace(/\bWHERE\b/gi, '\nWHERE')
      .replace(/\bGROUP BY\b/gi, '\nGROUP BY')
      .replace(/\bHAVING\b/gi, '\nHAVING')
      .replace(/\bORDER BY\b/gi, '\nORDER BY')
      .replace(/\bLIMIT\b/gi, '\nLIMIT')
      .trim();

    editor.setValue(formatted);
    onChange(formatted);
  }, [value, onChange]);

  // Expose format function
  useEffect(() => {
    if (onFormat && isEditorReady) {
      // Replace the onFormat callback with our internal formatter
      onFormat = formatQuery;
    }
  }, [formatQuery, onFormat, isEditorReady]);

  return (
    <div className={cn('border rounded-md overflow-hidden', className)}>
      <Editor
        height={height}
        language="sql"
        theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
        value={value}
        onChange={(newValue) => onChange(newValue || '')}
        onMount={handleEditorDidMount}
        options={{
          readOnly,
          minimap: { enabled: showMinimap },
          fontSize: 14,
          lineNumbers: 'on',
          roundedSelection: false,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
          wordWrap: 'on',
          contextmenu: true,
          selectOnLineNumbers: true,
          glyphMargin: true,
          folding: true,
          foldingStrategy: 'indentation',
          showFoldingControls: 'always',
          matchBrackets: 'always',
          autoIndent: 'full',
          formatOnPaste: true,
          formatOnType: true,
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: 'on',
          tabCompletion: 'on',
          wordBasedSuggestions: 'off',
          parameterHints: {
            enabled: true,
          },
          quickSuggestions: {
            other: true,
            comments: false,
            strings: false,
          },
        }}
      />
    </div>
  );
};

export default SqlEditor;