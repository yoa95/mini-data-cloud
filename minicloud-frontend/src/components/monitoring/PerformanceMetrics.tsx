import React, { useState, useMemo } from 'react';
import { BarChart3, TrendingUp, Clock, Filter } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';

interface MetricDataPoint {
  timestamp: Date;
  value: number;
  label?: string;
}

interface PerformanceMetric {
  id: string;
  name: string;
  description: string;
  unit: string;
  data: MetricDataPoint[];
  currentValue: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
}

interface PerformanceMetricsProps {
  timeRange?: '1h' | '6h' | '24h' | '7d';
  onTimeRangeChange?: (range: string) => void;
}

// Mock historical data for demonstration
const generateMockData = (hours: number, baseValue: number, variance: number): MetricDataPoint[] => {
  const data: MetricDataPoint[] = [];
  const now = new Date();
  
  for (let i = hours; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
    const value = baseValue + (Math.random() - 0.5) * variance;
    data.push({
      timestamp,
      value: Math.max(0, value),
    });
  }
  
  return data;
};

const mockMetrics: PerformanceMetric[] = [
  {
    id: 'query_throughput',
    name: 'Query Throughput',
    description: 'Queries executed per minute',
    unit: 'queries/min',
    data: generateMockData(24, 15, 10),
    currentValue: 18,
    trend: 'up',
    trendPercentage: 12.5,
  },
  {
    id: 'avg_query_time',
    name: 'Average Query Time',
    description: 'Average time to execute queries',
    unit: 'seconds',
    data: generateMockData(24, 2.5, 1.5),
    currentValue: 2.1,
    trend: 'down',
    trendPercentage: -8.7,
  },
  {
    id: 'cpu_utilization',
    name: 'CPU Utilization',
    description: 'Average CPU usage across all workers',
    unit: '%',
    data: generateMockData(24, 65, 20),
    currentValue: 72,
    trend: 'up',
    trendPercentage: 5.2,
  },
  {
    id: 'memory_utilization',
    name: 'Memory Utilization',
    description: 'Average memory usage across all workers',
    unit: '%',
    data: generateMockData(24, 45, 15),
    currentValue: 48,
    trend: 'stable',
    trendPercentage: 1.2,
  },
  {
    id: 'data_processed',
    name: 'Data Processed',
    description: 'Total data processed per hour',
    unit: 'GB/hour',
    data: generateMockData(24, 125, 50),
    currentValue: 142,
    trend: 'up',
    trendPercentage: 18.3,
  },
  {
    id: 'error_rate',
    name: 'Error Rate',
    description: 'Percentage of failed queries',
    unit: '%',
    data: generateMockData(24, 2.1, 1.5),
    currentValue: 1.8,
    trend: 'down',
    trendPercentage: -15.4,
  },
];

const getTrendIcon = (trend: PerformanceMetric['trend']) => {
  switch (trend) {
    case 'up':
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    case 'down':
      return <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />;
    case 'stable':
      return <div className="h-4 w-4 border-b-2 border-gray-400" />;
  }
};

const getTrendColor = (trend: PerformanceMetric['trend']) => {
  switch (trend) {
    case 'up':
      return 'text-green-600';
    case 'down':
      return 'text-red-600';
    case 'stable':
      return 'text-gray-600';
  }
};

// Simple ASCII-style chart component
const MiniChart: React.FC<{ data: MetricDataPoint[]; height?: number }> = ({ 
  data, 
  height = 40 
}) => {
  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;

  return (
    <div className="flex items-end space-x-1" style={{ height }}>
      {data.slice(-20).map((point, index) => {
        const normalizedHeight = ((point.value - minValue) / range) * (height - 4);
        return (
          <div
            key={index}
            className="bg-blue-500 rounded-sm flex-1 min-w-[2px]"
            style={{ height: Math.max(2, normalizedHeight) }}
            title={`${point.value.toFixed(2)} at ${point.timestamp.toLocaleTimeString()}`}
          />
        );
      })}
    </div>
  );
};

const formatValue = (value: number, unit: string) => {
  if (unit === '%') {
    return `${value.toFixed(1)}%`;
  } else if (unit === 'seconds') {
    return `${value.toFixed(2)}s`;
  } else if (unit === 'queries/min') {
    return `${Math.round(value)} q/min`;
  } else if (unit === 'GB/hour') {
    return `${Math.round(value)} GB/h`;
  }
  return `${value.toFixed(1)} ${unit}`;
};

export const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({
  timeRange = '24h',
  onTimeRangeChange,
}) => {
  const [selectedMetric, setSelectedMetric] = useState<string>('all');

  const filteredMetrics = useMemo(() => {
    if (selectedMetric === 'all') {
      return mockMetrics;
    }
    return mockMetrics.filter(metric => metric.id === selectedMetric);
  }, [selectedMetric]);

  const timeRangeOptions = [
    { value: '1h', label: 'Last Hour' },
    { value: '6h', label: 'Last 6 Hours' },
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
  ];

  const metricOptions = [
    { value: 'all', label: 'All Metrics' },
    ...mockMetrics.map(metric => ({
      value: metric.id,
      label: metric.name,
    })),
  ];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Performance Metrics
          </h3>
          <p className="text-sm text-muted-foreground">
            Historical system performance and resource utilization
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedMetric} onValueChange={setSelectedMetric}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {metricOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Select 
              value={timeRange} 
              onValueChange={onTimeRangeChange}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeRangeOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMetrics.map((metric) => (
          <Card key={metric.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  {metric.name}
                </CardTitle>
                <div className="flex items-center gap-1">
                  {getTrendIcon(metric.trend)}
                  <span className={`text-xs ${getTrendColor(metric.trend)}`}>
                    {metric.trendPercentage > 0 ? '+' : ''}
                    {metric.trendPercentage.toFixed(1)}%
                  </span>
                </div>
              </div>
              <CardDescription className="text-xs">
                {metric.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-2xl font-bold">
                {formatValue(metric.currentValue, metric.unit)}
              </div>
              
              <MiniChart data={metric.data} />
              
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Min: {formatValue(Math.min(...metric.data.map(d => d.value)), metric.unit)}
                </span>
                <span>
                  Max: {formatValue(Math.max(...metric.data.map(d => d.value)), metric.unit)}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance Summary</CardTitle>
          <CardDescription>
            Key performance indicators for the selected time period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {mockMetrics.filter(m => m.trend === 'up').length}
              </div>
              <div className="text-sm text-muted-foreground">Improving</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {mockMetrics.filter(m => m.trend === 'down').length}
              </div>
              <div className="text-sm text-muted-foreground">Declining</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                {mockMetrics.filter(m => m.trend === 'stable').length}
              </div>
              <div className="text-sm text-muted-foreground">Stable</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {Math.round(mockMetrics.reduce((acc, m) => acc + Math.abs(m.trendPercentage), 0) / mockMetrics.length)}%
              </div>
              <div className="text-sm text-muted-foreground">Avg Change</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockMetrics
              .filter(m => Math.abs(m.trendPercentage) > 10)
              .map(metric => (
                <div key={metric.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  {getTrendIcon(metric.trend)}
                  <div className="flex-1">
                    <div className="font-medium text-sm">{metric.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {metric.trend === 'up' ? 'Increased' : 'Decreased'} by{' '}
                      {Math.abs(metric.trendPercentage).toFixed(1)}% in the last {timeRange}
                    </div>
                  </div>
                  <Badge 
                    variant={metric.trend === 'up' ? 'default' : 'secondary'}
                    className={metric.trend === 'up' ? 'bg-green-500' : 'bg-red-500'}
                  >
                    {metric.trendPercentage > 0 ? '+' : ''}
                    {metric.trendPercentage.toFixed(1)}%
                  </Badge>
                </div>
              ))}
            {mockMetrics.filter(m => Math.abs(m.trendPercentage) > 10).length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No significant performance changes detected</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};