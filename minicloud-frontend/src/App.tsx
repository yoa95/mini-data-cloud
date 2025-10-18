import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { UploadPage, TablesPage, QueryPage, MonitoringPage } from './pages';

// Breadcrumb mapping for different routes
const breadcrumbMap: Record<string, { title: string; parent?: string }> = {
  '/': { title: 'Upload' },
  '/upload': { title: 'Upload' },
  '/tables': { title: 'Tables' },
  '/query': { title: 'Query' },
  '/monitoring': { title: 'Monitoring' },
};

function AppContent() {
  const location = useLocation();
  const currentPath = location.pathname;
  const breadcrumb = breadcrumbMap[currentPath] || { title: 'Mini Data Cloud' };

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
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/">
                    Mini Data Cloud
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{breadcrumb.title}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/tables" element={<TablesPage />} />
          <Route path="/query" element={<QueryPage />} />
          <Route path="/monitoring" element={<MonitoringPage />} />
        </Routes>
      </SidebarInset>
    </SidebarProvider>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App
