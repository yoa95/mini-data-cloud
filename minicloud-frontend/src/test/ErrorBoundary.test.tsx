import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorBoundary, ErrorType } from '@/components/ui/ErrorBoundary';
import { FeatureErrorBoundary } from '@/components/ui/FeatureErrorBoundary';

// Mock component that throws an error
const ThrowError: React.FC<{ shouldThrow?: boolean; errorType?: string }> = ({ 
  shouldThrow = false, 
  errorType = 'runtime' 
}) => {
  if (shouldThrow) {
    if (errorType === 'network') {
      throw new Error('Network request failed');
    } else if (errorType === 'chunk') {
      const error = new Error('Loading chunk 1 failed');
      error.name = 'ChunkLoadError';
      throw error;
    } else {
      throw new Error('Test error');
    }
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Clear console errors for clean test output
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'group').mockImplementation(() => {});
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('renders error UI when child component throws', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('classifies network errors correctly', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} errorType="network" />
      </ErrorBoundary>
    );

    expect(screen.getByText('Connection Problem')).toBeInTheDocument();
    expect(screen.getByText(/check your internet connection/i)).toBeInTheDocument();
  });

  it('classifies chunk load errors correctly', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} errorType="chunk" />
      </ErrorBoundary>
    );

    expect(screen.getByText('Loading Error')).toBeInTheDocument();
    expect(screen.getByText(/page refresh/i)).toBeInTheDocument();
  });

  it('calls onError callback when error occurs', () => {
    const onError = vi.fn();
    
    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    );
  });

  it('shows retry button and increments retry count', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    
    // Click retry button
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    
    // Should show retry count
    expect(screen.getByText(/retry attempt: 1/i)).toBeInTheDocument();
  });

  it('shows custom fallback when provided', () => {
    const customFallback = <div>Custom error message</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('shows development details in development mode', () => {
    // Mock development environment
    const originalEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'development';

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Error Details (Development)')).toBeInTheDocument();

    // Restore environment
    process.env['NODE_ENV'] = originalEnv;
  });
});

describe('FeatureErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'group').mockImplementation(() => {});
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
  });

  it('renders feature-specific error message', () => {
    render(
      <FeatureErrorBoundary featureName="Test Feature">
        <ThrowError shouldThrow={true} />
      </FeatureErrorBoundary>
    );

    expect(screen.getByText('Test Feature Error')).toBeInTheDocument();
    expect(screen.getByText(/problem with the test feature/i)).toBeInTheDocument();
  });

  it('provides go back functionality', () => {
    const mockHistoryBack = vi.fn();
    Object.defineProperty(window, 'history', {
      value: { back: mockHistoryBack },
      writable: true
    });

    render(
      <FeatureErrorBoundary featureName="Test Feature">
        <ThrowError shouldThrow={true} />
      </FeatureErrorBoundary>
    );

    fireEvent.click(screen.getByRole('button', { name: /go back/i }));
    expect(mockHistoryBack).toHaveBeenCalled();
  });

  it('calls onError callback with feature context', () => {
    const onError = vi.fn();

    render(
      <FeatureErrorBoundary featureName="Test Feature" onError={onError}>
        <ThrowError shouldThrow={true} />
      </FeatureErrorBoundary>
    );

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    );
  });
});