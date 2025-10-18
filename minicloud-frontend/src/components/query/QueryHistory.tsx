import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Textarea } from "../ui/textarea";
import {
  Clock,
  Search,
  Star,
  StarOff,
  Play,
  Trash2,
  Save,
  Copy,
  CheckCircle,
  XCircle,
  Calendar,
} from "lucide-react";

import type { QueryHistoryItem } from "@/types/api";

export interface QueryHistoryProps {
  historyItems: QueryHistoryItem[];
  favoriteQueries: QueryHistoryItem[];
  onExecuteQuery: (sql: string) => void;
  onSaveQuery?: (sql: string, name: string) => void;
  onToggleFavorite?: (queryId: string) => void;
  onDeleteQuery?: (queryId: string) => void;
  isLoading?: boolean;
  className?: string;
}

interface SaveQueryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sql: string, name: string) => void;
  initialSql?: string;
}

const SaveQueryDialog: React.FC<SaveQueryDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  initialSql = "",
}) => {
  const [sql, setSql] = useState(initialSql);
  const [name, setName] = useState("");

  React.useEffect(() => {
    if (isOpen) {
      setSql(initialSql);
      setName("");
    }
  }, [isOpen, initialSql]);

  const handleSave = () => {
    if (sql.trim() && name.trim()) {
      onSave(sql.trim(), name.trim());
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Save Query</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Query Name</label>
            <Input
              placeholder="Enter a name for this query..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">SQL Query</label>
            <Textarea
              placeholder="Enter your SQL query..."
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!sql.trim() || !name.trim()}>
            <Save className="h-4 w-4 mr-2" />
            Save Query
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const QueryHistoryItem: React.FC<{
  item: QueryHistoryItem;
  isFavorite: boolean;
  onExecute: (sql: string) => void;
  onToggleFavorite?: (queryId: string) => void;
  onDelete?: (queryId: string) => void;
  onCopy: (sql: string) => void;
}> = ({ item, isFavorite, onExecute, onToggleFavorite, onDelete, onCopy }) => {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  const truncateSQL = (sql: string, maxLength = 100) => {
    if (sql.length <= maxLength) return sql;
    return sql.substring(0, maxLength) + "...";
  };

  return (
    <div className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Badge
              variant={item.status === "success" ? "default" : "destructive"}
              className="text-xs"
            >
              {item.status === "success" ? (
                <CheckCircle className="h-3 w-3 mr-1" />
              ) : (
                <XCircle className="h-3 w-3 mr-1" />
              )}
              {item.status}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {formatDate(item.executedAt)}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {item.executionTime}ms
            </div>
          </div>

          <div className="font-mono text-sm bg-muted/30 rounded p-2 mb-2">
            {truncateSQL(item.sql)}
          </div>

          {item.error && (
            <div className="text-xs text-destructive bg-destructive/10 rounded p-2">
              {item.error}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {onToggleFavorite && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleFavorite(item.id)}
              className="h-8 w-8 p-0"
            >
              {isFavorite ? (
                <Star className="h-4 w-4 fill-current text-yellow-500" />
              ) : (
                <StarOff className="h-4 w-4" />
              )}
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCopy(item.sql)}
            className="h-8 w-8 p-0"
          >
            <Copy className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onExecute(item.sql)}
            className="h-8 w-8 p-0"
          >
            <Play className="h-4 w-4" />
          </Button>

          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(item.id)}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const QueryHistory: React.FC<QueryHistoryProps> = ({
  historyItems,
  favoriteQueries,
  onExecuteQuery,
  onSaveQuery,
  onToggleFavorite,
  onDeleteQuery,
  isLoading = false,
  className,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("recent");

  // Filter queries based on search term
  const filteredHistory = useMemo(() => {
    if (!searchTerm) return historyItems;
    return historyItems.filter((item) =>
      item.sql.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [historyItems, searchTerm]);

  const filteredFavorites = useMemo(() => {
    if (!searchTerm) return favoriteQueries;
    return favoriteQueries.filter((item) =>
      item.sql.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [favoriteQueries, searchTerm]);

  // Check if a query is favorited
  const isFavorite = (queryId: string) => {
    return favoriteQueries.some((fav) => fav.id === queryId);
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Query History</CardTitle>
            {onSaveQuery && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSaveDialog(true)}
              >
                <Save className="h-4 w-4 mr-2" />
                Save New Query
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search queries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="recent">
                Recent ({filteredHistory.length})
              </TabsTrigger>
              <TabsTrigger value="favorites">
                Favorites ({filteredFavorites.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="recent" className="space-y-3">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading query history...
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm
                    ? "No queries match your search"
                    : "No recent queries"}
                </div>
              ) : (
                filteredHistory.map((item) => (
                  <QueryHistoryItem
                    key={item.id}
                    item={item}
                    isFavorite={isFavorite(item.id)}
                    onExecute={onExecuteQuery}
                    onToggleFavorite={onToggleFavorite}
                    onDelete={onDeleteQuery}
                    onCopy={copyToClipboard}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="favorites" className="space-y-3">
              {filteredFavorites.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm
                    ? "No favorite queries match your search"
                    : "No favorite queries yet"}
                </div>
              ) : (
                filteredFavorites.map((item) => (
                  <QueryHistoryItem
                    key={item.id}
                    item={item}
                    isFavorite={true}
                    onExecute={onExecuteQuery}
                    onToggleFavorite={onToggleFavorite}
                    onDelete={onDeleteQuery}
                    onCopy={copyToClipboard}
                  />
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Save Query Dialog */}
      {onSaveQuery && (
        <SaveQueryDialog
          isOpen={showSaveDialog}
          onClose={() => setShowSaveDialog(false)}
          onSave={onSaveQuery}
        />
      )}
    </>
  );
};

export default QueryHistory;
