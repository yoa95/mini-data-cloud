import { useState, useCallback, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import {
  Play,
  Save,
  History,
  Settings,
  FileText,
  Palette,
  Eye,
  EyeOff,
  Zap,
} from 'lucide-react'
import SqlEditor from '@/components/query/SqlEditor'
import QueryExecution from '@/components/query/QueryExecution'
import QueryResultsManager from '@/components/query/QueryResultsManager'
import QueryValidation from '@/components/query/QueryValidation'
import QueryHistory from '@/components/query/QueryHistory'
import SavedQueries from '@/components/query/SavedQueries'
import QueryTemplates from '@/components/query/QueryTemplates'
import QueryPerformanceAnalyzer from '@/components/query/QueryPerformanceAnalyzer'
import QueryComparison from '@/components/query/QueryComparison'
import { useQueryLifecycle, useValidateQuery } from '@/hooks/api/queries'
import { useQueryEditorStore } from '@/store/query-editor-store'

export default function QueryInterface() {
  const {
    currentSql: currentQuery,
    setCurrentSql: setCurrentQuery,
    editorSettings,
    updateEditorSettings,
  } = useQueryEditorStore()

  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<
    | 'editor'
    | 'results'
    | 'validation'
    | 'history'
    | 'saved'
    | 'templates'
    | 'performance'
    | 'compare'
  >('editor')
  const [showValidation, setShowValidation] = useState(true)

  // Query lifecycle management
  const { results, isRunning, isCompleted, hasResults } = useQueryLifecycle(
    selectedQueryId || ''
  )

  // Query validation
  const { data: validationResult, isLoading: isValidating } = useValidateQuery(
    currentQuery,
    {
      enabled: showValidation && currentQuery.trim().length > 0,
    }
  )

  // Handle query submission
  const handleQuerySubmitted = useCallback(
    (queryId: string) => {
      setSelectedQueryId(queryId)
      setActiveTab('results')
    },
    [setSelectedQueryId]
  )

  // Handle query execution
  const handleExecute = useCallback(() => {
    // This will be handled by the QueryExecution component
  }, [])

  // Handle query formatting
  const handleFormat = useCallback(() => {
    // Simple SQL formatting
    const formatted = currentQuery
      .replace(/\s+/g, ' ')
      .replace(/\s*,\s*/g, ',\n  ')
      .replace(/\bSELECT\b/gi, 'SELECT')
      .replace(/\bFROM\b/gi, '\nFROM')
      .replace(/\bWHERE\b/gi, '\nWHERE')
      .replace(/\bGROUP BY\b/gi, '\nGROUP BY')
      .replace(/\bHAVING\b/gi, '\nHAVING')
      .replace(/\bORDER BY\b/gi, '\nORDER BY')
      .replace(/\bLIMIT\b/gi, '\nLIMIT')
      .trim()

    setCurrentQuery(formatted)
  }, [currentQuery, setCurrentQuery])

  // Auto-switch to results tab when query completes
  useEffect(() => {
    if (isCompleted && hasResults) {
      setActiveTab('results')
    }
  }, [isCompleted, hasResults])

  // Sample queries for quick start
  const sampleQueries = [
    {
      name: 'List all tables',
      sql: 'SELECT * FROM information_schema.tables;',
    },
    {
      name: 'Count rows in bank_transactions',
      sql: 'SELECT COUNT(*) as total_transactions FROM bank_transactions;',
    },
    {
      name: 'Top 10 transactions by amount',
      sql: 'SELECT * FROM bank_transactions ORDER BY amount DESC LIMIT 10;',
    },
    {
      name: 'Average transaction by category',
      sql: 'SELECT category, AVG(amount) as avg_amount, COUNT(*) as count\nFROM bank_transactions\nGROUP BY category\nORDER BY avg_amount DESC;',
    },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold">SQL Query Interface</h1>
          <p className="text-muted-foreground">
            Write and execute SQL queries against your datasets
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowValidation(!showValidation)}
          >
            {showValidation ? (
              <EyeOff className="w-4 h-4 mr-2" />
            ) : (
              <Eye className="w-4 h-4 mr-2" />
            )}
            Validation
          </Button>

          <Button variant="outline" size="sm">
            <History className="w-4 h-4 mr-2" />
            History
          </Button>

          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 p-6 overflow-hidden">
        {/* Left Panel - Editor and Controls */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {/* Sample Queries */}
          <Card className="p-4">
            <h3 className="font-medium mb-3">Quick Start</h3>
            <div className="flex flex-wrap gap-2">
              {sampleQueries.map((sample, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentQuery(sample.sql)}
                  className="text-xs"
                >
                  {sample.name}
                </Button>
              ))}
            </div>
          </Card>

          {/* SQL Editor */}
          <Card className="flex-1 p-4 min-h-96">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">SQL Editor</h3>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleFormat}>
                  <Palette className="w-4 h-4 mr-2" />
                  Format
                </Button>

                <Button variant="outline" size="sm">
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </div>
            </div>

            <SqlEditor
              value={currentQuery}
              onChange={setCurrentQuery}
              onExecute={handleExecute}
              onFormat={handleFormat}
              height={400}
              showMinimap={editorSettings.showMinimap}
              enableValidation={showValidation}
              placeholder="-- Enter your SQL query here
-- Example: SELECT * FROM bank_transactions LIMIT 10;"
            />
          </Card>

          {/* Query Execution Controls */}
          <QueryExecution
            sql={currentQuery}
            onQuerySubmitted={handleQuerySubmitted}
          />
        </div>

        {/* Right Panel - Results and Validation */}
        <div className="w-1/2 flex flex-col gap-4 min-w-0">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as any)}
          >
            <div className="flex flex-wrap gap-1">
              <TabsList className="grid grid-cols-4">
                <TabsTrigger value="editor" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Editor
                </TabsTrigger>
                <TabsTrigger
                  value="results"
                  className="flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  Results
                  {hasResults && (
                    <Badge variant="success" className="ml-1 text-xs">
                      {results?.totalRows.toLocaleString()}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="validation"
                  className="flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  Validation
                  {validationResult &&
                    !validationResult.isValid &&
                    validationResult.errors && (
                      <Badge variant="destructive" className="ml-1 text-xs">
                        {validationResult.errors.length}
                      </Badge>
                    )}
                </TabsTrigger>
                <TabsTrigger
                  value="performance"
                  className="flex items-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  Performance
                </TabsTrigger>
              </TabsList>

              <TabsList className="grid grid-cols-4">
                <TabsTrigger
                  value="history"
                  className="flex items-center gap-2"
                >
                  <History className="w-4 h-4" />
                  History
                </TabsTrigger>
                <TabsTrigger value="saved" className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  Saved
                </TabsTrigger>
                <TabsTrigger
                  value="templates"
                  className="flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Templates
                </TabsTrigger>
                <TabsTrigger
                  value="compare"
                  className="flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  Compare
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="editor" className="mt-4">
              <Card className="p-4">
                <h3 className="font-medium mb-3">Editor Settings</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editorSettings.showMinimap}
                      onChange={(e) =>
                        updateEditorSettings({ showMinimap: e.target.checked })
                      }
                      className="rounded"
                    />
                    <span className="text-sm">Show Minimap</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editorSettings.wordWrap}
                      onChange={(e) =>
                        updateEditorSettings({ wordWrap: e.target.checked })
                      }
                      className="rounded"
                    />
                    <span className="text-sm">Word Wrap</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editorSettings.enableAutoCompletion}
                      onChange={(e) =>
                        updateEditorSettings({
                          enableAutoCompletion: e.target.checked,
                        })
                      }
                      className="rounded"
                    />
                    <span className="text-sm">Auto Complete</span>
                  </label>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="results" className="mt-4 flex-1 min-h-0">
              {hasResults && results ? (
                <QueryResultsManager
                  results={results}
                  queryId={selectedQueryId ?? undefined}
                  className="h-full"
                  enableInfiniteScroll={false}
                />
              ) : isRunning ? (
                <Card className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto mb-4" />
                  <p className="text-muted-foreground">Query is running...</p>
                </Card>
              ) : (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">
                    Execute a query to see results here
                  </p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="validation" className="mt-4">
              {showValidation ? (
                validationResult ? (
                  <QueryValidation
                    validationResult={validationResult}
                    isValidating={isValidating}
                  />
                ) : (
                  <Card className="p-8 text-center">
                    <p className="text-muted-foreground">
                      Enter a query to see validation results
                    </p>
                  </Card>
                )
              ) : (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">
                    Query validation is disabled
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => setShowValidation(true)}
                  >
                    Enable Validation
                  </Button>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <QueryHistory
                onSelectQuery={setCurrentQuery}
                onExecuteQuery={(sql) => {
                  setCurrentQuery(sql)
                  // Auto-execute could be added here if desired
                }}
              />
            </TabsContent>

            <TabsContent value="saved" className="mt-4">
              <SavedQueries
                onSelectQuery={setCurrentQuery}
                onExecuteQuery={(sql) => {
                  setCurrentQuery(sql)
                  // Auto-execute could be added here if desired
                }}
                currentSql={currentQuery}
              />
            </TabsContent>

            <TabsContent value="templates" className="mt-4">
              <QueryTemplates
                onSelectTemplate={setCurrentQuery}
                onExecuteTemplate={(sql) => {
                  setCurrentQuery(sql)
                  // Auto-execute could be added here if desired
                }}
              />
            </TabsContent>

            <TabsContent value="performance" className="mt-4">
              <QueryPerformanceAnalyzer
                sql={currentQuery}
                onOptimizationApplied={setCurrentQuery}
              />
            </TabsContent>

            <TabsContent value="compare" className="mt-4">
              <QueryComparison
                initialQueries={currentQuery ? [currentQuery] : []}
                onQuerySelect={setCurrentQuery}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
