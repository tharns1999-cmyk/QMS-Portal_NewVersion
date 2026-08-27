import React from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';

const Layout = () => {
  const location = useLocation();

  // Redirect root to portal
  if (location.pathname === '/') {
    return <Navigate to="/portal" replace />;
  }

  return (
    <div className="h-full w-full bg-[#F5F5F5] flex flex-col overflow-hidden font-sans text-[#1E1E1E]">
      <div className="flex-1 flex overflow-hidden min-w-0 min-h-0 h-full">
        <Sidebar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8 w-full max-w-full min-w-0 min-h-0 h-full flex flex-col justify-start">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;

