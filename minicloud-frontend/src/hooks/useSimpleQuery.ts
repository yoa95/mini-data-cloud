// Simplified query hook for demonstration
import { useQuery } from '@tanstack/react-query'
import { simpleApiClient } from '@/lib/simple-api'

export const useSimpleQueries = () => {
  return useQuery({
    queryKey: ['queries'],
    queryFn: () => simpleApiClient.get('/api/v1/queries'),
  })
}

export const useSimpleTables = () => {
  return useQuery({
    queryKey: ['tables'],
    queryFn: () => simpleApiClient.get('/api/v1/metadata/tables'),
  })
}

export const useSimpleWorkers = () => {
  return useQuery({
    queryKey: ['workers'],
    queryFn: () => simpleApiClient.get('/api/workers'),
  })
}
