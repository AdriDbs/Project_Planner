import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
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

function App() {
  return (
    <BrowserRouter basename="/Project_Planner/">
      <div className="flex h-screen overflow-hidden bg-gray-50">
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
              <Route path="/admin/library" element={<LeverLibraryPage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Routes>
          </div>
        </div>
      </div>
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
