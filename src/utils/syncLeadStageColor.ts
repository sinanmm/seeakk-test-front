import type { QueryClient } from '@tanstack/react-query';
import type { LeadListItem, LeadMetaOptions, ListLeadsResponse } from '../types/lead.types';
import type { LeadStage, ListLeadStagesResponse } from '../types/leadStage.types';
import useDashboardStore from '../store/useDashboardStore';

export const LEAD_STAGE_UPDATED_EVENT = 'crm:lead-stage-updated';

export type LeadStageColorPatch = {
  id: string;
  name?: string;
  stageShortForm?: string | null;
  showInCalendar?: boolean;
  color?: string;
  isApprovalRequired?: boolean;
  isLOB?: boolean;
  isClosed?: boolean;
  stageOrder?: number;
  status?: 'ACTIVE' | 'INACTIVE';
};

export const toStageColorPatch = (stage: LeadStage): LeadStageColorPatch => ({
  id: stage.id,
  name: stage.name,
  stageShortForm: stage.stageShortForm ?? null,
  showInCalendar: stage.showInCalendar ?? true,
  color: stage.color,
  isApprovalRequired: stage.isApprovalRequired,
  isLOB: stage.isLOB,
  isClosed: stage.isClosed,
  stageOrder: stage.stageOrder,
  status: stage.status,
});

const patchStageOnLead = <T extends { stage?: LeadListItem['stage'] | null; stageId?: string | null }>(
  lead: T,
  patch: LeadStageColorPatch,
): T => {
  if (!lead.stage || lead.stage.id !== patch.id) return lead;

  return {
    ...lead,
    stage: {
      ...lead.stage,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.color !== undefined ? { color: patch.color } : {}),
      ...(patch.isLOB !== undefined ? { isLOB: patch.isLOB } : {}),
      ...(patch.isClosed !== undefined ? { isClosed: patch.isClosed } : {}),
    },
  };
};

const patchStageInListResponse = (
  previous: ListLeadsResponse | undefined,
  patch: LeadStageColorPatch,
): ListLeadsResponse | undefined => {
  if (!previous?.leads?.length) return previous;

  let changed = false;
  const leads = previous.leads.map((lead) => {
    const next = patchStageOnLead(lead, patch);
    if (next !== lead) changed = true;
    return next;
  });

  return changed ? { ...previous, leads } : previous;
};

const patchStageInClosedResponse = (previous: { data?: LeadListItem[] } | undefined, patch: LeadStageColorPatch) => {
  if (!previous?.data?.length) return previous;

  let changed = false;
  const data = previous.data.map((lead) => {
    const next = patchStageOnLead(lead, patch);
    if (next !== lead) changed = true;
    return next;
  });

  return changed ? { ...previous, data } : previous;
};

const resolveCalendarShortLabel = (patch: LeadStageColorPatch, fallbackName: string): string => {
  if (patch.showInCalendar === false) {
    return fallbackName;
  }
  const shortForm = patch.stageShortForm?.trim().toUpperCase();
  if (shortForm) return shortForm;
  return fallbackName;
};

const patchCalendarStageBuckets = (
  buckets:
    | Array<{ stageId: string; count: number; name: string; shortForm?: string; color: string }>
    | undefined,
  patch: LeadStageColorPatch,
) =>
  buckets?.map((item) => {
    if (item.stageId !== patch.id) return item;

    const nextName = patch.name !== undefined ? patch.name : item.name;
    const nextShortForm =
      patch.stageShortForm !== undefined || patch.showInCalendar !== undefined || patch.name !== undefined
        ? resolveCalendarShortLabel(
            {
              ...patch,
              name: nextName,
              stageShortForm: patch.stageShortForm ?? item.shortForm ?? null,
              showInCalendar: patch.showInCalendar ?? true,
            },
            nextName,
          )
        : item.shortForm;

    return {
      ...item,
      name: nextName,
      ...(patch.color !== undefined ? { color: patch.color } : {}),
      ...(nextShortForm !== undefined ? { shortForm: nextShortForm } : {}),
    };
  });

const patchFollowupCalendarPayload = (payload: any, patch: LeadStageColorPatch) => {
  if (!payload || typeof payload !== 'object') return payload;

  const data = payload.data ?? payload;
  if (!data || typeof data !== 'object') return payload;

  const nextData = {
    ...data,
    stageTransitions: patchCalendarStageBuckets(data.stageTransitions, patch),
    stageFollowUps: patchCalendarStageBuckets(data.stageFollowUps, patch),
  };

  if (payload.data) return { ...payload, data: nextData };
  return nextData;
};

const patchRevenueByStage = (metrics: any, patch: LeadStageColorPatch) => {
  if (!metrics?.revenueByStage) return metrics;

  return {
    ...metrics,
    revenueByStage: metrics.revenueByStage.map((stage: { id: string; name: string; color: string; amount: number }) =>
      stage.id === patch.id
        ? {
            ...stage,
            ...(patch.name !== undefined ? { name: patch.name } : {}),
            ...(patch.color !== undefined ? { color: patch.color } : {}),
          }
        : stage,
    ),
  };
};

const findStageNameInLeadStagesCache = (queryClient: QueryClient, stageId: string): string | undefined => {
  const entries = queryClient.getQueriesData<ListLeadStagesResponse>({ queryKey: ['lead-stages'] });
  for (const [, data] of entries) {
    const match = data?.data?.find((stage) => stage.id === stageId);
    if (match?.name) return match.name;
  }
  return undefined;
};

const patchDashboardPipeline = (patch: LeadStageColorPatch, previousName?: string) => {
  const { pipelineData } = useDashboardStore.getState();
  if (!pipelineData.length || !patch.color) return;

  const matchNames = new Set(
    [previousName, patch.name].filter((value): value is string => Boolean(value && value.trim())),
  );
  if (matchNames.size === 0) return;

  useDashboardStore.setState({
    pipelineData: pipelineData.map((item) =>
      matchNames.has(item.name)
        ? {
            ...item,
            color: patch.color as string,
            ...(patch.name ? { name: patch.name } : {}),
          }
        : item,
    ),
  });
};

/** Immediately patch embedded stage snapshots in React Query caches. */
export const syncLeadStageAcrossCaches = (queryClient: QueryClient, patch: LeadStageColorPatch) => {
  if (!patch.id) return;

  const previousName = findStageNameInLeadStagesCache(queryClient, patch.id);

  queryClient.setQueriesData<ListLeadsResponse>({ queryKey: ['leads'] }, (previous) =>
    patchStageInListResponse(previous, patch),
  );

  queryClient.setQueriesData<LeadListItem>({ queryKey: ['lead'] }, (previous) =>
    previous ? patchStageOnLead(previous, patch) : previous,
  );

  queryClient.setQueriesData({ queryKey: ['closed-leads'] }, (previous) =>
    patchStageInClosedResponse(previous as { data?: LeadListItem[] }, patch),
  );

  queryClient.setQueryData<LeadMetaOptions>(['lead-meta'], (previous) => {
    if (!previous?.stages?.length) return previous;

    let changed = false;
    const stages = previous.stages.map((stage) => {
      if (stage.id !== patch.id) return stage;
      changed = true;
      return {
        ...stage,
        ...(patch.name !== undefined ? { label: patch.name } : {}),
        ...(patch.color !== undefined ? { color: patch.color } : {}),
        ...(patch.isLOB !== undefined ? { isLOB: patch.isLOB } : {}),
        ...(patch.isClosed !== undefined ? { isClosed: patch.isClosed } : {}),
      };
    });

    return changed ? { ...previous, stages } : previous;
  });

  queryClient.setQueriesData({ queryKey: ['followups', 'calendar'] }, (previous) =>
    patchFollowupCalendarPayload(previous, patch),
  );

  queryClient.setQueriesData({ queryKey: ['followups', 'advanced-calendar'] }, (previous) =>
    patchFollowupCalendarPayload(previous, patch),
  );

  queryClient.setQueriesData({ queryKey: ['followups', 'advanced-calendar-details'] }, (previous: any) => {
    if (!previous?.items?.length) return previous;

    let changed = false;
    const items = previous.items.map((item: any) => {
      const next = patchStageOnLead(item, patch);
      if (next !== item) changed = true;
      return next;
    });

    return changed ? { ...previous, items } : previous;
  });

  queryClient.setQueriesData({ queryKey: ['dashboard', 'revenue-analytics'] }, (previous: any) => {
    if (!previous?.data?.metrics) return previous;
    return {
      ...previous,
      data: {
        ...previous.data,
        metrics: patchRevenueByStage(previous.data.metrics, patch),
      },
    };
  });

  queryClient.setQueriesData<ListLeadStagesResponse>({ queryKey: ['lead-stages'] }, (previous) => {
    if (!previous?.data?.length) return previous;

    return {
      ...previous,
      data: previous.data.map((stage) =>
        stage.id === patch.id
          ? {
              ...stage,
              ...(patch.name !== undefined ? { name: patch.name } : {}),
              ...(patch.color !== undefined ? { color: patch.color } : {}),
              ...(patch.isApprovalRequired !== undefined
                ? { isApprovalRequired: patch.isApprovalRequired }
                : {}),
              ...(patch.isLOB !== undefined ? { isLOB: patch.isLOB } : {}),
              ...(patch.isClosed !== undefined ? { isClosed: patch.isClosed } : {}),
              ...(patch.stageOrder !== undefined ? { stageOrder: patch.stageOrder } : {}),
              ...(patch.status !== undefined ? { status: patch.status } : {}),
              ...(patch.stageShortForm !== undefined ? { stageShortForm: patch.stageShortForm } : {}),
              ...(patch.showInCalendar !== undefined ? { showInCalendar: patch.showInCalendar } : {}),
            }
          : stage,
      ),
    };
  });

  patchDashboardPipeline(patch, previousName);
};

export const invalidateLeadStageConsumers = (queryClient: QueryClient) => {
  const keys: Array<readonly unknown[]> = [
    ['lead-stages'],
    ['lead-substages'],
    ['grouped-substages'],
    ['leads'],
    ['lead'],
    ['lead-meta'],
    ['closed-leads'],
    ['followups'],
    ['lead-approvals'],
    ['lob-analysis'],
    ['dashboard'],
  ];

  keys.forEach((queryKey) => {
    void queryClient.invalidateQueries({ queryKey });
  });
};

export const notifyLeadStageConsumersUpdated = (patch?: LeadStageColorPatch) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<LeadStageColorPatch | undefined>(LEAD_STAGE_UPDATED_EVENT, { detail: patch }));
  }

  const dashboardState = useDashboardStore.getState();
  if (dashboardState.kpiData.length > 0 || dashboardState.pipelineData.length > 0) {
    void dashboardState.fetchDashboardData();
  }
};
