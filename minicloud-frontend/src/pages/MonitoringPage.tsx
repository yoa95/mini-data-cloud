import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ClusterStatus, QueryMonitor, PerformanceMetrics } from '../components/monitoring';
import { useBreadcrumb } from '../contexts/BreadcrumbContext';

export const MonitoringPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('cluster');
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');

  const { setBreadcrumbs } = useBreadcrumb();

  React.useEffect(() => {
    setBreadcrumbs([
      { title: 'Home', href: '/' },
      { title: 'Monitoring', href: '/monitoring' },
    ]);
  }, [setBreadcrumbs]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Monitoring</h1>
          <p className="text-muted-foreground">
            Monitor cluster health, query performance, and system metrics
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="cluster">Cluster Status</TabsTrigger>
          <TabsTrigger value="queries">Query Monitor</TabsTrigger>
          <TabsTrigger value="metrics">Performance Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="cluster" className="space-y-6">
          <ClusterStatus autoRefresh={true} refreshInterval={30000} />
        </TabsContent>

        <TabsContent value="queries" className="space-y-6">
          <QueryMonitor autoRefresh={true} refreshInterval={5000} />
        </TabsContent>

        <TabsContent value="metrics" className="space-y-6">
          <PerformanceMetrics 
            timeRange={timeRange} 
            onTimeRangeChange={(range) => setTimeRange(range as '1h' | '6h' | '24h' | '7d')} 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};