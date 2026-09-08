import React from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const Layout = () => {
  const location = useLocation();

  // Redirect root to portal
  if (location.pathname === '/') {
    return <Navigate to="/portal" replace />;
  }

  return (
    <div className="h-full w-full bg-slate-50 flex flex-col overflow-hidden font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      <div className="flex-1 flex overflow-hidden min-w-0 h-full">
        <Sidebar />
        
        {/* Main Content Column & Topbar */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-50">
          {/* Lightweight Header (Topbar) */}
          <Topbar />

          {/* Spacing & Scroll Container */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-8 w-full max-w-full min-w-0 h-full scroll-smooth custom-scrollbar">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;
