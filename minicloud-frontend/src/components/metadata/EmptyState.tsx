import React from 'react';
import { Database, Upload, FileText } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

interface EmptyStateProps {
  onUploadClick?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ onUploadClick }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-6">
      <div className="relative">
        <Database className="h-16 w-16 text-muted-foreground/50" />
        <div className="absolute -top-2 -right-2 h-6 w-6 bg-muted rounded-full flex items-center justify-center">
          <span className="text-xs text-muted-foreground">0</span>
        </div>
      </div>
      
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">No tables found</h3>
        <p className="text-muted-foreground max-w-md">
          Your data cloud is empty. Upload CSV files to create tables and start analyzing your data.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button 
          onClick={onUploadClick || (() => window.location.href = '/upload')}
          className="flex items-center gap-2"
        >
          <Upload className="h-4 w-4" />
          Upload Data
        </Button>
        <Button variant="outline" asChild>
          <a href="/sample-data" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Try Sample Data
          </a>
        </Button>
      </div>

      <div className="mt-8 max-w-2xl">
        <h4 className="text-sm font-medium mb-4">Getting Started</h4>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="text-left">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-sm font-semibold text-primary">1</span>
                </div>
                <CardTitle className="text-sm">Upload CSV</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <CardDescription className="text-xs">
                Drag and drop your CSV files or click to browse and upload.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-left">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-sm font-semibold text-primary">2</span>
                </div>
                <CardTitle className="text-sm">Browse Tables</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <CardDescription className="text-xs">
                View your tables, explore schemas, and understand your data structure.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-left">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-sm font-semibold text-primary">3</span>
                </div>
                <CardTitle className="text-sm">Run Queries</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <CardDescription className="text-xs">
                Execute SQL queries to analyze and extract insights from your data.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EmptyState;