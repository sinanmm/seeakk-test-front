import { create } from 'zustand';
import api from '../services/api';

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

  fetchWorkspaceConfig: () => Promise<void>;
  setWorkspaceConfig: (config: {
    currencyLocale?: string;
    timeZone?: string;
    language?: string;
    companyName?: string | null;
    logoUrl?: string | null;
    employeeCount?: string | null;
    billingStatus?: string | null;
    loadSampleData?: boolean;
  }) => void;
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

  fetchWorkspaceConfig: async () => {
    // Only fetch if not already loaded or loading
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

  setWorkspaceConfig: (config) => {
    set((state) => ({
      ...state,
      ...config,
      isLoaded: true,
    }));
  },
}));

export default useWorkspaceStore;
