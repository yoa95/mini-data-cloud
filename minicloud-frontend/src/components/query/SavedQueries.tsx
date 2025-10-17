import React, { useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { 
  Bookmark, 
  Search, 
  Play, 
  Star, 
  StarOff, 
  Trash2, 
  Edit3,
  Plus,
  Tag,
  Calendar,
  Filter,
  SortAsc,
  SortDesc,
} from 'lucide-react';
import { 
  useSavedQueries, 
  useFavoriteQueries, 
  useQueryEditorStore,
  type SavedQuery,
} from '@/store/query-editor-store';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

interface SavedQueriesProps {
  onSelectQuery?: (sql: string) => void;
  onExecuteQuery?: (sql: string) => void;
  currentSql?: string;
  className?: string;
}

type SortField = 'name' | 'createdAt' | 'updatedAt';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'all' | 'favorites';

export const SavedQueries: React.FC<SavedQueriesProps> = ({
  onSelectQuery,
  onExecuteQuery,
  currentSql = '',
  className,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [editingQuery, setEditingQuery] = useState<SavedQuery | null>(null);
  
  const { toast } = useToast();
  
  // Get queries from store
  const allSavedQueries = useSavedQueries();
  const favoriteQueries = useFavoriteQueries();
  const { 
    saveQuery, 
    updateSavedQuery, 
    deleteSavedQuery, 
    toggleFavorite,
  } = useQueryEditorStore();

  // Get queries based on view mode
  const queries = viewMode === 'favorites' ? favoriteQueries : allSavedQueries;

  // Get all unique tags
  const allTags = React.useMemo(() => {
    const tags = new Set<string>();
    allSavedQueries.forEach(query => {
      query.tags.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [allSavedQueries]);

  // Filter and sort queries
  const filteredQueries = React.useMemo(() => {
    let filtered = queries;

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(query => 
        query.name.toLowerCase().includes(searchLower) ||
        query.sql.toLowerCase().includes(searchLower) ||
        query.description?.toLowerCase().includes(searchLower) ||
        query.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // Apply tag filter
    if (tagFilter) {
      filtered = filtered.filter(query => 
        query.tags.includes(tagFilter)
      );
    }

    // Sort queries
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortField) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'createdAt':
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        case 'updatedAt':
          aVal = new Date(a.updatedAt).getTime();
          bVal = new Date(b.updatedAt).getTime();
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [queries, searchTerm, tagFilter, sortField, sortDirection]);

  // Handle sort
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }, [sortField]);

  // Handle save current query
  const handleSaveCurrentQuery = useCallback(() => {
    if (!currentSql.trim()) {
      toast({
        title: 'No Query to Save',
        description: 'Please enter a query in the editor first.',
        variant: 'error',
      });
      return;
    }

    const name = `Query ${new Date().toLocaleString()}`;
    const id = saveQuery({
      name,
      sql: currentSql,
      description: '',
      tags: [],
      isFavorite: false,
    });

    setEditingQuery(allSavedQueries.find(q => q.id === id) || null);
    toast({
      title: 'Query Saved',
      description: 'Query has been saved. You can now edit its details.',
      variant: 'success',
    });
  }, [currentSql, saveQuery, allSavedQueries, toast]);

  // Handle query selection
  const handleSelectQuery = useCallback((query: SavedQuery) => {
    onSelectQuery?.(query.sql);
    toast({
      title: 'Query Loaded',
      description: `"${query.name}" has been loaded into the editor.`,
      variant: 'success',
    });
  }, [onSelectQuery, toast]);

  // Handle query execution
  const handleExecuteQuery = useCallback((query: SavedQuery) => {
    onExecuteQuery?.(query.sql);
    toast({
      title: 'Query Executing',
      description: `"${query.name}" has been submitted for execution.`,
      variant: 'info',
    });
  }, [onExecuteQuery, toast]);

  // Handle toggle favorite
  const handleToggleFavorite = useCallback((queryId: string) => {
    toggleFavorite(queryId);
  }, [toggleFavorite]);

  // Handle delete query
  const handleDeleteQuery = useCallback((queryId: string, queryName: string) => {
    deleteSavedQuery(queryId);
    toast({
      title: 'Query Deleted',
      description: `"${queryName}" has been deleted.`,
      variant: 'success',
    });
  }, [deleteSavedQuery, toast]);

  // Format date
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString();
  };

  // Get sort icon
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <SortAsc className="w-4 h-4 opacity-50" />;
    return sortDirection === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />;
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bookmark className="w-5 h-5" />
            <h3 className="font-semibold">Saved Queries</h3>
            <Badge variant="outline">{filteredQueries.length}</Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSaveCurrentQuery}
              variant="outline"
              size="sm"
              disabled={!currentSql.trim()}
            >
              <Plus className="w-4 h-4 mr-2" />
              Save Current
            </Button>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 mb-4">
          <Button
            onClick={() => setViewMode('all')}
            variant={viewMode === 'all' ? 'default' : 'outline'}
            size="sm"
          >
            All ({allSavedQueries.length})
          </Button>
          <Button
            onClick={() => setViewMode('favorites')}
            variant={viewMode === 'favorites' ? 'default' : 'outline'}
            size="sm"
          >
            <Star className="w-4 h-4 mr-1" />
            Favorites ({favoriteQueries.length})
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search queries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
          </div>
          
          {allTags.length > 0 && (
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-muted-foreground" />
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="px-3 py-1 border border-border rounded-md text-sm bg-background"
              >
                <option value="">All Tags</option>
                {allTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Query List */}
      <div className="max-h-96 overflow-y-auto">
        {filteredQueries.length === 0 ? (
          <div className="p-8 text-center">
            <Bookmark className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              {searchTerm || tagFilter 
                ? 'No queries match your filters' 
                : viewMode === 'favorites'
                  ? 'No favorite queries yet'
                  : 'No saved queries yet'
              }
            </p>
            {!searchTerm && !tagFilter && viewMode === 'all' && (
              <Button
                onClick={handleSaveCurrentQuery}
                variant="outline"
                size="sm"
                className="mt-4"
                disabled={!currentSql.trim()}
              >
                <Plus className="w-4 h-4 mr-2" />
                Save Your First Query
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {/* Sort Header */}
            <div className="px-4 py-2 bg-muted/50 text-sm font-medium grid grid-cols-12 gap-4">
              <div 
                className="col-span-4 flex items-center gap-1 cursor-pointer hover:text-primary"
                onClick={() => handleSort('name')}
              >
                Name
                {getSortIcon('name')}
              </div>
              <div className="col-span-3">Description</div>
              <div className="col-span-2">Tags</div>
              <div 
                className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-primary"
                onClick={() => handleSort('updatedAt')}
              >
                Updated
                {getSortIcon('updatedAt')}
              </div>
              <div className="col-span-1">Actions</div>
            </div>

            {filteredQueries.map((query) => (
              <div key={query.id} className="px-4 py-3 hover:bg-muted/30 grid grid-cols-12 gap-4 items-start">
                <div className="col-span-4">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium truncate" title={query.name}>
                      {query.name}
                    </h4>
                    {query.isFavorite && (
                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                    )}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground truncate" title={query.sql}>
                    {query.sql}
                  </div>
                </div>
                
                <div className="col-span-3">
                  <p className="text-sm text-muted-foreground truncate" title={query.description}>
                    {query.description || 'No description'}
                  </p>
                </div>
                
                <div className="col-span-2">
                  <div className="flex flex-wrap gap-1">
                    {query.tags.slice(0, 2).map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {query.tags.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{query.tags.length - 2}
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="col-span-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(query.updatedAt)}
                  </div>
                </div>
                
                <div className="col-span-1">
                  <div className="flex items-center gap-1">
                    <Button
                      onClick={() => handleSelectQuery(query)}
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      title="Load query"
                    >
                      <Play className="w-3 h-3" />
                    </Button>
                    
                    <Button
                      onClick={() => handleToggleFavorite(query.id)}
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      title={query.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      {query.isFavorite ? (
                        <StarOff className="w-3 h-3" />
                      ) : (
                        <Star className="w-3 h-3" />
                      )}
                    </Button>
                    
                    <Button
                      onClick={() => setEditingQuery(query)}
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      title="Edit query"
                    >
                      <Edit3 className="w-3 h-3" />
                    </Button>
                    
                    <Button
                      onClick={() => handleDeleteQuery(query.id, query.name)}
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      title="Delete query"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Query Modal would go here */}
      {editingQuery && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold">Edit Query</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={editingQuery.name}
                  onChange={(e) => setEditingQuery(prev => prev ? { ...prev, name: e.target.value } : null)}
                  placeholder="Query name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={editingQuery.description || ''}
                  onChange={(e) => setEditingQuery(prev => prev ? { ...prev, description: e.target.value } : null)}
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Tags (comma-separated)</label>
                <Input
                  value={editingQuery.tags.join(', ')}
                  onChange={(e) => setEditingQuery(prev => prev ? { 
                    ...prev, 
                    tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                  } : null)}
                  placeholder="tag1, tag2, tag3"
                />
              </div>
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <Button
                onClick={() => setEditingQuery(null)}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (editingQuery) {
                    updateSavedQuery(editingQuery.id, {
                      name: editingQuery.name,
                      description: editingQuery.description || undefined,
                      tags: editingQuery.tags,
                    });
                    setEditingQuery(null);
                    toast({
                      title: 'Query Updated',
                      description: 'Query details have been updated.',
                      variant: 'success',
                    });
                  }
                }}
                size="sm"
              >
                Save Changes
              </Button>
            </div>
          </Card>
        </div>
      )}
    </Card>
  );
};

export default SavedQueries;