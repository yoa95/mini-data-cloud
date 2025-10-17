import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Navigation } from './Navigation'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { getRouteTitle } from '@/lib/simple-router'

export function SimpleLayout() {
  const location = useLocation()

  return (
    <ThemeProvider defaultTheme="system" storageKey="minicloud-ui-theme">
      <div className="min-h-screen bg-background flex">
        {/* Sidebar Navigation */}
        <Navigation />
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col ml-64">
          {/* Header */}
          <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex-1">
                <h1 className="text-lg font-semibold">
                  {getRouteTitle(location.pathname)}
                </h1>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-muted-foreground">Connected</span>
              </div>
            </div>
          </header>
          
          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            <div className="container mx-auto px-6 py-6">
              <Suspense fallback={
                <div className="flex items-center justify-center min-h-[400px]">
                  <LoadingSpinner />
                </div>
              }>
                <Outlet />
              </Suspense>
            </div>
          </main>
          
          {/* Footer */}
          <footer className="border-t border-border bg-muted/50">
            <div className="container mx-auto px-6 py-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div>
                  Mini Data Cloud - Distributed Query Engine
                </div>
                <div>
                  v1.0.0
                </div>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </ThemeProvider>
  )
}