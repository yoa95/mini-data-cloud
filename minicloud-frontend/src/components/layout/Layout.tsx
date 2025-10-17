import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { Navigation } from './Navigation'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ThemeProvider } from '@/components/theme/ThemeProvider'

export function Layout() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="minicloud-ui-theme">
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto">
          <Suspense fallback={<LoadingSpinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </ThemeProvider>
  )
}