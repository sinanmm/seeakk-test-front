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

  // If the workspace config hasn't loaded yet, let the normal loading state handle it, 
  // or return null to avoid flashing unstyled content.
  if (!isLoaded) {
    return null; 
  }

  if (billingStatus === 'PAYMENT_REQUIRED') {
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

  // If status is active, expired, or undefined (legacy), let them through the gate. 
  // (We handle EXPIRED similarly later if needed)
  return <>{children}</>;
};

export default BillingAccessGate;
