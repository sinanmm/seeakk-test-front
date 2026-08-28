import React, { lazy, Suspense } from 'react';
import useWorkspaceStore from '../store/useWorkspaceStore';
import SeeakkProductLoader from './common/SeeakkProductLoader';

const PaymentPage = lazy(() => import('../pages/subscription/PaymentPage'));
const PaymentPendingPage = lazy(() => import('../pages/subscription/PaymentPendingPage'));

interface BillingAccessGateProps {
  children: React.ReactNode;
}

const BillingAccessGate: React.FC<BillingAccessGateProps> = ({ children }) => {
  const billingStatus = useWorkspaceStore((state) => state.billingStatus);
  const isLoaded = useWorkspaceStore((state) => state.isLoaded);

  // If the workspace config hasn't loaded yet, show loader to avoid flashing unstyled content.
  if (!isLoaded) {
    return <SeeakkProductLoader fullScreen={true} />; 
  }

  if (billingStatus === 'LOCKED' || billingStatus === 'COMPANY_LOCKED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-slate-200">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600 font-bold text-2xl">
            🔒
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Workspace Locked</h2>
          <p className="text-slate-600 text-sm mb-6">
            This workspace is currently locked by administration. Please contact SEEAKK support for assistance.
          </p>
        </div>
      </div>
    );
  }

  if (billingStatus === 'SUSPENDED' || billingStatus === 'COMPANY_SUSPENDED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-slate-200">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 font-bold text-2xl">
            🚫
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Workspace Suspended</h2>
          <p className="text-slate-600 text-sm mb-6">
            This workspace has been suspended by platform administration. Please contact SEEAKK support.
          </p>
        </div>
      </div>
    );
  }

  if (billingStatus === 'PAYMENT_REQUIRED' || billingStatus === 'EXPIRED') {
    return (
      <Suspense fallback={<SeeakkProductLoader fullScreen={true} />}>
        <PaymentPage />
      </Suspense>
    );
  }

  if (billingStatus === 'PAYMENT_PENDING') {
    return (
      <Suspense fallback={<SeeakkProductLoader fullScreen={true} />}>
        <PaymentPendingPage />
      </Suspense>
    );
  }

  // If status is ACTIVE, GRACE, or legacy (null/undefined), render application routes
  return <>{children}</>;
};

export default BillingAccessGate;
