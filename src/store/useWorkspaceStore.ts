import { create } from 'zustand';
import api from '../services/api';

export interface PlanInfo {
  id: string;
  code: string;
  name: string;
  pricePerUserMonth?: number;
  currency?: string;
}

export interface WorkspaceConfigState {
  currencyLocale: string;
  timeZone: string;
  language: string;
  companyName: string | null;
  logoUrl: string | null;
  employeeCount: string | null;
  billingStatus: string | null;
  loadSampleData: boolean;
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;

  // Plan & Entitlements
  activePlan: PlanInfo | null;
  enabledModules: string[];
  entitlementsLoaded: boolean;

  fetchWorkspaceConfig: () => Promise<void>;
  fetchEntitlements: () => Promise<void>;
  setWorkspaceConfig: (config: Partial<WorkspaceConfigState>) => void;
  hasModule: (moduleKey: string) => boolean;
}

const DEFAULT_CURRENCY = 'USD';
const DEFAULT_TIMEZONE = 'UTC';
const DEFAULT_LANGUAGE = 'en-US';

export const useWorkspaceStore = create<WorkspaceConfigState>((set, get) => ({
  currencyLocale: DEFAULT_CURRENCY,
  timeZone: DEFAULT_TIMEZONE,
  language: DEFAULT_LANGUAGE,
  companyName: null,
  logoUrl: null,
  employeeCount: null,
  billingStatus: null,
  loadSampleData: false,
  isLoaded: false,
  isLoading: false,
  error: null,

  activePlan: null,
  enabledModules: [],
  entitlementsLoaded: false,

  fetchWorkspaceConfig: async () => {
    if (get().isLoaded || get().isLoading) return;

    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/workspace/config-meta');
      const { defaults, workspace } = response.data || {};

      const currencyLocale =
        workspace?.currencyLocale || defaults?.currencyLocale || DEFAULT_CURRENCY;
      const timeZone = workspace?.timeZone || defaults?.timeZone || DEFAULT_TIMEZONE;
      const language = workspace?.language || defaults?.language || DEFAULT_LANGUAGE;
      const companyName = workspace?.companyName || null;
      const logoUrl = workspace?.logoUrl || null;
      const employeeCount = workspace?.employeeCount || null;
      const billingStatus = workspace?.billingStatus || null;
      const loadSampleData = Boolean(workspace?.loadSampleData);

      set({
        currencyLocale,
        timeZone,
        language,
        companyName,
        logoUrl,
        employeeCount,
        billingStatus,
        loadSampleData,
        isLoaded: true,
        isLoading: false,
        error: null,
      });

      // Also trigger entitlements fetch in background
      get().fetchEntitlements().catch(() => {});
    } catch (err: any) {
      console.warn('[WorkspaceStore] Failed to load workspace configuration; using safe defaults.', err?.message);
      set({
        currencyLocale: DEFAULT_CURRENCY,
        timeZone: DEFAULT_TIMEZONE,
        language: DEFAULT_LANGUAGE,
        isLoaded: true,
        isLoading: false,
        error: err?.message || 'Failed to load workspace config',
      });
    }
  },

  fetchEntitlements: async () => {
    try {
      const res = await api.get('/subscription/entitlements');
      if (res.data?.success) {
        set({
          activePlan: res.data.plan || null,
          enabledModules: Array.isArray(res.data.enabledModules) ? res.data.enabledModules : [],
          entitlementsLoaded: true,
        });
      }
    } catch (err: any) {
      // Non-blocking fallback: if endpoint errors, keep empty or legacy mode
      console.warn('[WorkspaceStore] Failed to fetch subscription entitlements:', err?.message);
    }
  },

  hasModule: (moduleKey: string) => {
    const state = get();
    // If entitlements not loaded or empty (legacy unmanaged), allow access
    if (!state.entitlementsLoaded || state.enabledModules.length === 0) {
      return true;
    }
    return state.enabledModules.includes(moduleKey);
  },

  setWorkspaceConfig: (config) => {
    set((state) => ({
      ...state,
      ...config,
      isLoaded: true,
    }));
  },
}));

export default useWorkspaceStore;
