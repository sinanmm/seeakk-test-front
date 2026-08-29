import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard, Users, Settings, FileText, Calendar as CalendarIcon, Wallet,
    Briefcase, FileBarChart, Table2, Unplug, ChevronDown, Activity, ChevronRight, LogOut, LucideIcon, X
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import useWorkspaceStore from '../../store/useWorkspaceStore';
import { hasAnyPermission, hasPermission, canAccessPendingApproval } from '../../utils/permission.util';
import WorkspaceBrandMenu from './WorkspaceBrandMenu';

interface SubMenuItem {
    label: string;
    path: string;
    requiredPermissions?: string[];
    moduleKey?: string;
}

interface SidebarItem {
    icon: LucideIcon;
    label: string;
    path?: string;
    subItems?: SubMenuItem[];
    requiredPermissions?: string[];
    moduleKey?: string;
}

interface SidebarSection {
    title: string;
    items: SidebarItem[];
}

const sidebarMenus: SidebarSection[] = [
    {
        title: 'MAIN',
        items: [
            { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', moduleKey: 'DASHBOARD' },
            { icon: CalendarIcon, label: 'Attendance', path: '/attendance', requiredPermissions: ['view_attendance', 'mark_attendance'], moduleKey: 'ATTENDANCE' }
        ]
    },
    {
        title: 'MANAGEMENT',
        items: [
            {
                icon: Users, label: 'Admin Management', moduleKey: 'ADMIN_MANAGEMENT',
                subItems: [
                    { label: 'Users', path: '/admin/users', requiredPermissions: ['USERS_VIEW', 'ASSIGNED_USERS_VIEW'] },
                    { label: 'Roles', path: '/admin/roles', requiredPermissions: ['ROLES_VIEW'] },
                    { label: 'Departments', path: '/admin/departments', requiredPermissions: ['DEPARTMENTS_VIEW'] },
                    { label: 'Organization Chart', path: '/admin/organisation-chart', requiredPermissions: ['USERS_VIEW', 'ASSIGNED_USERS_VIEW', 'DEPARTMENTS_VIEW'] },
                    { label: 'Roster Sheet', path: '/admin/roster', requiredPermissions: ['USERS_VIEW', 'ASSIGNED_USERS_VIEW', 'SYSTEM_CONFIG'] },
                    {
                        label: 'Location Tracker',
                        path: '/location-tracker',
                        requiredPermissions: [
                            'LOCATION_TRACKING_VIEW_LIVE',
                            'LOCATION_TRACKING_VIEW_HISTORY',
                            'LOCATION_TRACKING_REPLAY',
                            'LOCATION_TRACKING_VIEW_ALL',
                            'LOCATION_TRACKING_VIEW_ASSIGNED',
                            'SYSTEM_CONFIG'
                        ]
                    },
                    { label: 'Offices', path: '/admin/offices', requiredPermissions: ['SYSTEM_CONFIG'] }
                ]
            },
            {
                icon: Wallet, label: 'Salary Management', moduleKey: 'SALARY_MANAGEMENT',
                subItems: [
                    { label: 'Salary Calculation', path: '/salary/calculation', requiredPermissions: ['SALARY_CALCULATION_VIEW', 'SALARY_CALCULATION_GENERATE'] },
                    { label: 'Approval Stages', path: '/salary/stages', requiredPermissions: ['SALARY_STAGES_VIEW', 'SALARY_STAGES_CREATE', 'SALARY_STAGES_EDIT'] },
                    { label: 'Pending Approvals', path: '/salary/approvals', requiredPermissions: ['SALARY_APPROVALS_VIEW', 'SALARY_APPROVALS_APPROVE'] }
                ]
            },
            {
                icon: Settings, label: 'Master Configuration', moduleKey: 'MASTER_CONFIGURATION',
                subItems: [
                    { label: 'Lead Sources', path: '/admin/lead-source', requiredPermissions: ['LEAD_SOURCES_VIEW', 'SYSTEM_CONFIG'] },
                    { label: 'Products', path: '/admin/products', requiredPermissions: ['PRODUCTS_VIEW', 'SYSTEM_CONFIG'] },
                    { label: 'Lead Stages', path: '/admin/lead-stages', requiredPermissions: ['LEAD_STAGES_VIEW', 'SYSTEM_CONFIG'] },
                    { label: 'Stage Rules', path: '/admin/stage-rules', requiredPermissions: ['LEAD_STAGE_RULES_VIEW', 'SYSTEM_CONFIG'] },
                    { label: 'Target Cycles', path: '/admin/target-cycles', requiredPermissions: ['TARGET_CYCLES_VIEW', 'SYSTEM_CONFIG'] },
                    { label: 'Lead Dynamic Forms', path: '/admin/lead-dynamics', requiredPermissions: ['LEAD_DYNAMICS_VIEW', 'SYSTEM_CONFIG'] },
                    { label: 'Lead Life Cycle', path: '/admin/lead-life-cycles', requiredPermissions: ['SYSTEM_CONFIG'] },
                    { label: 'Calendar', path: '/calendar', requiredPermissions: ['LEADS_VIEW_ALL', 'LEADS_VIEW_OWN', 'LEADS_VIEW_TEAM', 'SYSTEM_CONFIG'] },
                    { label: 'Holiday List', path: '/admin/holidays', requiredPermissions: ['SYSTEM_CONFIG'] },
                    { label: 'LOB Reasons', path: '/admin/lob-reasons', requiredPermissions: ['LOB_REASONS_VIEW', 'LOB_REASONS_CREATE', 'Create LOB Reasons', 'SYSTEM_CONFIG'] },
                    { label: 'Follow-Up Extension Reasons', path: '/admin/followup-extension-reasons', requiredPermissions: ['view_followup_extension_reasons', 'SYSTEM_CONFIG'] }
                ]
            }
        ]
    },
    {
        title: 'LEADS & REPORTS',
        items: [
            {
                icon: Briefcase, label: 'Leads', moduleKey: 'LEADS',
                subItems: [
                    { label: 'All Leads', path: '/leads', requiredPermissions: ['LEADS_VIEW_ALL', 'LEADS_VIEW_OWN', 'LEADS_VIEW_TEAM', 'LEADS_CREATE'] },
                    { label: 'Closed Leads', path: '/leads/closed', requiredPermissions: ['LEADS_CLOSE', 'LEADS_REOPEN', 'LEADS_VIEW_ALL', 'LEADS_VIEW_OWN', 'LEADS_VIEW_TEAM'] },
                    { label: 'Bulk Assign', path: '/leads/bulk-assign', requiredPermissions: ['LEADS_BULK_ASSIGN', 'LEADS_ASSIGN'] },
                    { label: 'Pending Approval', path: '/leads/pending-approval', requiredPermissions: ['LEAD_APPROVAL_VIEW'] },
                    {
                      label: 'Follow-Up Settings',
                      path: '/leads/settings',
                      requiredPermissions: ['manage_followup_settings', 'view_followup_capacity', 'bulk_extend_followups'],
                    },
                ]
            },
            {
                icon: FileText, label: 'Reports', path: '/reports', requiredPermissions: ['REPORTS_VIEW', 'REPORTS_GENERATE'], moduleKey: 'REPORTS'
            },
            { icon: Table2, label: 'Sheets', path: '/sheets', requiredPermissions: ['SHEETS_VIEW'], moduleKey: 'SHEETS' },
            { icon: FileBarChart, label: 'LOB Analysis', path: '/lob-analysis', requiredPermissions: ['LOB_ANALYSIS_VIEW'], moduleKey: 'LOB_ANALYSIS' }
        ]
    },
    {
        title: 'SYSTEM',
        items: [
            { icon: Unplug, label: 'Unlock Staff', path: '/unlock-staff', requiredPermissions: ['USERS_UNLOCK', 'USERS_EDIT', 'SYSTEM_CONFIG'], moduleKey: 'UNLOCK_STAFF' },
            {
                icon: Settings, label: 'Settings',
                subItems: [
                    { label: 'Meta Ads', path: '/admin/meta-ads', requiredPermissions: ['LEAD_SOURCES_VIEW', 'SYSTEM_CONFIG'], moduleKey: 'META_ADS' },
                    { label: 'Telephony', path: '/admin/telephony', requiredPermissions: ['SYSTEM_CONFIG'], moduleKey: 'TELEPHONY' },
                    { label: 'WhatsApp Templates', path: '/settings/whatsapp-templates', requiredPermissions: ['WHATSAPP_TEMPLATES_VIEW', 'SYSTEM_CONFIG', 'manage_followup_settings', 'LEADS_VIEW_ALL', 'LEADS_VIEW_OWN', 'LEADS_VIEW_TEAM'], moduleKey: 'WHATSAPP_TEMPLATES' },
                    { label: 'Automations', path: '/settings/automations', requiredPermissions: ['AUTOMATION_VIEW', 'SYSTEM_CONFIG'], moduleKey: 'AUTOMATIONS' },
                ]
            }
        ]
    }
];

interface MenuItemProps {
    item: SidebarItem;
    isCollapsed: boolean;
    isActive: boolean;
    setActiveMenu: (label: string | null) => void;
    activeMenu: string | null;
    toggleCollapsed?: () => void;
    onNavigate?: () => void;
}

const MenuItem: React.FC<MenuItemProps> = ({ item, isCollapsed, isActive, setActiveMenu, activeMenu, toggleCollapsed, onNavigate }) => {
    const isExpanded = activeMenu === item.label;
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const navigate = useNavigate();
    const location = useLocation();

    const selected = isActive || (!isCollapsed && isExpanded);

    const handleClick = () => {
        if (item.path) {
            navigate(item.path);
            setActiveMenu(null);
            onNavigate?.();
        } else if (hasSubItems) {
            setActiveMenu(isExpanded ? null : item.label);
            if (isCollapsed && toggleCollapsed) {
                toggleCollapsed();
            }
        }
    };

    return (
        <div className="mb-1">
            <button
                onClick={handleClick}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0 py-3' : 'justify-between px-3 py-2.5'
                    } rounded-xl transition-all duration-200 group ${selected
                        ? 'bg-emerald-50 text-emerald-600 font-semibold'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 font-medium'
                    }`}
            >
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                    <item.icon size={20} className={`${selected ? 'text-emerald-500' : 'text-gray-400 group-hover:text-emerald-500'} transition-colors duration-200`} />
                    {!isCollapsed && (
                        <span className="text-sm tracking-wide">{item.label}</span>
                    )}
                </div>
                {!isCollapsed && hasSubItems && (
                    <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                )}

                {selected && !isCollapsed && !hasSubItems && (
                    <motion.div layoutId="sidebar-active" className="absolute left-0 w-1 h-6 bg-emerald-500 rounded-r-full" />
                )}
            </button>

            {/* Submenu */}
            <AnimatePresence>
                {!isCollapsed && hasSubItems && isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="pl-9 pr-2 py-1 space-y-1 overflow-hidden"
                    >
                        {item.subItems?.map((sub, idx) => {
                            const isSubActive =
                                location.pathname === sub.path ||
                                (sub.path === '/settings/automations' && location.pathname.startsWith('/settings/automations')) ||
                                (sub.path === '/admin/meta-ads' && location.pathname === '/settings/meta-ads') ||
                                (sub.path === '/admin/telephony' && location.pathname === '/settings/telephony');
                            return (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        navigate(sub.path);
                                        onNavigate?.();
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-all ${isSubActive
                                            ? 'bg-emerald-500 text-white font-bold shadow-xs'
                                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/80 font-medium'
                                        }`}
                                >
                                    <span>{sub.label}</span>
                                    {isSubActive && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                                </button>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

interface DashboardSidebarProps {
    isCollapsed: boolean;
    toggleCollapsed: () => void;
    isMobile?: boolean;
    onNavigate?: () => void;
}

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({ isCollapsed, toggleCollapsed, isMobile = false, onNavigate }) => {
    const [activeMenu, setActiveMenu] = useState<string | null>('Dashboard');
    const location = useLocation();
    const navigate = useNavigate();
    const logout = useAuthStore((state) => state.logout);
    const user = useAuthStore((state) => state.user);
    const hasModule = useWorkspaceStore((state) => state.hasModule);

    React.useEffect(() => {
        for (const section of sidebarMenus) {
            for (const item of section.items) {
                if (item.subItems?.some((sub) => sub.path === location.pathname || (sub.path === '/settings/automations' && location.pathname.startsWith('/settings/automations')) || (sub.path === '/admin/meta-ads' && location.pathname === '/settings/meta-ads') || (sub.path === '/admin/telephony' && location.pathname === '/settings/telephony'))) {
                    setActiveMenu(item.label);
                    return;
                }
            }
        }
    }, [location.pathname]);

    const handleLogout = () => {
        logout();
        navigate('/login');
        onNavigate?.();
    };

    const visibleSections = sidebarMenus
        .map((section) => ({
            ...section,
            items: section.items
                .map((item) => {
                    // Check top-level item module entitlement
                    if (item.moduleKey && !hasModule(item.moduleKey)) {
                        return null;
                    }

                    if (item.subItems?.length) {
                        const visibleSubItems = item.subItems.filter(
                            (subItem) => {
                                // Check sub-item module entitlement
                                if (subItem.moduleKey && !hasModule(subItem.moduleKey)) {
                                    return false;
                                }

                                if (subItem.path === '/leads/pending-approval') {
                                    return canAccessPendingApproval(user?.permissions || []);
                                }
                                return !subItem.requiredPermissions ||
                                    hasAnyPermission(user?.permissions || [], subItem.requiredPermissions);
                            }
                        );

                        if (visibleSubItems.length === 0) return null;

                        return {
                            ...item,
                            subItems: visibleSubItems,
                        };
                    }

                    if (item.requiredPermissions && !hasAnyPermission(user?.permissions || [], item.requiredPermissions)) {
                        return null;
                    }

                    return item;
                })
                .filter(Boolean) as SidebarItem[],
        }))
        .filter((section) => section.items.length > 0);

    return (
        <motion.aside
            id={isMobile ? 'mobile-dashboard-sidebar' : undefined}
            initial={false}
            animate={{ width: isMobile ? 320 : isCollapsed ? 80 : 280 }}
            className={`h-screen bg-white border-r border-gray-200 flex flex-col relative z-20 shrink-0 select-none ${
                isMobile ? 'flex w-[85vw] max-w-[320px] shadow-2xl' : 'hidden md:flex'
            }`}
        >
            {/* Workspace Branding */}
            <div className={`relative h-20 flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} border-b border-gray-100 shrink-0`}>
                <WorkspaceBrandMenu isCollapsed={isCollapsed} isMobile={isMobile} />
                {isMobile && !isCollapsed && (
                    <button
                        type="button"
                        onClick={onNavigate ?? toggleCollapsed}
                        aria-label="Close navigation menu"
                        className="ml-auto p-2 text-gray-500 hover:text-gray-900 rounded-lg"
                    >
                        <X size={20} />
                    </button>
                )}
            </div>

            {/* Menu Items */}
            <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6 custom-scrollbar">
                {visibleSections.map((section, idx) => (
                    <div key={idx}>
                        {!isCollapsed && (
                            <h3 className="px-3 text-[10px] font-bold text-gray-400 tracking-wider mb-2 uppercase">
                                {section.title}
                            </h3>
                        )}
                        <div className="space-y-1">
                            {section.items.map((item, itemIdx) => {
                                const isItemActive =
                                    item.path === location.pathname ||
                                    Boolean(item.subItems?.some((sub) => sub.path === location.pathname || (sub.path === '/settings/automations' && location.pathname.startsWith('/settings/automations')) || (sub.path === '/admin/meta-ads' && location.pathname === '/settings/meta-ads') || (sub.path === '/admin/telephony' && location.pathname === '/settings/telephony')));
                                return (
                                    <MenuItem
                                        key={itemIdx}
                                        item={item}
                                        isCollapsed={isCollapsed}
                                        isActive={isItemActive}
                                        setActiveMenu={setActiveMenu}
                                        activeMenu={activeMenu}
                                        toggleCollapsed={toggleCollapsed}
                                        onNavigate={onNavigate}
                                    />
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* User Footer Profile & Actions */}
            <div className="p-3 border-t border-gray-100 bg-gray-50/50">
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} p-2 rounded-xl bg-white border border-gray-100 shadow-xs`}>
                    <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                        <div className="w-9 h-9 rounded-lg bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">
                            {user?.name?.[0]?.toUpperCase() || 'U'}
                        </div>
                        {!isCollapsed && (
                            <div className="flex flex-col min-w-0 pr-2">
                                <span className="text-sm font-semibold text-gray-800 truncate">{user?.name || 'User'}</span>
                                <span className="text-xs text-gray-400 truncate capitalize">{user?.role?.name || 'Member'}</span>
                            </div>
                        )}
                    </div>

                    {!isCollapsed && (
                        <button
                            onClick={handleLogout}
                            title="Sign Out"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                        >
                            <LogOut size={16} />
                        </button>
                    )}
                </div>
            </div>
        </motion.aside>
    );
};

export default DashboardSidebar;
