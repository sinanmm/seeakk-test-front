import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getTodayStatus } from '../services/attendance.api';
import { useAuthenticatedWorkflowEnabled } from '../hooks/useAuthenticatedWorkflowEnabled';
import { subscribeAttendanceRefresh } from '../utils/attendanceRefresh';
import { useMandatoryNavigationLock } from '../hooks/useMandatoryNavigationLock';
import { MandatoryAttendanceModal } from './MandatoryAttendanceModal';

interface Props {
  children: React.ReactNode;
}

const MandatoryAttendanceGate: React.FC<Props> = ({ children }) => {
  const enabled = useAuthenticatedWorkflowEnabled();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutDismissed, setCheckoutDismissed] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!enabled) {
      setStatus(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await getTodayStatus();
      if (res.success) {
        setStatus(res.data);
      }
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => subscribeAttendanceRefresh(() => void loadStatus()), [loadStatus]);

  useEffect(() => {
    setCheckoutDismissed(false);
  }, [status?.date, status?.record?.id]);

  const isCheckoutPopup = Boolean(
    status && (status.requiresMandatoryCheckoutPopup || status.canCheckOut) && !status.requiresMandatoryPopup && !status.isLocked
  );

  const blocked = Boolean(
    enabled &&
      status &&
      !status.isHoliday &&
      !status.isWeeklyOff &&
      (status.requiresMandatoryPopup || (status.requiresMandatoryCheckoutPopup && !checkoutDismissed) || status.isLocked),
  );

  useMandatoryNavigationLock(blocked);

  useEffect(() => {
    if (!blocked) return undefined;

    const blockKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const blockBackButton = () => {
      window.history.pushState(null, '', window.location.href);
    };

    document.addEventListener('keydown', blockKeys, true);
    window.addEventListener('popstate', blockBackButton);
    window.history.pushState(null, '', window.location.href);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', blockKeys, true);
      window.removeEventListener('popstate', blockBackButton);
      document.body.style.overflow = previousOverflow;
    };
  }, [blocked]);

  if (!enabled) {
    return <>{children}</>;
  }

  const showLoader = blocked && loading;
  const modal =
    blocked && !loading && status ? (
      <MandatoryAttendanceModal
        status={status}
        onSuccess={() => void loadStatus()}
        onClose={isCheckoutPopup ? () => setCheckoutDismissed(true) : undefined}
      />
    ) : null;

  return (
    <>
      {children}
      {blocked && modal && typeof document !== 'undefined' ? createPortal(modal, document.body) : modal}
    </>
  );
};

export default MandatoryAttendanceGate;
