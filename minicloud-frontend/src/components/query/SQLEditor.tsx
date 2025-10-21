import React, { useRef, useCallback, useEffect, useState } from "react";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Play, Save, History, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SQLEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: (sql: string) => void;
  onSave?: (sql: string) => void;
  onShowHistory?: () => void;
  isExecuting?: boolean;
  availableTables?: string[];
  availableColumns?: Record<string, string[]>;
  className?: string;
}

const SQLEditor: React.FC<SQLEditorProps> = ({
  value,
  onChange,
  onExecute,
  onSave,
  onShowHistory,
  isExecuting = false,
  availableTables = [],
  availableColumns = {},
  className,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);

  // Accept a suggestion
  const acceptSuggestion = useCallback(
    (suggestion: string) => {
      if (!textareaRef.current) return;

      const textarea = textareaRef.current;
      const textBeforeCursor = value.substring(0, cursorPosition);
      const textAfterCursor = value.substring(cursorPosition);
      const words = textBeforeCursor.split(/\s+/);
      const currentWord = words[words.length - 1] || "";

      // Replace the current word with the suggestion
      const beforeCurrentWord = textBeforeCursor.substring(
        0,
        textBeforeCursor.lastIndexOf(currentWord)
      );
      const newValue = beforeCurrentWord + suggestion + textAfterCursor;

      onChange(newValue);
      setShowSuggestions(false);

      // Set cursor position after the suggestion
      setTimeout(() => {
        const newCursorPos = beforeCurrentWord.length + suggestion.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }, 0);
    },
    [value, cursorPosition, onChange]
  );

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl+Enter or Cmd+Enter to execute query
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        if (value.trim() && !isExecuting) {
          // Clean up SQL by removing trailing semicolons and whitespace
          const cleanedSql = value.trim().replace(/;+\s*$/, "");
          onExecute(cleanedSql);
        }
      }

      // Ctrl+S or Cmd+S to save query
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        if (onSave && value.trim()) {
          onSave(value);
        }
      }

      // Escape to hide suggestions
      if (event.key === "Escape") {
        setShowSuggestions(false);
      }

      // Tab to accept first suggestion
      if (event.key === "Tab" && showSuggestions && suggestions.length > 0) {
        event.preventDefault();
        // Handle suggestion acceptance inline to avoid dependency issues
        if (textareaRef.current && suggestions.length > 0) {
          const suggestion = suggestions[0];
          const textarea = textareaRef.current;
          const textBeforeCursor = value.substring(0, cursorPosition);
          const textAfterCursor = value.substring(cursorPosition);
          const words = textBeforeCursor.split(/\s+/);
          const currentWord = words[words.length - 1] || "";

          const beforeCurrentWord = textBeforeCursor.substring(
            0,
            textBeforeCursor.lastIndexOf(currentWord)
          );
          const newValue = beforeCurrentWord + suggestion + textAfterCursor;

          onChange(newValue);
          setShowSuggestions(false);

          setTimeout(() => {
            const newCursorPos = beforeCurrentWord.length + suggestion.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
            textarea.focus();
          }, 0);
        }
      }
    },
    [
      showSuggestions,
      suggestions,
      value,
      isExecuting,
      onExecute,
      onSave,
      cursorPosition,
      onChange,
    ]
  );

  // Handle input changes and auto-completion
  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = event.target.value;
      const cursorPos = event.target.selectionStart;

      onChange(newValue);
      setCursorPosition(cursorPos);

      // Simple auto-completion logic
      const textBeforeCursor = newValue.substring(0, cursorPos);
      const words = textBeforeCursor.split(/\s+/);
      const currentWord = words[words.length - 1]?.toLowerCase() || "";

      if (currentWord.length >= 2) {
        const tableSuggestions = availableTables.filter((table) =>
          table.toLowerCase().includes(currentWord)
        );

        // Check if we're after FROM or JOIN keywords for table suggestions
        const beforeCurrentWord = textBeforeCursor.substring(
          0,
          textBeforeCursor.lastIndexOf(currentWord)
        );
        const isAfterFrom = /\b(from|join)\s*$/i.test(beforeCurrentWord);

        if (isAfterFrom && tableSuggestions.length > 0) {
          setSuggestions(tableSuggestions);
          setShowSuggestions(true);
        } else {
          // Check for column suggestions after table name
          const tableMatch = beforeCurrentWord.match(/\b(\w+)\.\s*$/);
          if (tableMatch) {
            const tableName = tableMatch[1];
            const columns = availableColumns[tableName] || [];
            const columnSuggestions = columns.filter((col) =>
              col.toLowerCase().includes(currentWord)
            );

            if (columnSuggestions.length > 0) {
              setSuggestions(columnSuggestions);
              setShowSuggestions(true);
            } else {
              setShowSuggestions(false);
            }
          } else {
            setShowSuggestions(false);
          }
        }
      } else {
        setShowSuggestions(false);
      }
    },
    [onChange, availableTables, availableColumns]
  );

  // Focus the textarea when component mounts
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  return (
    <Card className={cn("relative", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">SQL Editor</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              Ctrl+Enter to execute
            </Badge>
            {onSave && (
              <Badge variant="secondary" className="text-xs">
                Ctrl+S to save
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Enter your SQL query here... (e.g., SELECT * FROM table_name LIMIT 10)"
            className="min-h-[200px] font-mono text-sm resize-y"
            disabled={isExecuting}
          />

          {/* Auto-completion suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-popover border border-border rounded-md shadow-md max-h-40 overflow-y-auto">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
                  onClick={() => acceptSuggestion(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                // Clean up SQL by removing trailing semicolons and whitespace
                const cleanedSql = value.trim().replace(/;+\s*$/, "");
                onExecute(cleanedSql);
              }}
              disabled={!value.trim() || isExecuting}
              size="sm"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Execute Query
                </>
              )}
            </Button>

            {onSave && (
              <Button
                variant="outline"
                onClick={() => onSave(value)}
                disabled={!value.trim()}
                size="sm"
              >
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            )}
          </div>

          {onShowHistory && (
            <Button variant="ghost" onClick={onShowHistory} size="sm">
              <History className="h-4 w-4 mr-2" />
              History
            </Button>
          )}
        </div>

        {/* Available tables info */}
        {availableTables.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">Available tables:</span>{" "}
            {availableTables.join(", ")}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SQLEditor;
