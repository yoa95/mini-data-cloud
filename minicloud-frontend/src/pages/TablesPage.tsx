import React from 'react';

export interface TablesPageProps {}

const TablesPage: React.FC<TablesPageProps> = () => {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        <div className="aspect-video rounded-xl bg-muted/50" />
        <div className="aspect-video rounded-xl bg-muted/50" />
        <div className="aspect-video rounded-xl bg-muted/50" />
      </div>
      <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min">
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-4">Tables</h1>
          <p className="text-muted-foreground">
            Browse and manage your data tables.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TablesPage;