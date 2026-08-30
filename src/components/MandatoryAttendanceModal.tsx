import React, { useEffect, useMemo, useState } from 'react';
import { ShieldAlert, CheckCircle2, AlertTriangle, Globe, MapPin, Loader2, ClipboardList, X } from 'lucide-react';
import { checkOutAttendance, markAttendance } from '../services/attendance.api';
import { dispatchAttendanceRefresh } from '../utils/attendanceRefresh';
import {
  AttendanceGeolocationError,
  captureAttendanceLocation,
  previewDistanceMeters,
  type CapturedAttendanceLocation,
} from '../utils/attendanceGeolocation';
import toast from 'react-hot-toast';
import TargetLockDetails, { type TargetLockDetailsData } from './TargetLockDetails';
import { formatAttendanceDateTime } from '../utils/attendanceTimezone';

interface OfficeLocationProfile {
  id: string;
  officeName: string;
  branch?: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

interface MandatoryAttendanceModalProps {
  status: {
    date: string;
    isLocked?: boolean;
    attendanceApplyType?: string;
    record?: any;
    assignedOfficeLocation?: OfficeLocationProfile | null;
    locationValidationActive?: boolean;
    locationSetupMessage?: string | null;
    officeLocationConfigured?: boolean;
    officeBranchAssigned?: boolean;
    isTargetLocked?: boolean;
    targetLock?: TargetLockDetailsData | null;
    requiresMandatoryCheckoutPopup?: boolean;
    canCheckOut?: boolean;
    expectedCheckInTime?: string | null;
    expectedCheckOutTime?: string | null;
  };
  onSuccess?: () => void;
  onClose?: () => void;
}

export const MandatoryAttendanceModal: React.FC<MandatoryAttendanceModalProps> = ({ status, onSuccess, onClose }) => {
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [attendanceType, setAttendanceType] = useState('PRESENT');
  const [notes, setNotes] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [dailySummary, setDailySummary] = useState('');
  const [liveLocation, setLiveLocation] = useState<CapturedAttendanceLocation | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);

  const mode = useMemo(
    () => (status.requiresMandatoryCheckoutPopup || status.canCheckOut ? 'checkout' : 'checkin'),
    [status.canCheckOut, status.requiresMandatoryCheckoutPopup],
  );

  const office = status.assignedOfficeLocation ?? null;
  const isRestricted = status.attendanceApplyType === 'FROM_OFFICE';
  const needsOfficeGps = isRestricted && !['WORK_FROM_HOME', 'LEAVE'].includes(attendanceType);
  const locationValidationActive = Boolean(status.locationValidationActive);
  const needsGps = mode === 'checkin' && needsOfficeGps && locationValidationActive;
  const setupBlocked = mode === 'checkin' && needsOfficeGps && !locationValidationActive;
  const setupMessage = status.locationSetupMessage || 'Office location is not configured yet. Please contact administrator.';

  useEffect(() => {
    if (mode !== 'checkin') return;
    setDailySummary('');
  }, [mode]);

  useEffect(() => {
    if (mode !== 'checkout') return;
    setAttendanceType(status.record?.attendanceType || 'PRESENT');
  }, [mode, status.record?.attendanceType]);

  useEffect(() => {
    const refreshLocationPreview = async () => {
      if (!needsGps || !office) {
        setLiveLocation(null);
        setDistanceMeters(null);
        return;
      }
      setLocating(true);
      try {
        const captured = await captureAttendanceLocation();
        setLiveLocation(captured);
        setDistanceMeters(previewDistanceMeters(captured.latitude, captured.longitude, office.latitude, office.longitude));
      } catch (err) {
        setLiveLocation(null);
        setDistanceMeters(null);
        if (err instanceof AttendanceGeolocationError) {
          toast.error(err.message);
        }
      } finally {
        setLocating(false);
      }
    };

    void refreshLocationPreview();
  }, [needsGps, office, mode]);

  const withinRadius = distanceMeters != null && office ? distanceMeters <= office.radiusMeters : !needsGps;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (setupBlocked) {
      toast.error(setupMessage, { duration: 7000 });
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'checkout') {
        const response = await checkOutAttendance({
          date: status.date,
          checkOutTime: new Date().toISOString(),
          dailySummary,
          notes,
          attachmentUrl,
        });

        if (response.success) {
          toast.success(
            response.data?.approvalStatus === 'PENDING'
              ? 'Checkout submitted for approval.'
              : 'Checkout completed successfully.',
          );
          dispatchAttendanceRefresh({ action: 'checked_out' });
          onSuccess?.();
        }
        return;
      }

      let locationPayload: Partial<CapturedAttendanceLocation> = {};
      if (needsGps) {
        const captured = liveLocation ?? (await captureAttendanceLocation());
        locationPayload = captured;
        if (office) {
          const dist = previewDistanceMeters(captured.latitude, captured.longitude, office.latitude, office.longitude);
          if (dist > office.radiusMeters) {
            toast.error('You can only mark attendance from office location.');
            return;
          }
        }
      }

      const response = await markAttendance({
        attendanceType,
        checkInTime: new Date().toISOString(),
        date: status.date,
        latitude: locationPayload.latitude,
        longitude: locationPayload.longitude,
        gpsAccuracy: locationPayload.gpsAccuracy,
        locationCapturedAt: locationPayload.locationCapturedAt,
        clientChannel: 'web',
        deviceInfo: navigator.userAgent,
        notes,
        attachmentUrl,
      });

      if (response.success) {
        toast.success(
          response.data?.approvalStatus === 'PENDING'
            ? 'Attendance submitted for supervisor approval.'
            : 'Attendance marked successfully.',
        );
        dispatchAttendanceRefresh({ action: 'submitted' });
        onSuccess?.();
      }
    } catch (err: any) {
      const data = err.response?.data;
      toast.error(data?.message || `Failed to ${mode === 'checkout' ? 'checkout' : 'submit attendance'}.`, { duration: 6000 });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 select-none" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-2xl backdrop-saturate-150" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/12 via-white/8 to-sky-400/10" aria-hidden />
      <div className="pointer-events-none absolute left-[10%] top-[12%] h-48 w-48 rounded-full bg-white/12 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute bottom-[10%] right-[12%] h-56 w-56 rounded-full bg-emerald-300/12 blur-3xl" aria-hidden />

      <div className="relative w-full max-w-xl overflow-hidden rounded-[28px] border border-white/45 bg-white/78 shadow-[0_24px_80px_rgba(15,23,42,0.28)] backdrop-blur-2xl">
        <div className="relative bg-emerald-600 px-8 py-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/10 p-3">
                {mode === 'checkout' ? <ClipboardList size={24} /> : <CheckCircle2 size={24} />}
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-wide">
                  {mode === 'checkout' ? 'Daily Check-out Required' : 'Daily Check-in Required'}
                </h2>
                <p className="mt-1 text-xs text-emerald-100">
                  {mode === 'checkout'
                    ? `Expected checkout: ${status.expectedCheckOutTime || '--:--'}`
                    : `Expected check-in: ${status.expectedCheckInTime || '--:--'}`}
                </p>
              </div>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-full p-2 text-white/80 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {status.isLocked ? (
          status.isTargetLocked && status.targetLock ? (
            <TargetLockDetails lock={status.targetLock} />
          ) : (
            <div className="flex flex-col items-center p-8 text-center">
              <div className="mb-4 rounded-full bg-rose-50 p-5 text-rose-500">
                <ShieldAlert size={48} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Your Account is Locked</h3>
              <p className="mt-2 max-w-md text-sm text-gray-500">Contact your supervisor to unlock your account before continuing.</p>
            </div>
          )
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 p-8">
            {mode === 'checkin' ? (
              <>
                <div className={`flex items-start gap-3 rounded-2xl border p-4 ${isRestricted ? 'border-amber-100 bg-amber-50 text-amber-800' : 'border-emerald-100 bg-emerald-50 text-emerald-800'}`}>
                  {isRestricted ? <AlertTriangle size={18} className="mt-0.5 text-amber-500" /> : <Globe size={18} className="mt-0.5 text-emerald-500" />}
                  <div className="text-xs">
                    <p className="font-bold">Attendance Apply Type: {isRestricted ? 'From Office' : 'From Anywhere'}</p>
                    <p className="mt-1 opacity-90">
                      {isRestricted
                        ? 'You must be within your assigned office branch radius to submit attendance.'
                        : 'You may check in from any location.'}
                    </p>
                  </div>
                </div>

                {setupBlocked && (
                  <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
                    <div>
                      <p className="font-bold">Office location setup required</p>
                      <p className="mt-1 opacity-90">{setupMessage}</p>
                    </div>
                  </div>
                )}

                {needsGps && office && (
                  <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-xs">
                    <p className="font-semibold text-gray-800">{office.officeName}{office.branch ? ` � ${office.branch}` : ''}</p>
                    {locating ? (
                      <p className="flex items-center gap-2 text-gray-500">
                        <Loader2 className="h-3 w-3 animate-spin" /> Detecting your location...
                      </p>
                    ) : liveLocation ? (
                      <p className={`font-bold ${withinRadius ? 'text-emerald-700' : 'text-rose-600'}`}>
                        Distance: {distanceMeters != null ? `${Math.round(distanceMeters)} m` : '--'}
                      </p>
                    ) : (
                      <p className="text-rose-600">Location not detected. Enable GPS and try again.</p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">Attendance Type</label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { value: 'PRESENT', label: 'Present' },
                      { value: 'HALF_DAY', label: 'Half Day' },
                      { value: 'WORK_FROM_HOME', label: 'WFH' },
                      { value: 'LEAVE', label: 'Leave' },
                    ].map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setAttendanceType(item.value)}
                        className={`rounded-xl border px-2 py-3 text-sm font-semibold transition-all ${
                          attendanceType === item.value
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
                <p className="font-bold">Check-in recorded</p>
                <p className="mt-1">{formatAttendanceDateTime(status.record?.checkInTime)}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={mode === 'checkout' ? 'Optional closing notes...' : 'Work plan or reason...'}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:outline-emerald-500"
              />
            </div>

            {mode === 'checkout' && (
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">Daily Work Summary</label>
                <textarea
                  rows={4}
                  value={dailySummary}
                  onChange={(e) => setDailySummary(e.target.value)}
                  placeholder="Created 10 leads, completed 4 followups, processed 6 registrations..."
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:outline-emerald-500"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">Attachment (optional)</label>
              <input
                type="url"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:outline-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || locating || setupBlocked || (mode === 'checkin' && needsGps && !withinRadius) || (mode === 'checkout' && !dailySummary.trim())}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-sm font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting || locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              {mode === 'checkout' ? 'Check Out & Continue' : 'Check In & Continue'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
