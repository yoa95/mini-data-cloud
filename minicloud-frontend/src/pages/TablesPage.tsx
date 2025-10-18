import React, { useState } from 'react';
import type { Table } from '../types/api';
import TableList from '../components/metadata/TableList';
import TableDetails from '../components/metadata/TableDetails';

export interface TablesPageProps {}

const TablesPage: React.FC<TablesPageProps> = () => {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const handleTableSelect = (table: Table) => {
    setSelectedTable(table.name);
  };

  const handleBack = () => {
    setSelectedTable(null);
  };

  const handleQueryTable = (tableName: string) => {
    // Navigate to query page with pre-filled query
    // For now, just log - this will be implemented in task 4
    console.log('Query table:', tableName);
    // In the future: navigate to `/query?table=${tableName}` or similar
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min">
        <div className="p-6">
          {selectedTable ? (
            <TableDetails
              tableName={selectedTable}
              onBack={handleBack}
              onQueryTable={handleQueryTable}
            />
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold">Tables</h1>
                <p className="text-muted-foreground">
                  Browse and manage your data tables
                </p>
              </div>
              
              <TableList onTableSelect={handleTableSelect} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TablesPage;