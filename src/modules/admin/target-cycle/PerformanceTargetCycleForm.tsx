import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Save, Trash2, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { useLeadStagesQuery } from '../../../hooks/useLeadStagesQuery';
import { getActiveProducts } from '../../../services/products.api';
import { countPeriodSlots, periodSlotLabel, previewTotalTargetDays, generatePeriods } from './targetCycleDuration';

export type PerformanceTargetCyclePayload = {
  name: string;
  description?: string;
  targetType: 'WEEKLY' | 'MONTHLY' | 'SEMI_ANNUAL' | 'MANUAL';
  targetMetric: 'LEADS' | 'REVENUE' | 'FOLLOW_UP' | 'PRODUCTS';
  leadStageId?: string | null;
  startDate: string;
  endDate?: string | null;
  numberOfMonths?: number;
  periodCounts?: number[];
  periods?: Array<{
    label: string;
    periodIndex: number;
    targetCount: number;
    startDate: string;
    endDate: string;
    lockingDate: string;
    allowSelfUnlock?: boolean;
    selfUnlockGraceDays?: number | null;
    lockSupervisorOnRefailure?: boolean;
    enableSupervisorLockChain?: boolean;
    metrics?: Array<{
      metricType: 'LEADS' | 'REVENUE' | 'FOLLOW_UP' | 'PRODUCTS';
      targetValue: number;
      stageTargets?: Array<{ leadStageId: string; targetValue: number }> | null;
      productTargets?: Array<{ productId: string; targetValue: number }> | null;
    }> | null;
  }>;
  status: 'ACTIVE' | 'INACTIVE';
  lockingEnabled: boolean;
};

interface Props {
  initialData?: Partial<PerformanceTargetCyclePayload> & { id?: string };
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: PerformanceTargetCyclePayload) => Promise<void> | void;
}

type PeriodRow = NonNullable<PerformanceTargetCyclePayload['periods']>[number];

const createEmptyManualPeriod = (index: number, startDate: string): PeriodRow => ({
  label: `Period ${index + 1}`,
  periodIndex: index,
  targetCount: 0,
  startDate,
  endDate: startDate,
  lockingDate: startDate,
  metrics: [
    { metricType: 'LEADS', targetValue: 0, stageTargets: [] },
  ],
});

const PerformanceTargetCycleForm: React.FC<Props> = ({ initialData, isSubmitting, onCancel, onSubmit }) => {
  const { data: stagesData } = useLeadStagesQuery();
  const nonLobStages = useMemo(() => {
    const rows = (stagesData as any)?.data || (stagesData as any)?.stages || [];
    return rows.filter((stage: { isLOB?: boolean }) => !stage.isLOB);
  }, [stagesData]);

  const { data: activeProductsData } = useQuery({
    queryKey: ['active-products'],
    queryFn: getActiveProducts,
  });
  const activeProducts = useMemo(() => {
    const rows = (activeProductsData as any)?.data || (activeProductsData as any) || [];
    return Array.isArray(rows) ? rows.filter((p: any) => p.status === 'ACTIVE' || !p.status) : [];
  }, [activeProductsData]);

  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [targetType, setTargetType] = useState<PerformanceTargetCyclePayload['targetType']>(
    initialData?.targetType || 'MONTHLY',
  );
  const [startDate, setStartDate] = useState(
    initialData?.startDate || format(new Date(), 'yyyy-MM-dd'),
  );
  const [numberOfMonths, setNumberOfMonths] = useState(initialData?.numberOfMonths || 6);
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>(initialData?.status || 'ACTIVE');
  const [lockingEnabled, setLockingEnabled] = useState(initialData?.lockingEnabled !== false);

  const [expandedPeriods, setExpandedPeriods] = useState<Record<number, boolean>>({ 0: true });

  const [periodsState, setPeriodsState] = useState<PeriodRow[]>(() => {
    if (initialData?.periods?.length) {
      return initialData.periods.map((p) => ({
        ...p,
        startDate: String(p.startDate).slice(0, 10),
        endDate: String(p.endDate).slice(0, 10),
        lockingDate: String(p.lockingDate).slice(0, 10),
        allowSelfUnlock: Boolean(p.allowSelfUnlock),
        selfUnlockGraceDays: p.allowSelfUnlock && p.selfUnlockGraceDays ? Number(p.selfUnlockGraceDays) : null,
        lockSupervisorOnRefailure: p.allowSelfUnlock ? Boolean(p.lockSupervisorOnRefailure) : false,
        enableSupervisorLockChain: p.allowSelfUnlock && p.lockSupervisorOnRefailure ? Boolean(p.enableSupervisorLockChain) : false,
        metrics: p.metrics || [],
      }));
    }
    if (targetType === 'MANUAL') {
      return [createEmptyManualPeriod(0, startDate)];
    }
    const generated = generatePeriods({ targetType, startDate, numberOfMonths });
    return generated.map((gen) => ({
      label: gen.label,
      periodIndex: gen.periodIndex,
      targetCount: 0,
      startDate: gen.startDate,
      endDate: gen.endDate,
      lockingDate: gen.lockingDate,
      allowSelfUnlock: false,
      selfUnlockGraceDays: null,
      lockSupervisorOnRefailure: false,
      enableSupervisorLockChain: false,
      metrics: [
        { metricType: 'LEADS', targetValue: 0, stageTargets: [] },
      ],
    }));
  });

  const periodSlots = useMemo(
    () => countPeriodSlots({ targetType, startDate, numberOfMonths }),
    [numberOfMonths, startDate, targetType],
  );

  useEffect(() => {
    if (targetType === 'MANUAL') return;
    const generated = generatePeriods({ targetType, startDate, numberOfMonths });
    setPeriodsState((prev) => {
      return generated.map((gen) => {
        const existing = prev.find((p) => p.periodIndex === gen.periodIndex);
        if (existing) {
          return {
            ...gen,
            targetCount: existing.targetCount,
            allowSelfUnlock: Boolean(existing.allowSelfUnlock),
            selfUnlockGraceDays: existing.allowSelfUnlock && existing.selfUnlockGraceDays ? Number(existing.selfUnlockGraceDays) : null,
            lockSupervisorOnRefailure: existing.allowSelfUnlock ? Boolean(existing.lockSupervisorOnRefailure) : false,
            enableSupervisorLockChain: existing.allowSelfUnlock && existing.lockSupervisorOnRefailure ? Boolean(existing.enableSupervisorLockChain) : false,
            metrics: existing.metrics || [{ metricType: 'LEADS', targetValue: 0, stageTargets: [] }],
          };
        }
        return {
          ...gen,
          targetCount: 0,
          allowSelfUnlock: false,
          selfUnlockGraceDays: null,
          lockSupervisorOnRefailure: false,
          enableSupervisorLockChain: false,
          metrics: [{ metricType: 'LEADS', targetValue: 0, stageTargets: [] }],
        };
      });
    });
  }, [targetType, startDate, numberOfMonths]);

  const totalTargetDays = useMemo(
    () =>
      previewTotalTargetDays({
        targetType,
        startDate,
        numberOfMonths,
        manualPeriods:
          targetType === 'MANUAL'
            ? periodsState.map((period) => ({
                startDate: String(period.startDate),
                endDate: String(period.endDate),
              }))
            : undefined,
      }),
    [periodsState, numberOfMonths, startDate, targetType],
  );

  const togglePeriodExpanded = (index: number) => {
    setExpandedPeriods((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const updateManualPeriodBounds = (index: number, patch: Partial<PeriodRow>) => {
    setPeriodsState((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const addManualPeriod = () => {
    setPeriodsState((prev) => {
      const nextIndex = prev.length;
      let nextStartDate = startDate;

      if (prev.length > 0) {
        const lastPeriod = prev[prev.length - 1];
        if (lastPeriod.endDate) {
          const d = new Date(lastPeriod.endDate);
          d.setUTCDate(d.getUTCDate() + 1);
          nextStartDate = d.toISOString().slice(0, 10);
        }
      }

      const next = [...prev, createEmptyManualPeriod(nextIndex, nextStartDate)];
      setExpandedPeriods((exp) => ({ ...exp, [nextIndex]: true }));
      return next;
    });
  };

  const removeManualPeriod = (index: number) => {
    setPeriodsState((prev) => {
      if (prev.length <= 1) {
        toast.error('At least one period is required.');
        return prev;
      }
      const filtered = prev.filter((_, idx) => idx !== index);
      return filtered.map((period, idx) => ({
        ...period,
        periodIndex: idx,
      }));
    });
  };

  const handleToggleMetric = (periodIndex: number, metricType: 'LEADS' | 'REVENUE' | 'FOLLOW_UP' | 'PRODUCTS') => {
    setPeriodsState((prev) => {
      return prev.map((p) => {
        if (p.periodIndex !== periodIndex) return p;
        const exists = p.metrics?.some((m) => m.metricType === metricType);
        let nextMetrics = p.metrics ? [...p.metrics] : [];
        if (exists) {
          nextMetrics = nextMetrics.filter((m) => m.metricType !== metricType);
        } else {
          nextMetrics.push({
            metricType,
            targetValue: metricType === 'REVENUE' ? 1000 : metricType === 'PRODUCTS' ? 0 : 5,
            stageTargets: metricType === 'LEADS' ? [] : null,
            productTargets: metricType === 'PRODUCTS' ? [] : null,
          });
        }
        return { ...p, metrics: nextMetrics };
      });
    });
  };

  const handleUpdateMetricValue = (periodIndex: number, metricType: 'LEADS' | 'REVENUE' | 'FOLLOW_UP' | 'PRODUCTS', value: number) => {
    setPeriodsState((prev) => {
      return prev.map((p) => {
        if (p.periodIndex !== periodIndex) return p;
        const nextMetrics = p.metrics ? p.metrics.map((m) => {
          if (m.metricType !== metricType) return m;
          return { ...m, targetValue: value };
        }) : [];
        return { ...p, metrics: nextMetrics };
      });
    });
  };

  const handleUpdateStageTarget = (periodIndex: number, stageId: string, value: number) => {
    setPeriodsState((prev) => {
      return prev.map((p) => {
        if (p.periodIndex !== periodIndex) return p;
        const nextMetrics = p.metrics ? p.metrics.map((m) => {
          if (m.metricType !== 'LEADS') return m;
          let stageTargets = m.stageTargets ? [...m.stageTargets] : [];
          const exists = stageTargets.some((st) => st.leadStageId === stageId);
          if (value === 0) {
            stageTargets = stageTargets.filter((st) => st.leadStageId !== stageId);
          } else if (exists) {
            stageTargets = stageTargets.map((st) => {
              if (st.leadStageId !== stageId) return st;
              return { ...st, targetValue: value };
            });
          } else {
            stageTargets.push({ leadStageId: stageId, targetValue: value });
          }
          const sum = stageTargets.reduce((acc, st) => acc + st.targetValue, 0);
          return { ...m, targetValue: sum, stageTargets };
        }) : [];
        return { ...p, metrics: nextMetrics };
      });
    });
  };

  const handleUpdateProductTarget = (periodIndex: number, productId: string, value: number) => {
    setPeriodsState((prev) => {
      return prev.map((p) => {
        if (p.periodIndex !== periodIndex) return p;
        const nextMetrics = p.metrics ? p.metrics.map((m) => {
          if (m.metricType !== 'PRODUCTS') return m;
          let productTargets = m.productTargets ? [...m.productTargets] : [];
          const exists = productTargets.some((pt) => pt.productId === productId);
          if (value === 0 && !exists) {
            // Unchecked
          } else if (value === 0 && exists) {
            productTargets = productTargets.filter((pt) => pt.productId !== productId);
          } else if (exists) {
            productTargets = productTargets.map((pt) => {
              if (pt.productId !== productId) return pt;
              return { ...pt, targetValue: value };
            });
          } else {
            productTargets.push({ productId, targetValue: value });
          }
          const sum = productTargets.reduce((acc, pt) => acc + pt.targetValue, 0);
          return { ...m, targetValue: sum, productTargets };
        }) : [];
        return { ...p, metrics: nextMetrics };
      });
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (periodsState.length === 0) {
      toast.error('Add at least one period.');
      return;
    }

    const invalidPeriod = periodsState.find(
      (period) =>
        !period.label?.trim() ||
        !period.startDate ||
        !period.lockingDate ||
        new Date(period.lockingDate) < new Date(period.startDate),
    );

    if (invalidPeriod) {
      toast.error('Each period needs a label, start date, and locking date on or after the start date.');
      return;
    }

    const periodMissingMetrics = periodsState.find(
      (period) => !period.metrics || period.metrics.length === 0,
    );

    if (periodMissingMetrics) {
      toast.error(`Please select at least one metric for period "${periodMissingMetrics.label}".`);
      return;
    }

    // Determine fallback values for backward compatibility
    const firstMetric = periodsState[0]?.metrics?.[0]?.metricType || 'LEADS';
    const firstLeadStage = periodsState[0]?.metrics?.find((m) => m.metricType === 'LEADS')?.stageTargets?.[0]?.leadStageId || null;

    const payload: PerformanceTargetCyclePayload = {
      name: name.trim(),
      description: description.trim() || undefined,
      targetType,
      targetMetric: firstMetric,
      leadStageId: firstLeadStage,
      startDate,
      numberOfMonths: targetType === 'MANUAL' ? undefined : numberOfMonths,
      periods: periodsState.map((period) => ({
        label: period.label,
        periodIndex: period.periodIndex,
        targetCount: period.metrics?.reduce((sum, m) => sum + m.targetValue, 0) || 0,
        startDate: period.startDate,
        endDate: period.endDate,
        lockingDate: period.lockingDate,
        allowSelfUnlock: Boolean(period.allowSelfUnlock),
        selfUnlockGraceDays: period.allowSelfUnlock && period.selfUnlockGraceDays ? Number(period.selfUnlockGraceDays) : null,
        lockSupervisorOnRefailure: period.allowSelfUnlock ? Boolean(period.lockSupervisorOnRefailure) : false,
        enableSupervisorLockChain: period.allowSelfUnlock && period.lockSupervisorOnRefailure ? Boolean(period.enableSupervisorLockChain) : false,
        metrics: period.metrics || [],
      })),
      status,
      lockingEnabled,
    };

    await onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-600">Target Cycle Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-emerald-500"
            placeholder="e.g. Q2 Sales Targets"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-600">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-emerald-500"
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-bold text-gray-600">Description</label>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-emerald-500"
          placeholder="Optional notes for admins"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-600">Target Type</label>
          <select
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as PerformanceTargetCyclePayload['targetType'])}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-emerald-500"
          >
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="SEMI_ANNUAL">Semi Annual</option>
            <option value="MANUAL">Manual</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-600">Start Date</label>
          <input
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-emerald-500"
          />
        </div>
      </div>

      {targetType !== 'MANUAL' && (targetType === 'MONTHLY' || targetType === 'WEEKLY') && (
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-600">Number of Months</label>
          <input
            type="number"
            min={1}
            max={24}
            value={numberOfMonths}
            onChange={(e) => setNumberOfMonths(parseInt(e.target.value, 10) || 1)}
            className="w-full max-w-[160px] rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-emerald-500"
          />
        </div>
      )}

      <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-wider text-emerald-700">Total target days</p>
        <p className="text-lg font-black text-emerald-800">{totalTargetDays}</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-wider text-gray-500">Locking Periods Config</p>
          {targetType === 'MANUAL' && (
            <button
              type="button"
              onClick={addManualPeriod}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Period
            </button>
          )}
        </div>

        <div className="space-y-3">
          {periodsState.map((period, index) => {
            const isExpanded = !!expandedPeriods[period.periodIndex];
            const leadsMetric = period.metrics?.find((m) => m.metricType === 'LEADS');
            const revenueMetric = period.metrics?.find((m) => m.metricType === 'REVENUE');
            const followupMetric = period.metrics?.find((m) => m.metricType === 'FOLLOW_UP');
            const productsMetric = period.metrics?.find((m) => m.metricType === 'PRODUCTS');

            return (
              <div
                key={`period-card-${period.periodIndex}`}
                className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:border-gray-200 transition-colors"
              >
                <div
                  onClick={() => togglePeriodExpanded(period.periodIndex)}
                  className="flex items-center justify-between p-4 cursor-pointer select-none bg-gray-50/40 hover:bg-gray-50/80 transition-colors"
                >
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-gray-900">{period.label}</span>
                    <p className="text-[10px] font-semibold text-gray-500">
                      {period.startDate} to {period.lockingDate}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex flex-wrap gap-1">
                      {leadsMetric && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                          Leads: {leadsMetric.targetValue}
                        </span>
                      )}
                      {revenueMetric && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold">
                          Rev: ${revenueMetric.targetValue}
                        </span>
                      )}
                      {followupMetric && (
                        <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-bold">
                          F-Up: {followupMetric.targetValue}
                        </span>
                      )}
                      {productsMetric && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold">
                          Prod: {productsMetric.targetValue}
                        </span>
                      )}
                      {!period.metrics?.length && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-bold">
                          No Metrics
                        </span>
                      )}
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 border-t border-gray-50 space-y-4 bg-white">
                    {targetType === 'MANUAL' && (
                      <div className="grid gap-3 sm:grid-cols-4 items-end">
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Period Label</label>
                          <input
                            required
                            value={period.label}
                            onChange={(e) => updateManualPeriodBounds(index, { label: e.target.value })}
                            className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-xs focus:outline-emerald-500"
                            placeholder="e.g. Week 1"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Start Date</label>
                          <input
                            type="date"
                            required
                            value={period.startDate}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateManualPeriodBounds(index, {
                                startDate: val,
                                endDate: !period.endDate || new Date(period.endDate) < new Date(val) ? val : period.endDate,
                                lockingDate: !period.lockingDate || new Date(period.lockingDate) < new Date(val) ? val : period.lockingDate,
                              });
                            }}
                            className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-xs focus:outline-emerald-500"
                          />
                        </div>
                        <div className="space-y-1 flex items-center gap-2">
                          <div className="w-full">
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Lock Date</label>
                            <input
                              type="date"
                              required
                              min={period.startDate}
                              value={period.lockingDate}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateManualPeriodBounds(index, {
                                  endDate: val,
                                  lockingDate: val,
                                });
                              }}
                              className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-xs focus:outline-emerald-500"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeManualPeriod(index)}
                            className="h-8 w-8 mt-4 shrink-0 flex items-center justify-center rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                            title="Remove period"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Target Metrics</label>
                      <div className="flex flex-wrap gap-3">
                        <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!leadsMetric}
                            onChange={() => handleToggleMetric(period.periodIndex, 'LEADS')}
                            className="rounded text-emerald-600"
                          />
                          Leads Target
                        </label>
                        <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!revenueMetric}
                            onChange={() => handleToggleMetric(period.periodIndex, 'REVENUE')}
                            className="rounded text-emerald-600"
                          />
                          Revenue Target
                        </label>
                        <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!followupMetric}
                            onChange={() => handleToggleMetric(period.periodIndex, 'FOLLOW_UP')}
                            className="rounded text-emerald-600"
                          />
                          Follow-Up Target
                        </label>
                        <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!productsMetric}
                            onChange={() => handleToggleMetric(period.periodIndex, 'PRODUCTS')}
                            className="rounded text-emerald-600"
                          />
                          Products Target
                        </label>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 pt-2 border-t border-gray-50">
                      {leadsMetric && (
                        <div className="space-y-3 bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-wider text-emerald-800">Leads by Stage</span>
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                              Total: {leadsMetric.targetValue}
                            </span>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2">
                            {nonLobStages.map((stage: { id: string; name: string }) => {
                              const stageTarget = leadsMetric.stageTargets?.find((st) => st.leadStageId === stage.id);
                              const isChecked = !!stageTarget;

                              return (
                                <div
                                  key={stage.id}
                                  className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white border border-gray-100"
                                >
                                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer truncate">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        handleUpdateStageTarget(period.periodIndex, stage.id, e.target.checked ? 5 : 0);
                                      }}
                                      className="rounded text-emerald-600"
                                    />
                                    <span className="truncate">{stage.name}</span>
                                  </label>
                                  {isChecked && (
                                    <input
                                      type="number"
                                      min={1}
                                      value={stageTarget.targetValue}
                                      onChange={(e) => {
                                        handleUpdateStageTarget(
                                          period.periodIndex,
                                          stage.id,
                                          parseInt(e.target.value, 10) || 1,
                                        );
                                      }}
                                      className="w-12 text-center rounded border border-gray-200 px-1 py-0.5 text-xs font-black"
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {(!leadsMetric.stageTargets || leadsMetric.stageTargets.length === 0) && (
                            <p className="text-[10px] text-gray-400 font-medium">Please check at least one stage and set a target.</p>
                          )}
                        </div>
                      )}

                      {productsMetric && (
                        <div className="space-y-3 bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-wider text-emerald-800">Product Targets</span>
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                              Total: {productsMetric.targetValue}
                            </span>
                          </div>

                          {activeProducts.length === 0 ? (
                            <div className="p-4 text-center text-xs text-gray-500 bg-white rounded-lg border border-gray-100 space-y-1">
                              <p className="font-semibold text-gray-700">No products have been created yet.</p>
                              <p className="text-[11px] text-gray-500">
                                Create products from: <span className="font-bold text-emerald-700">Master Configuration → Products</span>
                              </p>
                            </div>
                          ) : (
                            <div className="grid gap-2 sm:grid-cols-2">
                              {activeProducts.map((product: { id: string; name: string }) => {
                                const productTarget = productsMetric.productTargets?.find((pt) => pt.productId === product.id);
                                const isChecked = !!productTarget;

                                return (
                                  <div
                                    key={product.id}
                                    className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white border border-gray-100 hover:border-gray-200 transition-colors"
                                  >
                                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer truncate">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => {
                                          handleUpdateProductTarget(period.periodIndex, product.id, e.target.checked ? 10 : 0);
                                        }}
                                        className="rounded text-emerald-600 focus:ring-emerald-500"
                                      />
                                      <span className="truncate">{product.name}</span>
                                    </label>
                                    {isChecked && (
                                      <input
                                        type="number"
                                        min={0}
                                        value={productTarget.targetValue}
                                        onChange={(e) => {
                                          const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                          handleUpdateProductTarget(
                                            period.periodIndex,
                                            product.id,
                                            val,
                                          );
                                        }}
                                        className="w-16 text-center rounded border border-gray-200 px-1.5 py-0.5 text-xs font-black focus:outline-emerald-500"
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {(revenueMetric || followupMetric) && (
                        <div className="space-y-3 bg-gray-50/50 p-3 rounded-xl border border-gray-100 flex flex-col justify-center">
                          {revenueMetric && (
                            <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase text-blue-800">Revenue Goal ($)</label>
                              <input
                                type="number"
                                min={0}
                                value={revenueMetric.targetValue}
                                onChange={(e) => {
                                  handleUpdateMetricValue(
                                    period.periodIndex,
                                    'REVENUE',
                                    parseInt(e.target.value, 10) || 0,
                                  );
                                }}
                                className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-xs focus:outline-emerald-500 font-bold"
                              />
                            </div>
                          )}
                          {followupMetric && (
                            <div className="space-y-1 mt-2">
                              <label className="text-[10px] font-black uppercase text-purple-800">Follow-Up Goal</label>
                              <input
                                type="number"
                                min={0}
                                value={followupMetric.targetValue}
                                onChange={(e) => {
                                  handleUpdateMetricValue(
                                    period.periodIndex,
                                    'FOLLOW_UP',
                                    parseInt(e.target.value, 10) || 0,
                                  );
                                }}
                                className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-xs focus:outline-emerald-500 font-bold"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Self-Unlock & Escalation Rules Section */}
                    <div className="pt-4 border-t border-gray-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                            <ShieldAlert className="w-4 h-4 text-emerald-600" />
                            Self-Unlock & Escalation Rules
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            Configure period-specific self-unlock policy and supervisor re-lock escalation.
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                        {/* Field 1: Allow User Self-Unlock */}
                        <div className="flex items-start justify-between gap-3 sm:col-span-2 bg-white p-3 rounded-xl border border-slate-100 shadow-xs">
                          <div>
                            <label className="text-xs font-bold text-slate-900 block">Allow User Self-Unlock</label>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Allow users locked for missing this target period to unlock their own account once and receive a limited grace period to complete the target.
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            checked={!!period.allowSelfUnlock}
                            onChange={(e) => {
                              const val = e.target.checked;
                              setPeriodsState((prev) =>
                                prev.map((p) =>
                                  p.periodIndex === period.periodIndex
                                    ? {
                                        ...p,
                                        allowSelfUnlock: val,
                                        selfUnlockGraceDays: val ? (p.selfUnlockGraceDays || 2) : null,
                                        lockSupervisorOnRefailure: val ? p.lockSupervisorOnRefailure : false,
                                        enableSupervisorLockChain: val ? p.enableSupervisorLockChain : false,
                                      }
                                    : p,
                                ),
                              );
                            }}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 mt-1 cursor-pointer"
                          />
                        </div>

                        {period.allowSelfUnlock && (
                          <>
                            {/* Field 2: Self-Unlock Grace Days */}
                            <div className="space-y-1 bg-white p-3 rounded-xl border border-slate-100 shadow-xs">
                              <label className="text-xs font-bold text-slate-900 block">Days Allowed After Self-Unlock</label>
                              <p className="text-[11px] text-slate-500">
                                Number of calendar days (1–365) the user receives after self-unlocking before the target is evaluated again.
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <input
                                  type="number"
                                  min={1}
                                  max={365}
                                  required
                                  value={period.selfUnlockGraceDays ?? 2}
                                  onChange={(e) => {
                                    const val = Math.max(1, Math.min(365, parseInt(e.target.value, 10) || 1));
                                    setPeriodsState((prev) =>
                                      prev.map((p) =>
                                        p.periodIndex === period.periodIndex ? { ...p, selfUnlockGraceDays: val } : p,
                                      ),
                                    );
                                  }}
                                  className="w-28 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold focus:outline-emerald-500"
                                />
                                <span className="text-xs text-slate-600 font-medium">Days</span>
                              </div>
                            </div>

                            {/* Field 3: Lock Supervisor On Re-Failure */}
                            <div className="flex items-start justify-between gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-xs">
                              <div>
                                <label className="text-xs font-bold text-slate-900 block">Lock Supervisor If User Fails Again</label>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  If the user still does not meet the target after the self-unlock grace period, lock the user again and optionally lock the user’s valid supervisor.
                                </p>
                              </div>
                              <input
                                type="checkbox"
                                checked={!!period.lockSupervisorOnRefailure}
                                onChange={(e) => {
                                  const val = e.target.checked;
                                  setPeriodsState((prev) =>
                                    prev.map((p) =>
                                      p.periodIndex === period.periodIndex
                                        ? {
                                            ...p,
                                            lockSupervisorOnRefailure: val,
                                            enableSupervisorLockChain: val ? p.enableSupervisorLockChain : false,
                                          }
                                        : p,
                                    ),
                                  );
                                }}
                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 mt-1 cursor-pointer"
                              />
                            </div>

                            {/* Field 4: Enable Supervisor Lock Chain */}
                            {period.lockSupervisorOnRefailure && (
                              <div className="flex items-start justify-between gap-3 sm:col-span-2 bg-amber-50/70 p-3 rounded-xl border border-amber-200/80">
                                <div>
                                  <label className="text-xs font-bold text-amber-950 block">Continue Locking Through Supervisor Chain</label>
                                  <p className="text-[11px] text-amber-800 mt-0.5">
                                    When enabled, the system may continue locking eligible supervisors upward through the reporting chain, according to configured rules and hierarchy safeguards.
                                  </p>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={!!period.enableSupervisorLockChain}
                                  onChange={(e) => {
                                    const val = e.target.checked;
                                    setPeriodsState((prev) =>
                                      prev.map((p) =>
                                        p.periodIndex === period.periodIndex
                                          ? { ...p, enableSupervisorLockChain: val }
                                          : p,
                                      ),
                                    );
                                  }}
                                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 mt-1 cursor-pointer"
                                />
                              </div>
                            )}

                            {/* Dynamic Workflow Preview */}
                            <div className="sm:col-span-2 bg-emerald-50/90 p-3 rounded-xl border border-emerald-200/90 text-xs text-emerald-900">
                              <span className="font-bold block mb-0.5 text-emerald-950">Workflow Rule Preview:</span>
                              <p>
                                If a user misses this target, they may self-unlock once. They will receive{' '}
                                <strong>{period.selfUnlockGraceDays || 2} days</strong> to complete the target.{' '}
                                {period.lockSupervisorOnRefailure
                                  ? period.enableSupervisorLockChain
                                    ? `If they fail again, both the user and their eligible supervisors up the reporting chain will be locked.`
                                    : `If they fail again, both the user and their eligible supervisor will be locked.`
                                  : `If they fail again, only the user will be locked.`}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
        <input
          type="checkbox"
          checked={lockingEnabled}
          onChange={(e) => setLockingEnabled(e.target.checked)}
          className="rounded text-emerald-500"
        />
        Enable automatic locking when targets are incomplete
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isSubmitting ? 'Saving cycle...' : 'Save cycle'}
        </button>
      </div>
    </form>
  );
};

export default PerformanceTargetCycleForm;
