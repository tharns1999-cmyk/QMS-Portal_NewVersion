import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useStore from './store/useStore';
import Layout from './components/layout/Layout';
import SLAEngine from './components/SLAEngine';
import ProtectedRoute from './components/auth/ProtectedRoute';

// --- Lazy Load Pages ---

// Portal
const PortalLandingPage = lazy(() => import('./features/portal/pages/PortalLandingPage'));

// DCC Dashboard
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));

// DCC DAR Workflow
const DarSelection = lazy(() => import('./pages/DarWorkflow/DarSelection'));
const DarNewForm = lazy(() => import('./pages/DarWorkflow/DarNewForm'));
const DarRevisionForm = lazy(() => import('./pages/DarWorkflow/DarRevisionForm'));
const DarObsoleteForm = lazy(() => import('./pages/DarWorkflow/DarObsoleteForm'));
const DarList = lazy(() => import('./pages/DarWorkflow/DarList'));
const DarDetail = lazy(() => import('./pages/DarWorkflow/DarDetail'));

// DCC Library
const Library = lazy(() => import('./pages/Library/Library'));
const LibraryDetail = lazy(() => import('./pages/Library/LibraryDetail'));
const Viewer = lazy(() => import('./pages/Library/Viewer'));

// DCC Admin & Master List
const Reports = lazy(() => import('./pages/Admin/Reports'));
const ActionLog = lazy(() => import('./pages/Admin/ActionLog'));
const MasterDataHub = lazy(() => import('./pages/Admin/MasterDataHub'));
const ControlledCopyRegister = lazy(() => import('./pages/ControlledCopy/ControlledCopyRegister'));
const ExternalDocsList = lazy(() => import('./pages/ExternalDocs/ExternalDocsList'));
const MasterList = lazy(() => import('./pages/MasterList/MasterList'));

// DCC Tasks
const TaskInbox = lazy(() => import('./pages/Tasks/TaskInbox'));
const TaskReview = lazy(() => import('./pages/Tasks/TaskReview'));
const TaskApprove = lazy(() => import('./pages/Tasks/TaskApprove'));
const TaskAck = lazy(() => import('./pages/Tasks/TaskAck'));
const TaskRevise = lazy(() => import('./pages/Tasks/TaskRevise'));
const TaskApproveReplacement = lazy(() => import('./pages/Tasks/TaskApproveReplacement'));
const TaskConfirmHardcopyReceipt = lazy(() => import('./pages/Tasks/TaskConfirmHardcopyReceipt'));

// DCC Periodic Reviews
const PeriodicReviewDashboard = lazy(() => import('./pages/PeriodicReviews/PeriodicReviewDashboard'));
const PeriodicReviewDetail = lazy(() => import('./pages/PeriodicReviews/PeriodicReviewDetail'));

// Placeholders
const AdminHealth = lazy(() => import('./pages/Placeholders').then(m => ({ default: m.AdminHealth })));
const NotFound = lazy(() => import('./pages/Placeholders').then(m => ({ default: m.NotFound })));
const DistributionDemo = lazy(() => import('./pages/Placeholders/DistributionDemo'));


// --- Helper Components ---

const SuspenseLoader = () => (
  <div className="flex-1 flex flex-col items-center justify-center h-full min-h-[400px]">
    <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div>
    <p className="mt-4 text-sm text-zinc-500 font-medium">Loading module...</p>
  </div>
);

const withSuspense = (Component) => (
  <Suspense fallback={<SuspenseLoader />}>
    <Component />
  </Suspense>
);

const AliasRedirect = ({ to }) => {
  const params = useParams();
  let resolvedPath = to;
  Object.keys(params).forEach(key => {
    resolvedPath = resolvedPath.replace(`:${key}`, params[key]);
  });
  return <Navigate to={resolvedPath} replace />;
};

function App() {
  const initializePeriodicReviews = useStore(state => state.initializePeriodicReviews);

  useEffect(() => {
    initializePeriodicReviews();
  }, [initializePeriodicReviews]);

  return (
    <BrowserRouter>

      <Toaster position="top-right" />
      <SLAEngine />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path="portal" element={withSuspense(PortalLandingPage)} />
          
          <Route path="dcc">
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={withSuspense(Dashboard)} />

            <Route path="dar/new" element={withSuspense(DarSelection)} />
            <Route path="dar/new/document" element={withSuspense(DarNewForm)} />
            <Route path="dar/new/revision" element={withSuspense(DarRevisionForm)} />
            <Route path="dar/new/obsolete" element={withSuspense(DarObsoleteForm)} />
            <Route path="dar/list" element={withSuspense(DarList)} />
            <Route path="dar/:id" element={withSuspense(DarDetail)} />

            <Route path="tasks" element={withSuspense(TaskInbox)} />
            <Route path="tasks/review/:id" element={withSuspense(TaskReview)} />
            <Route path="tasks/approve/:id" element={withSuspense(TaskApprove)} />
            <Route path="tasks/ack/:id" element={withSuspense(TaskAck)} />
            <Route path="tasks/revise/:id" element={withSuspense(TaskRevise)} />
            <Route path="tasks/approve-replacement/:id" element={withSuspense(TaskApproveReplacement)} />
            <Route path="tasks/confirm-receipt/:id" element={withSuspense(TaskConfirmHardcopyReceipt)} />

            <Route path="library" element={withSuspense(Library)} />
            <Route path="library/:id" element={withSuspense(LibraryDetail)} />
            <Route path="viewer/:docId/:rev" element={withSuspense(Viewer)} />

            <Route path="admin/health" element={withSuspense(AdminHealth)} />
            <Route path="admin/action-log" element={<ProtectedRoute requireAdmin deniedToastMessage="คุณไม่มีสิทธิ์เข้าถึงประวัติการทำงาน">{withSuspense(ActionLog)}</ProtectedRoute>} />
            <Route path="admin/master-data" element={<ProtectedRoute requireAdmin deniedToastMessage="คุณไม่มีสิทธิ์เข้าถึงศูนย์จัดการข้อมูลหลัก">{withSuspense(MasterDataHub)}</ProtectedRoute>} />
            <Route path="reports" element={withSuspense(Reports)} />

            <Route path="controlled-copy" element={<ProtectedRoute requireDcc deniedToastMessage="คุณไม่มีสิทธิ์เข้าถึงศูนย์ควบคุมงาน DCC">{withSuspense(ControlledCopyRegister)}</ProtectedRoute>} />
            <Route path="external-docs" element={withSuspense(ExternalDocsList)} />
            <Route path="master-list" element={withSuspense(MasterList)} />
            
            <Route path="periodic-reviews" element={withSuspense(PeriodicReviewDashboard)} />
            <Route path="periodic-reviews/:reviewId" element={withSuspense(PeriodicReviewDetail)} />


          </Route>

          {/* Aliases for backwards compatibility */}
          <Route path="dashboard" element={<Navigate to="/dcc/dashboard" replace />} />
          <Route path="dar/new" element={<Navigate to="/dcc/dar/new" replace />} />
          <Route path="dar/new/document" element={<Navigate to="/dcc/dar/new/document" replace />} />
          <Route path="dar/new/revision" element={<Navigate to="/dcc/dar/new/revision" replace />} />
          <Route path="dar/new/obsolete" element={<Navigate to="/dcc/dar/new/obsolete" replace />} />
          <Route path="dar/list" element={<Navigate to="/dcc/dar/list" replace />} />
          <Route path="dar/:id" element={<AliasRedirect to="/dcc/dar/:id" />} />

          <Route path="tasks" element={<Navigate to="/dcc/tasks" replace />} />
          <Route path="tasks/review/:id" element={<AliasRedirect to="/dcc/tasks/review/:id" />} />
          <Route path="tasks/approve/:id" element={<AliasRedirect to="/dcc/tasks/approve/:id" />} />
          <Route path="tasks/ack/:id" element={<AliasRedirect to="/dcc/tasks/ack/:id" />} />
          <Route path="tasks/revise/:id" element={<AliasRedirect to="/dcc/tasks/revise/:id" />} />
          <Route path="tasks/approve-replacement/:id" element={<AliasRedirect to="/dcc/tasks/approve-replacement/:id" />} />
          <Route path="tasks/confirm-receipt/:id" element={<AliasRedirect to="/dcc/tasks/confirm-receipt/:id" />} />

          <Route path="library" element={<Navigate to="/dcc/library" replace />} />
          <Route path="library/:id" element={<AliasRedirect to="/dcc/library/:id" />} />
          <Route path="viewer/:docId/:rev" element={<AliasRedirect to="/dcc/viewer/:docId/:rev" />} />

          <Route path="admin/health" element={<Navigate to="/dcc/admin/health" replace />} />
          <Route path="admin/action-log" element={<Navigate to="/dcc/admin/action-log" replace />} />
          <Route path="admin/master-data" element={<Navigate to="/dcc/admin/master-data" replace />} />
          <Route path="master-data" element={<Navigate to="/dcc/admin/master-data" replace />} />
          <Route path="reports" element={<Navigate to="/dcc/reports" replace />} />

          <Route path="controlled-copy" element={<Navigate to="/dcc/controlled-copy" replace />} />
          <Route path="external-docs" element={<Navigate to="/dcc/external-docs" replace />} />
          <Route path="master-list" element={<Navigate to="/dcc/master-list" replace />} />
          
          <Route path="periodic-reviews" element={<Navigate to="/dcc/periodic-reviews" replace />} />
          <Route path="periodic-reviews/:reviewId" element={<AliasRedirect to="/dcc/periodic-reviews/:reviewId" />} />

          {/* Prototypes */}
          <Route path="demo-distribution" element={withSuspense(DistributionDemo)} />

          <Route path="*" element={withSuspense(NotFound)} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
