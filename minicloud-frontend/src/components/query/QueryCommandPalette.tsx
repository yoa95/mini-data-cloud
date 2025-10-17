import { useState, useEffect } from 'react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/Command'
import {
  Database,
  History,
  BookOpen,
  FileText,
  Play,
  Save,
  Copy,
  Settings,
  Palette,
  Search,
} from 'lucide-react'

interface QueryCommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectQuery: (sql: string) => void
  onExecuteQuery: () => void
  onSaveQuery: () => void
  onFormatQuery: () => void
  currentSql: string
}

export default function QueryCommandPalette({
  open,
  onOpenChange,
  onSelectQuery,
  onExecuteQuery,
  onSaveQuery,
  onFormatQuery,
  currentSql,
}: QueryCommandPaletteProps) {
  const [searchTerm, setSearchTerm] = useState('')

  // Sample queries for quick access
  const sampleQueries = [
    {
      name: 'List all tables',
      sql: 'SELECT * FROM information_schema.tables;',
      category: 'Schema',
    },
    {
      name: 'Count rows in bank_transactions',
      sql: 'SELECT COUNT(*) as total_transactions FROM bank_transactions;',
      category: 'Analytics',
    },
    {
      name: 'Top 10 transactions by amount',
      sql: 'SELECT * FROM bank_transactions ORDER BY amount DESC LIMIT 10;',
      category: 'Analytics',
    },
    {
      name: 'Average transaction by category',
      sql: 'SELECT category, AVG(amount) as avg_amount, COUNT(*) as count\nFROM bank_transactions\nGROUP BY category\nORDER BY avg_amount DESC;',
      category: 'Analytics',
    },
    {
      name: 'Recent transactions (last 30 days)',
      sql: 'SELECT * FROM bank_transactions\nWHERE transaction_date >= CURRENT_DATE - INTERVAL 30 DAY\nORDER BY transaction_date DESC;',
      category: 'Time-based',
    },
    {
      name: 'Transactions by month',
      sql: 'SELECT \n  DATE_FORMAT(transaction_date, "%Y-%m") as month,\n  COUNT(*) as transaction_count,\n  SUM(amount) as total_amount\nFROM bank_transactions\nGROUP BY month\nORDER BY month DESC;',
      category: 'Time-based',
    },
  ]

  // Actions available in the command palette
  const actions = [
    {
      name: 'Execute Query',
      description: 'Run the current SQL query',
      icon: Play,
      shortcut: 'Ctrl+Enter',
      action: onExecuteQuery,
      disabled: !currentSql.trim(),
    },
    {
      name: 'Format Query',
      description: 'Format the current SQL query',
      icon: Palette,
      shortcut: 'Ctrl+Shift+F',
      action: onFormatQuery,
      disabled: !currentSql.trim(),
    },
    {
      name: 'Save Query',
      description: 'Save the current query to favorites',
      icon: Save,
      shortcut: 'Ctrl+S',
      action: onSaveQuery,
      disabled: !currentSql.trim(),
    },
    {
      name: 'Copy Query',
      description: 'Copy query to clipboard',
      icon: Copy,
      shortcut: 'Ctrl+C',
      action: () => navigator.clipboard.writeText(currentSql),
      disabled: !currentSql.trim(),
    },
  ]

  // Filter queries based on search term
  const filteredQueries = sampleQueries.filter(
    (query) =>
      query.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      query.sql.toLowerCase().includes(searchTerm.toLowerCase()) ||
      query.category.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Filter actions based on search term
  const filteredActions = actions.filter(
    (action) =>
      action.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      action.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Group queries by category
  const queriesByCategory = filteredQueries.reduce((acc, query) => {
    if (!acc[query.category]) {
      acc[query.category] = []
    }
    acc[query.category].push(query)
    return acc
  }, {} as Record<string, typeof sampleQueries>)

  const handleSelectQuery = (sql: string) => {
    onSelectQuery(sql)
    onOpenChange(false)
  }

  const handleAction = (action: () => void) => {
    action()
    onOpenChange(false)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open, onOpenChange])

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search queries, actions, or type a command..."
        value={searchTerm}
        onValueChange={setSearchTerm}
      />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-6">
            <Search className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No results found.</p>
            <p className="text-xs text-muted-foreground">
              Try searching for queries, actions, or SQL keywords.
            </p>
          </div>
        </CommandEmpty>

        {/* Actions */}
        {filteredActions.length > 0 && (
          <CommandGroup heading="Actions">
            {filteredActions.map((action) => (
              <CommandItem
                key={action.name}
                onSelect={() => handleAction(action.action)}
                disabled={action.disabled}
                className="flex items-center gap-2"
              >
                <action.icon className="h-4 w-4" />
                <div className="flex-1">
                  <div className="font-medium">{action.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {action.description}
                  </div>
                </div>
                <CommandShortcut>{action.shortcut}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Query Templates */}
        {Object.keys(queriesByCategory).length > 0 && (
          <>
            {filteredActions.length > 0 && <CommandSeparator />}
            {Object.entries(queriesByCategory).map(([category, queries]) => (
              <CommandGroup key={category} heading={`${category} Queries`}>
                {queries.map((query, index) => (
                  <CommandItem
                    key={`${category}-${index}`}
                    onSelect={() => handleSelectQuery(query.sql)}
                    className="flex items-start gap-2"
                  >
                    <Database className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{query.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {query.sql.split('\n')[0]}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </>
        )}

        {/* Navigation */}
        {searchTerm === '' && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Navigation">
              <CommandItem className="flex items-center gap-2">
                <History className="h-4 w-4" />
                <span>Query History</span>
                <CommandShortcut>Ctrl+H</CommandShortcut>
              </CommandItem>
              <CommandItem className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                <span>Saved Queries</span>
                <CommandShortcut>Ctrl+B</CommandShortcut>
              </CommandItem>
              <CommandItem className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>Query Templates</span>
                <CommandShortcut>Ctrl+T</CommandShortcut>
              </CommandItem>
              <CommandItem className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
                <CommandShortcut>Ctrl+,</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}