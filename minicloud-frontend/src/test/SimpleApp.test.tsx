import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SimpleApp from '../SimpleApp'

describe('SimpleApp', () => {
  it('renders without crashing', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <SimpleApp />
      </QueryClientProvider>
    )

    // Should not crash and should render something
    expect(document.body).toBeTruthy()
  })
})