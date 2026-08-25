import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';
import useAuthStore from '../store/useAuthStore';
import api from '../services/api';

import WorkspaceSidebar from '../components/WorkspaceSidebar';
import WorkspaceForm from '../components/WorkspaceForm';

export interface WorkspaceFormData {
    companyName: string;
    logoUrl: string;
    employeeCount: string;
    timeZone: string;
    language: string;
    currencyLocale: string;
    loadSampleData: boolean;
    requestedUsers: number;
    requestedMonths: number;
}

export interface WorkspaceMetaLists {
    timeZones: string[];
    languages: { code: string; name: string }[];
    currencies: { code: string; name: string }[];
    billing?: { pricePerUserPerMonth: number; currency: string };
}

const WorkspaceSetup = () => {
    const { user, updateUser } = useAuthStore();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [metaLists, setMetaLists] = useState<WorkspaceMetaLists>({ timeZones: [], languages: [], currencies: [] });

    const [formData, setFormData] = useState<WorkspaceFormData>({
        companyName: '',
        logoUrl: '',
        employeeCount: '',
        timeZone: '',
        language: '',
        currencyLocale: '',
        loadSampleData: true,
        requestedUsers: 1,
        requestedMonths: 1
    });

    const normalizeRoleKey = (value?: string | null): string =>
        (value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');

    useEffect(() => {
        const fetchMeta = async () => {
            console.log('[DEBUG] Loading Workspace Configuration');
            try {
                console.log('[DEBUG] Workspace Config Request Started');
                const response = await api.get('/workspace/config-meta');
                console.log('[DEBUG] Workspace Config Response Received', response.data);
                const { lists, defaults, billing } = response.data;

                setMetaLists({ ...lists, billing });

                setFormData(prev => ({
                    ...prev,
                    timeZone: defaults.timeZone || 'UTC',
                    language: defaults.language || 'en-US',
                    currencyLocale: defaults.currencyLocale || 'USD'
                }));
                console.log('[DEBUG] Workspace Config Loaded Successfully');
            } catch (err) {
                console.error('[DEBUG] Workspace Config Failed', err);
                toast.error("Failed to load global configurations.");
            }
        };

        fetchMeta();
    }, []);

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string; value: any } }) => {
        if ('nativeEvent' in e) {
            const target = e.target as HTMLInputElement;
            const { name, value, type, checked } = target;
            setFormData(prev => ({
                ...prev,
                [name]: type === 'checkbox' ? checked : value
            }));
        } else {
            const { name, value } = e.target;
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (!formData.companyName.trim() || !formData.employeeCount) {
            toast.error("Company Name and Employee Count are required.", {
                icon: '🏢',
            });
            return;
        }

        if (formData.requestedUsers <= 0 || formData.requestedMonths <= 0) {
            toast.error("Number of users and months must be at least 1.");
            return;
        }

        setLoading(true);
        const toastId = toast.loading('Configuring your workspace...');
        try {
            const response = await api.post('/workspace/setup', formData);
            const roleName = response.data.user?.role?.name || '';
            const permissionsFromApi = Array.isArray(response.data.user?.permissions)
                ? response.data.user.permissions.map((permission: unknown) => String(permission))
                : [];
            const permissions =
                normalizeRoleKey(roleName) === 'superadmin'
                    ? Array.from(new Set([...permissionsFromApi, 'SUPERADMIN']))
                    : permissionsFromApi;
            // Update global state without needing to relogin
            updateUser({
                isOnboarded: true,
                workspaceId: response.data.workspace?.id || response.data.workspace?._id,
                role: response.data.user?.role || null,
                permissions,
                workspace: response.data.workspace
                    ? {
                        id: response.data.workspace.id,
                        companyName: response.data.workspace.companyName,
                        logoUrl: response.data.workspace.logoUrl || null,
                    }
                    : null,
            });
            toast.success("Workspace perfectly configured!", { id: toastId });
            navigate('/dashboard', { replace: true });
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to configure workspace", { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">

            {/* Top Left Navigation - Back to Landing Page */}
            <div className="absolute top-4 left-4 sm:top-6 sm:left-6 lg:top-8 lg:left-10 z-20">
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white/90 hover:bg-white border border-gray-200/80 rounded-full text-xs font-bold text-gray-700 hover:text-emerald-600 shadow-sm hover:shadow-md backdrop-blur-sm transition-all duration-200 group active:scale-95"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform text-gray-500 group-hover:text-emerald-600" />
                    <span>Back to Landing</span>
                </Link>
            </div>

            {/* Top Right User Badge */}
            <div className="absolute top-6 right-6 lg:top-8 lg:right-10 bg-white rounded-full pl-2 pr-4 py-1.5 shadow-sm border border-gray-100 flex items-center gap-3 hidden sm:flex">
                <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-500 flex items-center justify-center text-emerald-600 font-bold overflow-hidden">
                        {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                </div>
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-900 leading-none mb-1">{user?.name || 'User Profile'}</span>
                    <span className="text-[10px] text-gray-500 leading-none">{user?.email || 'admin@company.com'}</span>
                </div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="w-full max-w-[1000px] bg-white rounded-[24px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-gray-100 flex flex-col md:flex-row overflow-hidden relative z-10"
            >
                <WorkspaceSidebar user={user} />
                <WorkspaceForm
                    formData={formData}
                    handleChange={handleChange}
                    setFormData={setFormData}
                    handleSubmit={handleSubmit}
                    loading={loading}
                    lists={metaLists}
                />
            </motion.div>

            {/* Footer Links */}
            <div className="mt-8 text-xs font-bold font-mono text-gray-400 flex gap-4 uppercase tracking-wider relative z-10">
                <a href="#" className="hover:text-gray-600 transition-colors">Terms of Service</a>
                <a href="#" className="hover:text-gray-600 transition-colors">Privacy Policy</a>
                <a href="#" className="hover:text-gray-600 transition-colors">Help Center</a>
            </div>

            {/* Tailwind Wave Animation Class Injection */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes wave {
                    0% { transform: rotate( 0.0deg) }
                    10% { transform: rotate(14.0deg) }  
                    20% { transform: rotate(-8.0deg) }
                    30% { transform: rotate(14.0deg) }
                    40% { transform: rotate(-4.0deg) }
                    50% { transform: rotate(10.0deg) }
                    60% { transform: rotate( 0.0deg) }  
                    100% { transform: rotate( 0.0deg) }
                }
                .animate-wave {
                    animation: wave 2.5s infinite;
                    transform-origin: 70% 70%;
                }
            `}} />
        </div>
    );
};

export default WorkspaceSetup;
