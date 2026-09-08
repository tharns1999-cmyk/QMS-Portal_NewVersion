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
    <div className="h-full w-full bg-dream-canvas flex flex-col overflow-hidden font-sans text-dream-primary selection:bg-dream-lavender selection:text-dream-primary">
      <div className="flex-1 flex overflow-hidden min-w-0 h-full">
        <Sidebar />
        
        {/* Main Content Column with Ambient Haze & Topbar */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
          {/* Soft Dreamcore Ambient Haze at the top */}
          <div 
            aria-hidden="true" 
            className="pointer-events-none absolute top-0 left-0 right-0 h-56 bg-[radial-gradient(ellipse_75%_50%_at_50%_-20%,rgba(233,228,255,0.45),rgba(227,244,238,0.2),transparent_70%)] z-0" 
          />

          {/* Lightweight Header (Topbar) */}
          <Topbar />

          {/* Spacing & Scroll Container (p-6 to p-8) */}
          <main className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-8 w-full max-w-full min-w-0 h-full scroll-smooth custom-scrollbar">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;

