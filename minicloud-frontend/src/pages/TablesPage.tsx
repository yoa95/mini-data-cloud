import React from 'react';
import { useTables } from '../hooks/api';

export interface TablesPageProps {}

const TablesPage: React.FC<TablesPageProps> = () => {
  const { data: tables, isLoading, error } = useTables();

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      {/* <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        <div className="aspect-video rounded-xl bg-muted/50" />
        <div className="aspect-video rounded-xl bg-muted/50" />
        <div className="aspect-video rounded-xl bg-muted/50" />
      </div> */}
      <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min">
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-4">Tables</h1>
          
          {isLoading && (
            <p className="text-muted-foreground">Loading tables...</p>
          )}
          
          {error && (
            <p className="text-red-500">Error loading tables: {error.message}</p>
          )}
          
          {tables && (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Found {tables.length} tables in your data cloud.
              </p>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {tables.map((table) => (
                  <div key={table.name} className="p-4 border rounded-lg">
                    <h3 className="font-semibold">{table.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {table.rowCount.toLocaleString()} rows
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {(table.fileSize / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TablesPage;