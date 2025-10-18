import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { UploadPage, TablesPage, QueryPage, MonitoringPage } from './pages';
import { AppProviders } from './providers/AppProviders';
import { DynamicBreadcrumb } from './components/DynamicBreadcrumb';
import ErrorBoundary from './components/ErrorBoundary';

function AppContent() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <DynamicBreadcrumb />
          </div>
        </header>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/tables" element={<TablesPage />} />
            <Route path="/query" element={<QueryPage />} />
            <Route path="/monitoring" element={<MonitoringPage />} />
          </Routes>
        </ErrorBoundary>
      </SidebarInset>
    </SidebarProvider>
  );
}

function App() {
  return (
    <AppProviders>
      <Router>
        <AppContent />
      </Router>
    </AppProviders>
  );
}

export default App
