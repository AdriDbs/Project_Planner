import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useProjects, usePlants } from './hooks/useProjects';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { TutorialOverlay } from './components/tutorial/TutorialOverlay';
import { WorkshopLauncher } from './components/workshop/WorkshopLauncher';
import { WorkshopCoConstruction } from './components/workshop/WorkshopCoConstruction';
import { Dashboard } from './pages/Dashboard';
import { BaselinePage } from './pages/Baseline';
import { LeversPage } from './pages/Levers';
import { SavingsByTypePage } from './pages/SavingsByType';
import { PhasingSavingsPage } from './pages/PhasingSavings';
import { OrganizationPage } from './pages/Organization';
import { CapexOpexPage } from './pages/CapexOpex';
import { OutOfScopePage } from './pages/OutOfScope';
import { AdminPage } from './pages/Admin';
import { LeverLibraryPage } from './pages/LeverLibrary';
import { ExportPage } from './pages/Export';
import { WorkshopPage } from './pages/Workshop';
import { WorkshopCoConstructionPage } from './pages/WorkshopPage';
import { useProjectStore } from './store/projectStore';
import { useWorkshopStore } from './store/workshopStore';

// Déclenche le onSnapshot des projets dès le montage de l'app,
// garantissant que la liste est disponible avant le rendu du Header.
function ProjectLoader() {
  useProjects();
  return null;
}

// Modal overlay for the WorkshopLauncher — triggered from any page via workshopStore.
function WorkshopLauncherModal() {
  const { isLauncherOpen, setLauncherOpen } = useWorkshopStore();
  const { selectedProjectId, projects } = useProjectStore();
  const { plants } = usePlants(selectedProjectId);

  if (!isLauncherOpen) return null;

  const project = projects.find(p => p.id === selectedProjectId);
  if (!project) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => setLauncherOpen(false)} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto p-6">
        <WorkshopLauncher
          project={project}
          plants={plants}
          onClose={() => setLauncherOpen(false)}
        />
      </div>
    </div>
  );
}

function AppLayout() {
  const location = useLocation();
  const isWorkshop = location.pathname === '/workshop';
  const isWorkshopCo = location.pathname === '/workshop-coproduction';

  if (isWorkshop) {
    return (
      <Routes>
        <Route path="/workshop" element={<WorkshopPage />} />
      </Routes>
    );
  }

  if (isWorkshopCo) {
    return (
      <Routes>
        <Route path="/workshop-coproduction" element={<WorkshopCoConstructionPage />} />
      </Routes>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <ProjectLoader />
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <div className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/baseline" element={<BaselinePage />} />
            <Route path="/levers" element={<LeversPage />} />
            <Route path="/savings-by-type" element={<SavingsByTypePage />} />
            <Route path="/phasing" element={<PhasingSavingsPage />} />
            <Route path="/organization" element={<OrganizationPage />} />
            <Route path="/capex-opex" element={<CapexOpexPage />} />
            <Route path="/out-of-scope" element={<OutOfScopePage />} />
            <Route path="/export" element={<ExportPage />} />
            <Route path="/admin/library" element={<LeverLibraryPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function WorkshopCoConstructionOverlay() {
  const { isCoConstructionMode } = useWorkshopStore();
  if (!isCoConstructionMode) return null;
  return <WorkshopCoConstruction />;
}

function App() {
  return (
    <BrowserRouter basename="/Project_Planner/">
      <AppLayout />
      <TutorialOverlay />
      <WorkshopLauncherModal />
      <WorkshopCoConstructionOverlay />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: '10px',
            background: '#fff',
            color: '#374151',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#00B050', secondary: '#fff' } },
          error: { iconTheme: { primary: '#FF0000', secondary: '#fff' } },
        }}
      />
    </BrowserRouter>
  );
}

export default App;
