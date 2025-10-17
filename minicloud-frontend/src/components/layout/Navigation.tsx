import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme/ThemeToggle'

const navItems = [
  { path: '/query', label: 'Query' },
  { path: '/monitor', label: 'Monitor' },
  { path: '/metadata', label: 'Metadata' },
  { path: '/upload', label: 'Upload' },
  { path: '/config', label: 'Config' },
]

export function Navigation() {
  const location = useLocation()

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center">
            <div className="mr-8">
              <Link to="/" className="text-xl font-bold">
                Mini Data Cloud
              </Link>
            </div>
            <div className="flex space-x-6">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'text-sm font-medium transition-colors hover:text-primary',
                    location.pathname === item.path
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  )
}
