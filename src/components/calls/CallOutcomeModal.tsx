import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ExternalLink,
  PhoneCall,
  PhoneOff,
  Sparkles,
  Tag,
  User,
  X,
} from 'lucide-react';
import { fetchGroupedSubstages, GroupedSubstages, LeadSubstage } from '../../services/substages.api';
import { saveCallOutcome, SaveCallOutcomePayload } from '../../services/calls.api';
import LOBModal from '../../pages/leads/components/LOBModal';
import LeadFormDrawer from '../../pages/leads/components/LeadFormDrawer';
import type { LeadListItem } from '../../types/lead.types';

interface CallOutcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  callSessionId: string;
  leadId: string;
  leadName?: string;
  leadPhone?: string;
  sourceContext?: string;
  followUpId?: string;
  currentStageName?: string;
  currentSubstageName?: string;
  onSuccess?: (result: any) => void;
  onReturnToFollowUp?: () => void;
}

export const CallOutcomeModal: React.FC<CallOutcomeModalProps> = ({
  isOpen,
  onClose,
  callSessionId,
  leadId,
  leadName = 'Lead',
  leadPhone = '',
  sourceContext = 'ALL_LEADS',
  followUpId,
  currentStageName,
  currentSubstageName,
  onSuccess,
  onReturnToFollowUp,
}) => {
  const queryClient = useQueryClient();
  const [groupedSubstages, setGroupedSubstages] = useState<GroupedSubstages[]>([]);
  const [loadingSubstages, setLoadingSubstages] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTED' | 'NOT_CONNECTED'>('CONNECTED');
  const [selectedSubstageId, setSelectedSubstageId] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [callPriority, setCallPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM');
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [nextFollowUpTime, setNextFollowUpTime] = useState('10:00');
  const [followUpDescription, setFollowUpDescription] = useState('');

  // LOB Entry Modal Interception State
  const [isLOBModalOpen, setIsLOBModalOpen] = useState(false);

  // LOB Exit Modal Interception State (Return from LOB)
  const [isLOBExitModalOpen, setIsLOBExitModalOpen] = useState(false);
  const [lobExitReason, setLobExitReason] = useState('');

  // Open Lead Drawer State
  const [isLeadDrawerOpen, setIsLeadDrawerOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      void loadSubstages();
      setSelectedSubstageId(null);
      setSelectedStageId(null);
      setErrorMsg(null);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      setNextFollowUpDate(tomorrow.toISOString().split('T')[0]);
    }
  }, [isOpen]);

  const loadSubstages = async () => {
    setLoadingSubstages(true);
    try {
      const data = await fetchGroupedSubstages();
      setGroupedSubstages(data || []);
    } catch (err) {
      console.error('Failed to load lead stages and substages:', err);
      setErrorMsg('Failed to load configured lead stages. Please try again.');
    } finally {
      setLoadingSubstages(false);
    }
  };

  if (!isOpen) return null;

  // Check if current stage is an LOB stage based on metadata or stage name
  const isCurrentLOB = Boolean(
    (currentStageName || '').toLowerCase().includes('lob') ||
      groupedSubstages.find(
        (g) => g.name.toLowerCase() === (currentStageName || '').toLowerCase(),
      )?.isLOB,
  );

  // Construct minimal lead object for LeadFormDrawer
  const leadItemForDrawer = {
    id: leadId,
    name: leadName,
    phone: leadPhone,
    stage: currentStageName ? { id: '', name: currentStageName } : undefined,
    substage: currentSubstageName ? { id: '', name: currentSubstageName } : undefined,
  } as unknown as LeadListItem;

  const getTargetGroup = () => {
    return groupedSubstages.find((group) => {
      if (selectedSubstageId) {
        return group.substages.some((sub) => sub.id === selectedSubstageId);
      }
      return group.id === selectedStageId;
    });
  };

  const executeOutcomeSubmission = async (extraPayload?: {
    reasonId?: string;
    remarks?: string;
    lobExitReason?: string;
  }) => {
    setSubmitting(true);
    setErrorMsg(null);

    const targetGroup = getTargetGroup();

    const payload: SaveCallOutcomePayload = {
      callSessionId,
      connectionStatus,
      substageId: selectedSubstageId || undefined,
      targetStageId: selectedStageId || (targetGroup ? targetGroup.id : undefined),
      outcomeNotes: outcomeNotes.trim() || undefined,
      callPriority,
      followUpRequired,
      nextFollowUpDate: followUpRequired ? nextFollowUpDate : undefined,
      nextFollowUpTime: followUpRequired ? nextFollowUpTime : undefined,
      followUpDescription: followUpRequired ? followUpDescription || outcomeNotes : undefined,
      reasonId: extraPayload?.reasonId,
      lobReasonId: extraPayload?.reasonId,
      lobRemarks: extraPayload?.remarks,
      lobExitReason: extraPayload?.lobExitReason,
      lobReturnRemarks: extraPayload?.lobExitReason,
    };

    try {
      const res = await saveCallOutcome(leadId, payload);

      if (res?.lead) {
        queryClient.setQueryData(['lead', leadId], (prev: any) =>
          prev ? { ...prev, ...res.lead } : res.lead,
        );
        queryClient.setQueriesData({ queryKey: ['leads'] }, (prev: any) => {
          if (!prev || !prev.leads) return prev;
          return {
            ...prev,
            leads: prev.leads.map((l: any) => (l.id === leadId ? { ...l, ...res.lead } : l)),
          };
        });
      }

      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['leads'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['lead', leadId], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['followups'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['closed-leads'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['lob-analysis'], refetchType: 'all' }),
      ]);

      if (onSuccess) onSuccess(res);
      onClose();

      if (sourceContext === 'FOLLOW_UP_POPUP' && onReturnToFollowUp) {
        onReturnToFollowUp();
      }
    } catch (err: any) {
      console.error('Failed to save call outcome:', err);
      const msg = err.response?.data?.message || 'Failed to save call outcome. Please try again.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg(null);

    // Check target stage classification when a substage or stage is selected
    const targetGroup = getTargetGroup();

    if (targetGroup) {
      // Case 1: Non-LOB -> LOB Entry
      if (!isCurrentLOB && targetGroup.isLOB) {
        setIsLOBModalOpen(true);
        return;
      }

      // Case 2: LOB -> Non-LOB Return
      if (isCurrentLOB && !targetGroup.isLOB) {
        setIsLOBExitModalOpen(true);
        return;
      }
    }

    void executeOutcomeSubmission();
  };

  const handleLOBConfirm = async ({ reasonId, remarks }: { reasonId: string; remarks: string }) => {
    setIsLOBModalOpen(false);
    await executeOutcomeSubmission({ reasonId, remarks });
  };

  const handleLOBCancel = () => {
    setIsLOBModalOpen(false);
    setErrorMsg('LOB stage change was not completed. Select a reason or choose another outcome.');
  };

  const handleLOBExitConfirm = async () => {
    if (!lobExitReason.trim()) return;
    setIsLOBExitModalOpen(false);
    await executeOutcomeSubmission({ lobExitReason: lobExitReason.trim() });
    setLobExitReason('');
  };

  const handleLOBExitCancel = () => {
    setIsLOBExitModalOpen(false);
    setLobExitReason('');
    setErrorMsg('LOB return was not completed. Select a return reason or choose another outcome.');
  };

  const hasAnySelection = Boolean(selectedSubstageId || selectedStageId);

  const content = (
    <>
      <div className="fixed inset-0 z-[10200] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fadeIn">
        <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-600">
                <PhoneCall className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-gray-900">
                  Call Outcome &amp; Lead Update
                </h2>
                <p className="text-xs font-semibold text-gray-500">
                  Record the call result, update the lead stage, and continue the follow-up workflow.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsLeadDrawerOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200/80 hover:bg-emerald-100 transition-all cursor-pointer shadow-sm"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Lead</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Body */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-gray-800">
            {/* Single Warning / Error Message Banner */}
            {errorMsg && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-3 shadow-sm">
                <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Lead Snapshot Pill */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-gray-900">{leadName}</div>
                  {leadPhone && <div className="text-[11px] font-semibold text-gray-500">{leadPhone}</div>}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-400 font-semibold">Current Status:</span>
                {currentStageName && (
                  <span
                    className={`px-2.5 py-1 rounded-xl font-extrabold text-[11px] ${
                      isCurrentLOB ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {currentStageName}
                  </span>
                )}
                {currentSubstageName && (
                  <span className="px-2.5 py-1 rounded-xl bg-gray-200 text-gray-700 font-bold text-[11px]">
                    {currentSubstageName}
                  </span>
                )}
              </div>
            </div>

            {/* Section 1: Connection Status */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">
                1. Connection Status <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConnectionStatus('CONNECTED')}
                  className={`flex items-center gap-3.5 p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    connectionStatus === 'CONNECTED'
                      ? 'border-emerald-500 bg-emerald-50/50 ring-4 ring-emerald-500/10 shadow-sm'
                      : 'border-gray-200/80 bg-white hover:border-gray-300'
                  }`}
                >
                  <div
                    className={`p-2.5 rounded-xl ${
                      connectionStatus === 'CONNECTED'
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-extrabold text-xs text-gray-900">Call Connected</div>
                    <div className="text-[11px] font-semibold text-gray-500">Spoke with lead successfully</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setConnectionStatus('NOT_CONNECTED')}
                  className={`flex items-center gap-3.5 p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    connectionStatus === 'NOT_CONNECTED'
                      ? 'border-rose-500 bg-rose-50/50 ring-4 ring-rose-500/10 shadow-sm'
                      : 'border-gray-200/80 bg-white hover:border-gray-300'
                  }`}
                >
                  <div
                    className={`p-2.5 rounded-xl ${
                      connectionStatus === 'NOT_CONNECTED'
                        ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <PhoneOff className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-extrabold text-xs text-gray-900">Not Connected</div>
                    <div className="text-[11px] font-semibold text-gray-500">No answer, busy, or switched off</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Section 2: Substage Selection Grouped by Main Stage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-black uppercase tracking-wider text-gray-400">
                  2. Select Substage / Lead Stage Transition
                </label>
                {hasAnySelection && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSubstageId(null);
                      setSelectedStageId(null);
                    }}
                    className="text-xs text-rose-600 hover:underline font-extrabold cursor-pointer"
                  >
                    Clear Selection
                  </button>
                )}
              </div>

              {loadingSubstages ? (
                <div className="p-6 text-center text-gray-400 text-xs font-semibold">Loading lead stages...</div>
              ) : groupedSubstages.length === 0 ? (
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 text-xs text-gray-500 font-semibold">
                  No active lead stages configured in Master Configuration.
                </div>
              ) : (
                <div className="space-y-3">
                  {groupedSubstages.map((stageGroup) => {
                    const hasConfiguredSubstages = Array.isArray(stageGroup.substages) && stageGroup.substages.length > 0;

                    const filteredSubstages = hasConfiguredSubstages
                      ? stageGroup.substages.filter((sub) => {
                          if (!sub.connectionStatusRestriction) return true;
                          return sub.connectionStatusRestriction === connectionStatus;
                        })
                      : [];

                    const isDirectStageSelected = selectedStageId === stageGroup.id && !selectedSubstageId;

                    return (
                      <div
                        key={stageGroup.id}
                        className="p-4 rounded-2xl bg-gray-50/80 border border-gray-200/60 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                              style={{ backgroundColor: stageGroup.color || '#10b981' }}
                            />
                            <span className="font-extrabold text-xs tracking-wider uppercase text-gray-800">
                              {stageGroup.name}
                            </span>
                            {stageGroup.isLOB && (
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-rose-100 text-rose-700">
                                LOB Stage
                              </span>
                            )}
                            {stageGroup.isApprovalRequired && (
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-amber-100 text-amber-800">
                                Approval Required
                              </span>
                            )}
                            {stageGroup.isClosed && (
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-100 text-emerald-800">
                                Closed
                              </span>
                            )}
                          </div>

                          {!hasConfiguredSubstages && (
                            <span className="text-[10px] font-semibold text-gray-400">
                              Direct Stage
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {hasConfiguredSubstages ? (
                            filteredSubstages.length > 0 ? (
                              filteredSubstages.map((sub) => {
                                const isSelected = selectedSubstageId === sub.id;
                                return (
                                  <button
                                    key={sub.id}
                                    type="button"
                                    onClick={() => {
                                      if (isSelected) {
                                        setSelectedSubstageId(null);
                                        setSelectedStageId(null);
                                      } else {
                                        setSelectedSubstageId(sub.id);
                                        setSelectedStageId(stageGroup.id);
                                      }
                                    }}
                                    className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition-all flex items-center gap-1.5 cursor-pointer ${
                                      isSelected
                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20 ring-2 ring-emerald-600/20'
                                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-100'
                                    }`}
                                  >
                                    <Tag className="w-3.5 h-3.5 opacity-70" />
                                    <span>{sub.name}</span>
                                    {sub.outcomeCategory && (
                                      <span
                                        className={`text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase ${
                                          sub.outcomeCategory === 'POSITIVE'
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : sub.outcomeCategory === 'NEGATIVE'
                                            ? 'bg-rose-100 text-rose-800'
                                            : 'bg-blue-100 text-blue-800'
                                        }`}
                                      >
                                        {sub.outcomeCategory}
                                      </span>
                                    )}
                                  </button>
                                );
                              })
                            ) : (
                              <div className="text-[11px] font-semibold text-gray-400 italic py-1">
                                No substages matching &quot;{connectionStatus === 'CONNECTED' ? 'Call Connected' : 'Not Connected'}&quot;
                              </div>
                            )
                          ) : (
                            /* Direct Stage Chip for stages without substages (e.g. New) */
                            <button
                              type="button"
                              onClick={() => {
                                if (isDirectStageSelected) {
                                  setSelectedStageId(null);
                                } else {
                                  setSelectedSubstageId(null);
                                  setSelectedStageId(stageGroup.id);
                                }
                              }}
                              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition-all flex items-center gap-1.5 cursor-pointer ${
                                isDirectStageSelected
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20 ring-2 ring-emerald-600/20'
                                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-100'
                              }`}
                            >
                              <Tag className="w-3.5 h-3.5 opacity-70" />
                              <span>{stageGroup.name}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section 3: Call Priority & Outcome Notes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">
                  Call Priority
                </label>
                <div className="flex flex-col gap-2">
                  {(['HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCallPriority(p)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-extrabold border transition cursor-pointer text-center ${
                        callPriority === p
                          ? p === 'HIGH'
                            ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-sm'
                            : p === 'MEDIUM'
                            ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm'
                            : 'bg-gray-100 border-gray-400 text-gray-700 shadow-sm'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {p} Priority
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">
                  Outcome Remarks / Notes
                </label>
                <textarea
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                  rows={3}
                  placeholder="Enter key discussion details, customer interest level, or reason for no answer..."
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                />
              </div>
            </div>

            {/* Section 4: Next Follow-Up Schedule */}
            <div className="p-4 rounded-2xl border border-gray-200/80 bg-gray-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span className="font-extrabold text-xs text-gray-900">Schedule Next Follow-Up</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={followUpRequired}
                    onChange={(e) => setFollowUpRequired(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {followUpRequired && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-200">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1">Follow-Up Date</label>
                    <input
                      type="date"
                      value={nextFollowUpDate}
                      onChange={(e) => setNextFollowUpDate(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1">Time</label>
                    <input
                      type="time"
                      value={nextFollowUpTime}
                      onChange={(e) => setNextFollowUpTime(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </form>

          {/* Sticky Footer */}
          <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/80 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-extrabold text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
            >
              Cancel / Close
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs tracking-wide shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving Outcome...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Submit Outcome</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Non-LOB -> LOB Entry Modal Interception */}
      <LOBModal
        isOpen={isLOBModalOpen}
        isSubmitting={submitting}
        onClose={handleLOBCancel}
        onConfirm={handleLOBConfirm}
      />

      {/* LOB -> Non-LOB Exit/Return Modal Interception */}
      {isLOBExitModalOpen && (
        <div className="fixed inset-0 z-[10350] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-gray-100">
            <h3 className="text-lg font-black text-gray-900 mb-1">Return From LOB</h3>
            <p className="text-xs font-semibold text-gray-500 mb-4">
              Please enter the reason for returning this lead from Loss Of Business (LOB).
            </p>

            <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-2">
              LOB Return Remark <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={lobExitReason}
              onChange={(e) => setLobExitReason(e.target.value)}
              rows={4}
              placeholder="e.g. Customer interested again after follow-up call..."
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-900 outline-none focus:border-emerald-500 focus:bg-white transition-all placeholder:text-gray-400"
            />

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleLOBExitCancel}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-extrabold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!lobExitReason.trim() || submitting}
                onClick={handleLOBExitConfirm}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs disabled:opacity-50 transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
              >
                Confirm LOB Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Open Lead Form Drawer Layered Above Call Outcome */}
      <LeadFormDrawer
        isOpen={isLeadDrawerOpen}
        mode="edit"
        lead={leadItemForDrawer}
        onClose={() => setIsLeadDrawerOpen(false)}
      />
    </>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
};
