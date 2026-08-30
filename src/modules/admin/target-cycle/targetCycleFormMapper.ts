import { format } from 'date-fns';
import type { PerformanceTargetCyclePayload } from './PerformanceTargetCycleForm';
import type { TargetCycle, TargetCyclePeriod } from './types';

const toDateInput = (value?: Date | string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return format(date, 'yyyy-MM-dd');
};

export const mapTargetCycleToFormInitial = (
  cycle: TargetCycle,
): Partial<PerformanceTargetCyclePayload> & { id?: string } => {
  const targetType = (cycle.targetType || 'MONTHLY') as PerformanceTargetCyclePayload['targetType'];
  const periods = (cycle.periods || []) as TargetCyclePeriod[];

  const base: Partial<PerformanceTargetCyclePayload> & { id?: string } = {
    id: cycle.id,
    name: cycle.name,
    description: cycle.description || '',
    targetType,
    targetMetric: (cycle.targetMetric || 'LEADS') as PerformanceTargetCyclePayload['targetMetric'],
    leadStageId: cycle.leadStageId || cycle.leadStage?.id || '',
    startDate: toDateInput(cycle.startDate) || format(new Date(), 'yyyy-MM-dd'),
    numberOfMonths: cycle.numberOfMonths ?? (targetType === 'SEMI_ANNUAL' ? 6 : 6),
    status: cycle.status,
    lockingEnabled: cycle.lockingEnabled !== false,
  };

  if (periods.length) {
    return {
      ...base,
      periods: periods.map((period) => ({
        label: period.label,
        periodIndex: period.periodIndex,
        targetCount: period.targetCount,
        startDate: toDateInput(period.startDate),
        endDate: toDateInput(period.endDate),
        lockingDate: toDateInput(period.lockingDate),
        allowSelfUnlock: Boolean(period.allowSelfUnlock),
        selfUnlockGraceDays: period.allowSelfUnlock && period.selfUnlockGraceDays ? Number(period.selfUnlockGraceDays) : null,
        lockSupervisorOnRefailure: period.allowSelfUnlock ? Boolean(period.lockSupervisorOnRefailure) : false,
        enableSupervisorLockChain: period.allowSelfUnlock && period.lockSupervisorOnRefailure ? Boolean(period.enableSupervisorLockChain) : false,
        metrics: period.metrics ? period.metrics.map((metric) => ({
          metricType: metric.metricType,
          targetValue: metric.targetValue,
          stageTargets: metric.stageTargets ? metric.stageTargets.map((st) => ({
            leadStageId: st.leadStageId,
            targetValue: st.targetValue,
          })) : null,
          productTargets: metric.productTargets ? metric.productTargets.map((pt) => ({
            productId: pt.productId,
            targetValue: pt.targetValue,
          })) : null,
        })) : null,
      })),
      periodCounts: periods
        .slice()
        .sort((a, b) => a.periodIndex - b.periodIndex)
        .map((period) => period.targetCount),
    };
  }

  return base;
};
