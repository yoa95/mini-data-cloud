import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Separator } from '@/components/ui/Separator'
import { ScrollArea } from '@/components/ui/ScrollArea'
import { Switch } from '@/components/ui/Switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/Tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/DropdownMenu'
import {
  Save,
  History,
  Settings,
  FileText,
  Palette,
  Eye,
  EyeOff,
  Zap,
  Sparkles,
  Database,
  Code2,
  MoreHorizontal,
  Download,
  Share,
  Copy,
  Maximize2,
  RefreshCw,
  BookOpen,
  Layers,
  BarChart3,
  Search,
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
import QueryCommandPalette from '@/components/query/QueryCommandPalette'
import QueryStatusBar from '@/components/query/QueryStatusBar'
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
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)

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

  // Handle save query
  const handleSaveQuery = useCallback(() => {
    // TODO: Implement save functionality
    console.log('Save query:', currentQuery)
  }, [currentQuery])

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
    <TooltipProvider>
      <div
        className={`flex flex-col h-full bg-background ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}
      >
        {/* Enhanced Header */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg">
                  <Database className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight">
                    SQL Query Interface
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Write and execute SQL queries against your datasets
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Validation Toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  checked={showValidation}
                  onCheckedChange={setShowValidation}
                  id="validation-toggle"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <label
                      htmlFor="validation-toggle"
                      className="text-sm font-medium cursor-pointer"
                    >
                      Validation
                    </label>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Toggle real-time SQL validation</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <Separator orientation="vertical" className="h-6" />

              {/* Quick Actions */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab('history')}
                  >
                    <History className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Query History</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab('saved')}
                  >
                    <BookOpen className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Saved Queries</p>
                </TooltipContent>
              </Tooltip>

              {/* More Options Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>View Options</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={isFullscreen}
                    onCheckedChange={setIsFullscreen}
                  >
                    <Maximize2 className="w-4 h-4 mr-2" />
                    Fullscreen Mode
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={editorSettings.showMinimap}
                    onCheckedChange={(checked) =>
                      updateEditorSettings({ showMinimap: checked })
                    }
                  >
                    <Layers className="w-4 h-4 mr-2" />
                    Show Minimap
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowCommandPalette(true)}>
                    <Search className="w-4 h-4 mr-2" />
                    Command Palette
                    <span className="ml-auto text-xs text-muted-foreground">
                      Ctrl+K
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="w-4 h-4 mr-2" />
                    Preferences
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Enhanced Main Content */}
        <div className="flex-1 flex gap-6 p-6 overflow-hidden">
          {/* Left Panel - Editor and Controls */}
          <div className="flex-1 flex flex-col gap-6 min-w-0">
            {/* Enhanced Sample Queries */}
            <Card className="shadow-sm border-0 bg-gradient-to-r from-muted/50 to-muted/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-primary/10">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    Quick Start Templates
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveTab('templates')}
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>View all templates</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="w-full">
                  <div className="flex gap-2 pb-2">
                    {sampleQueries.map((sample, index) => (
                      <Tooltip key={index}>
                        <TooltipTrigger asChild>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setCurrentQuery(sample.sql)}
                            className="text-xs font-medium whitespace-nowrap hover:bg-primary/10 transition-colors"
                          >
                            <Database className="w-3 h-3 mr-1.5" />
                            {sample.name}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs text-xs">{sample.sql}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Enhanced SQL Editor */}
            <Card className="flex-1 min-h-96 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-primary/10">
                      <Code2 className="h-4 w-4 text-primary" />
                    </div>
                    SQL Editor
                    {validationResult && !validationResult.isValid && (
                      <Badge variant="destructive" className="ml-2">
                        {validationResult.errors?.length || 0} errors
                      </Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleFormat}
                        >
                          <Palette className="w-4 h-4 mr-2" />
                          Format
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Format SQL (Ctrl+Shift+F)</p>
                      </TooltipContent>
                    </Tooltip>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Save className="w-4 h-4 mr-2" />
                          Save
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Save className="w-4 h-4 mr-2" />
                          Save Query
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy to Clipboard
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Share className="w-4 h-4 mr-2" />
                          Share Query
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                          <Download className="w-4 h-4 mr-2" />
                          Export as File
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="flex-1 rounded-lg border overflow-hidden bg-muted/20">
                  <SqlEditor
                    value={currentQuery}
                    onChange={setCurrentQuery}
                    onExecute={handleExecute}
                    onFormat={handleFormat}
                    height={isFullscreen ? 600 : 400}
                    showMinimap={editorSettings.showMinimap}
                    enableValidation={showValidation}
                    placeholder="-- Enter your SQL query here
-- Example: SELECT * FROM bank_transactions LIMIT 10;
-- Press Ctrl+Enter to execute"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Query Execution Controls */}
            <QueryExecution
              sql={currentQuery}
              onQuerySubmitted={handleQuerySubmitted}
            />
          </div>

          {/* Enhanced Right Panel - Results and Validation */}
          <div
            className={`${isFullscreen ? 'w-full' : 'w-1/2'} flex flex-col gap-4 min-w-0`}
          >
            <Card className="flex-1 min-h-0 shadow-sm">
              <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as any)}
                className="flex flex-col h-full"
              >
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3">
                    {/* Primary Tabs */}
                    <div className="flex items-center justify-between">
                      <TabsList className="grid grid-cols-4 h-10 bg-muted/50">
                        <TabsTrigger
                          value="editor"
                          className="text-xs data-[state=active]:bg-background"
                        >
                          <Settings className="w-3 h-3 mr-1.5" />
                          Settings
                        </TabsTrigger>
                        <TabsTrigger
                          value="results"
                          className="text-xs data-[state=active]:bg-background"
                        >
                          <BarChart3 className="w-3 h-3 mr-1.5" />
                          Results
                          {hasResults && (
                            <Badge
                              variant="secondary"
                              className="ml-1.5 text-xs px-1.5 py-0.5"
                            >
                              {results?.totalRows.toLocaleString()}
                            </Badge>
                          )}
                        </TabsTrigger>
                        <TabsTrigger
                          value="validation"
                          className="text-xs data-[state=active]:bg-background"
                        >
                          <Eye className="w-3 h-3 mr-1.5" />
                          Validation
                          {validationResult &&
                            !validationResult.isValid &&
                            validationResult.errors && (
                              <Badge
                                variant="destructive"
                                className="ml-1.5 text-xs px-1.5 py-0.5"
                              >
                                {validationResult.errors.length}
                              </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger
                          value="performance"
                          className="text-xs data-[state=active]:bg-background"
                        >
                          <Zap className="w-3 h-3 mr-1.5" />
                          Performance
                        </TabsTrigger>
                      </TabsList>

                      {isRunning && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Executing...
                        </div>
                      )}
                    </div>

                    {/* Secondary Tabs */}
                    <TabsList className="grid grid-cols-4 h-10 bg-muted/30">
                      <TabsTrigger
                        value="history"
                        className="text-xs data-[state=active]:bg-background"
                      >
                        <History className="w-3 h-3 mr-1.5" />
                        History
                      </TabsTrigger>
                      <TabsTrigger
                        value="saved"
                        className="text-xs data-[state=active]:bg-background"
                      >
                        <BookOpen className="w-3 h-3 mr-1.5" />
                        Saved
                      </TabsTrigger>
                      <TabsTrigger
                        value="templates"
                        className="text-xs data-[state=active]:bg-background"
                      >
                        <FileText className="w-3 h-3 mr-1.5" />
                        Templates
                      </TabsTrigger>
                      <TabsTrigger
                        value="compare"
                        className="text-xs data-[state=active]:bg-background"
                      >
                        <Layers className="w-3 h-3 mr-1.5" />
                        Compare
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 min-h-0">
                  <ScrollArea className="h-full">
                    <TabsContent value="editor" className="mt-0 h-full">
                      <div className="space-y-6">
                        <div>
                          <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                            <Settings className="w-4 h-4" />
                            Editor Settings
                          </h4>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <label className="text-sm font-medium">
                                  Show Minimap
                                </label>
                                <p className="text-xs text-muted-foreground">
                                  Display code overview
                                </p>
                              </div>
                              <Switch
                                checked={editorSettings.showMinimap}
                                onCheckedChange={(checked) =>
                                  updateEditorSettings({ showMinimap: checked })
                                }
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <label className="text-sm font-medium">
                                  Word Wrap
                                </label>
                                <p className="text-xs text-muted-foreground">
                                  Wrap long lines
                                </p>
                              </div>
                              <Switch
                                checked={editorSettings.wordWrap}
                                onCheckedChange={(checked) =>
                                  updateEditorSettings({ wordWrap: checked })
                                }
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <label className="text-sm font-medium">
                                  Auto Complete
                                </label>
                                <p className="text-xs text-muted-foreground">
                                  Enable IntelliSense
                                </p>
                              </div>
                              <Switch
                                checked={editorSettings.enableAutoCompletion}
                                onCheckedChange={(checked) =>
                                  updateEditorSettings({
                                    enableAutoCompletion: checked,
                                  })
                                }
                              />
                            </div>
                          </div>
                        </div>

                        <Separator />

                        <div>
                          <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                            <Palette className="w-4 h-4" />
                            Appearance
                          </h4>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <label className="text-sm font-medium">
                                  Fullscreen Mode
                                </label>
                                <p className="text-xs text-muted-foreground">
                                  Maximize workspace
                                </p>
                              </div>
                              <Switch
                                checked={isFullscreen}
                                onCheckedChange={setIsFullscreen}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="results" className="mt-0 h-full">
                      {hasResults && results ? (
                        <div className="h-full flex flex-col">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="font-mono">
                                {results.totalRows.toLocaleString()} rows
                              </Badge>
                              <Badge variant="outline" className="font-mono">
                                {results.columns.length} columns
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <Download className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Export Results</p>
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <Copy className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Copy to Clipboard</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                          {selectedQueryId && (
                            <QueryResultsManager
                              results={results}
                              queryId={selectedQueryId}
                              className="flex-1"
                              enableInfiniteScroll={false}
                            />
                          )}
                        </div>
                      ) : isRunning ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                          <div className="relative">
                            <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent" />
                            <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                          </div>
                          <p className="text-muted-foreground mt-4 font-medium">
                            Query is running...
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            This may take a few moments
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                          <div className="p-4 rounded-full bg-muted/50 mb-4">
                            <Database className="h-8 w-8 text-muted-foreground" />
                          </div>
                          <p className="text-muted-foreground font-medium">
                            Execute a query to see results here
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Press Ctrl+Enter in the editor or click the Execute
                            button
                          </p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="validation" className="mt-0 h-full">
                      {showValidation ? (
                        validationResult ? (
                          <QueryValidation
                            validationResult={validationResult}
                            isValidating={isValidating}
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-64 text-center">
                            <Settings className="h-12 w-12 text-muted-foreground/50 mb-4" />
                            <p className="text-muted-foreground">
                              Enter a query to see validation results
                            </p>
                          </div>
                        )
                      ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                          <EyeOff className="h-12 w-12 text-muted-foreground/50 mb-4" />
                          <p className="text-muted-foreground mb-4">
                            Query validation is disabled
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowValidation(true)}
                          >
                            Enable Validation
                          </Button>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="history" className="mt-0 h-full">
                      <QueryHistory
                        onSelectQuery={setCurrentQuery}
                        onExecuteQuery={(sql) => {
                          setCurrentQuery(sql)
                        }}
                      />
                    </TabsContent>

                    <TabsContent value="saved" className="mt-0 h-full">
                      <SavedQueries
                        onSelectQuery={setCurrentQuery}
                        onExecuteQuery={(sql) => {
                          setCurrentQuery(sql)
                        }}
                        currentSql={currentQuery}
                      />
                    </TabsContent>

                    <TabsContent value="templates" className="mt-0 h-full">
                      <QueryTemplates
                        onSelectTemplate={setCurrentQuery}
                        onExecuteTemplate={(sql) => {
                          setCurrentQuery(sql)
                        }}
                      />
                    </TabsContent>

                    <TabsContent value="performance" className="mt-0 h-full">
                      <QueryPerformanceAnalyzer
                        sql={currentQuery}
                        onOptimizationApplied={setCurrentQuery}
                      />
                    </TabsContent>

                    <TabsContent value="compare" className="mt-0 h-full">
                      <QueryComparison
                        initialQueries={currentQuery ? [currentQuery] : []}
                        onQuerySelect={setCurrentQuery}
                      />
                    </TabsContent>
                  </ScrollArea>
                </CardContent>
              </Tabs>
            </Card>
          </div>
        </div>

        {/* Command Palette */}
        <QueryCommandPalette
          open={showCommandPalette}
          onOpenChange={setShowCommandPalette}
          onSelectQuery={setCurrentQuery}
          onExecuteQuery={handleExecute}
          onSaveQuery={handleSaveQuery}
          onFormatQuery={handleFormat}
          currentSql={currentQuery}
        />

        {/* Status Bar */}
        <QueryStatusBar
          isConnected={true}
          activeWorkers={2}
          totalWorkers={3}
          queryCount={12}
          {...(results && { lastExecutionTime: 1250 })}
          validationErrors={
            validationResult && !validationResult.isValid
              ? validationResult.errors?.length || 0
              : 0
          }
          currentDatabase="minicloud"
          memoryUsage="24.5 MB"
        />
      </div>
    </TooltipProvider>
  )
}
