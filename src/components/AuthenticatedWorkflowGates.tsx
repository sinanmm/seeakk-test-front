import React, { useEffect, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import MandatoryOverdueFollowUpGate from './calendar/MandatoryOverdueFollowUpGate';
import MandatoryFollowUpContinuationGate from './calendar/MandatoryFollowUpContinuationGate';
import MandatoryAttendanceGate from './MandatoryAttendanceGate';
import { useAuthenticatedWorkflowEnabled } from '../hooks/useAuthenticatedWorkflowEnabled';
import useWorkspaceStore from '../store/useWorkspaceStore';
import FollowupPostActionConfirmationModal from './followup/FollowupPostActionConfirmationModal';
import { useFollowupWorkflowStore } from '../store/followupWorkflowStore';
import BillingAccessGate from './BillingAccessGate';

const LeadFormDrawer = lazy(() => import('../pages/leads/components/LeadFormDrawer'));

const GlobalFollowupWorkflowListener: React.FC = () => {
  const isEditingFromFollowup = useFollowupWorkflowStore((state) => state.isEditingFromFollowup);
  const openedLead = useFollowupWorkflowStore((state) => state.openedLead);
  const handleLeadCancel = useFollowupWorkflowStore((state) => state.handleLeadCancel);

  if (!isEditingFromFollowup || !openedLead) return null;

  const content = (
    <Suspense fallback={null}>
      <LeadFormDrawer
        isOpen={true}
        mode="edit"
        lead={openedLead}
        onClose={() => {
          if (useFollowupWorkflowStore.getState().isEditingFromFollowup) {
            handleLeadCancel();
          }
        }}
      />
    </Suspense>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
};

interface Props {
  children: React.ReactNode;
}

/**
 * Mounts mandatory attendance / follow-up gates only after login on app routes.
 * Public landing and auth pages render children with no workflow checks.
 */
const AuthenticatedWorkflowGates: React.FC<Props> = ({ children }) => {
  const workflowEnabled = useAuthenticatedWorkflowEnabled();
  const fetchWorkspaceConfig = useWorkspaceStore((state) => state.fetchWorkspaceConfig);

  useEffect(() => {
    if (workflowEnabled) {
      void fetchWorkspaceConfig();
    }
  }, [workflowEnabled, fetchWorkspaceConfig]);

  if (!workflowEnabled) {
    return <>{children}</>;
  }

  return (
    <BillingAccessGate>
      <MandatoryOverdueFollowUpGate>
        <MandatoryFollowUpContinuationGate>
          <MandatoryAttendanceGate>
            {children}
            <FollowupPostActionConfirmationModal />
            <GlobalFollowupWorkflowListener />
          </MandatoryAttendanceGate>
        </MandatoryFollowUpContinuationGate>
      </MandatoryOverdueFollowUpGate>
    </BillingAccessGate>
  );
};

export default AuthenticatedWorkflowGates;
