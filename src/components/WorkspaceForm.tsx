import React, { ChangeEvent, FormEvent } from 'react';
import { X, ImagePlus, Building2, Users, Globe2, Languages, Coins, Loader2, ChevronRight, CheckCircle2, Sparkles, Calendar, Calculator, LucideIcon } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { WorkspaceFormData, WorkspaceMetaLists } from '../pages/WorkspaceSetup';
import BrandLogo from './BrandLogo';

interface InputWrapperProps {
    label: string;
    icon?: LucideIcon;
    children: React.ReactNode;
}

const InputWrapper: React.FC<InputWrapperProps> = ({ label, icon: Icon, children }) => (
    <div className="mb-5">
        <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 mb-2">
            {Icon && <Icon size={16} className="text-gray-400" />}
            {label}
        </label>
        {children}
    </div>
);

interface WorkspaceFormProps {
    formData: WorkspaceFormData;
    handleChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string; value: any } }) => void;
    setFormData: React.Dispatch<React.SetStateAction<WorkspaceFormData>>;
    handleSubmit: (e: FormEvent) => void;
    loading: boolean;
    lists: WorkspaceMetaLists;
}

const WorkspaceForm: React.FC<WorkspaceFormProps> = ({ formData, handleChange, setFormData, handleSubmit, loading, lists }) => {

    const timeZones = lists?.timeZones || [];
    const languages = lists?.languages || [];
    const currencies = lists?.currencies || [];

    const timeZoneOptions = timeZones.map(tz => ({ value: tz, label: tz.replace(/_/g, ' ') }));
    const languageOptions = languages.map(lng => ({ value: lng.code, label: (lng as any).label || (lng as any).name }));
    const currencyOptions = currencies.map(cur => ({ value: cur.code, label: (cur as any).label || (cur as any).name }));

    const handleLogoSelect = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            event.target.value = '';
            return;
        }

        const maxBytes = 1024 * 1024; // 1MB raw file keeps data URL reasonably small
        if (file.size > maxBytes) {
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const result = typeof reader.result === 'string' ? reader.result : '';
            setFormData(prev => ({ ...prev, logoUrl: result }));
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="md:w-[58%] p-8 sm:p-12 pl-8 sm:pl-14 flex flex-col justify-center bg-white relative">

            {/* Mobile Brand Logo (Visible only on small screens) */}
            <div className="flex justify-end mb-6 md:hidden">
                <BrandLogo alt="Seeakk" className="flex-shrink-0" />
            </div>

            <h1 className="text-2xl font-black text-gray-900 mb-2">Configure Your Workspace</h1>
            <p className="text-gray-500 text-sm mb-8 font-medium">Tailor your Seeakk experience by providing a few details about your team.</p>

            <form onSubmit={handleSubmit} className="w-full max-w-[460px]">
                <InputWrapper label="Company Name" icon={Building2}>
                    <input
                        type="text"
                        name="companyName"
                        value={formData.companyName}
                        onChange={handleChange}
                        placeholder="e.g. Acme Corporation"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-gray-400 font-medium"
                        required
                    />
                </InputWrapper>

                <InputWrapper label="Company Logo" icon={ImagePlus}>
                    <div className="flex items-center gap-3">
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoSelect}
                            className="block w-full text-xs font-medium text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:font-bold file:text-emerald-700 hover:file:bg-emerald-100"
                        />
                        {formData.logoUrl ? (
                            <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, logoUrl: '' }))}
                                className="h-8 w-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 inline-flex items-center justify-center"
                                title="Remove logo"
                            >
                                <X size={14} />
                            </button>
                        ) : null}
                    </div>
                    {formData.logoUrl ? (
                        <div className="mt-2 h-14 w-14 overflow-hidden rounded-xl border border-gray-200 bg-white">
                            <img src={formData.logoUrl} alt="Company logo preview" className="h-full w-full object-contain" />
                        </div>
                    ) : (
                        <p className="mt-1 text-[11px] font-semibold text-gray-400">Optional. PNG/JPG/WebP up to 1MB.</p>
                    )}
                </InputWrapper>

                <InputWrapper label="Employee Count" icon={Users}>
                    <select
                        name="employeeCount"
                        value={formData.employeeCount}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none font-medium"
                        required
                    >
                        <option value="" disabled>How many people are in your team?</option>
                        <option value="1-10">1 - 10 employees</option>
                        <option value="11-50">11 - 50 employees</option>
                        <option value="51-200">51 - 200 employees</option>
                        <option value="201-500">201 - 500 employees</option>
                        <option value="500+">500+ employees</option>
                    </select>
                </InputWrapper>

                <InputWrapper label="Time Zone (IANA)" icon={Globe2}>
                    <SearchableSelect
                        name="timeZone"
                        options={timeZoneOptions}
                        value={formData.timeZone}
                        onChange={handleChange}
                        placeholder="Search for a time zone..."
                    />
                </InputWrapper>

                <div className="flex flex-col sm:flex-row gap-4 mb-2">
                    <div className="flex-1 min-w-0">
                        <InputWrapper label="Language (ISO-639)" icon={Languages}>
                            <SearchableSelect
                                name="language"
                                options={languageOptions}
                                value={formData.language}
                                onChange={handleChange}
                                placeholder="Search language..."
                            />
                        </InputWrapper>
                    </div>
                    <div className="flex-1 min-w-0">
                        <InputWrapper label="Currency (ISO-4217)" icon={Coins}>
                            <SearchableSelect
                                name="currencyLocale"
                                options={currencyOptions}
                                value={formData.currencyLocale}
                                onChange={handleChange}
                                placeholder="Search currency..."
                            />
                        </InputWrapper>
                    </div>
                </div>

                {/* Billing & Subscription Selection */}
                <div className="flex flex-col sm:flex-row gap-4 mb-2">
                    <div className="flex-1 min-w-0">
                        <InputWrapper label="Number of Users" icon={Users}>
                            <input
                                type="number"
                                name="requestedUsers"
                                min="1"
                                value={formData.requestedUsers}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-medium"
                                required
                            />
                        </InputWrapper>
                    </div>
                    <div className="flex-1 min-w-0">
                        <InputWrapper label="Number of Months" icon={Calendar}>
                            <input
                                type="number"
                                name="requestedMonths"
                                min="1"
                                value={formData.requestedMonths}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-medium"
                                required
                            />
                        </InputWrapper>
                    </div>
                </div>

                {/* Live Price Calculation Summary */}
                <div className="mb-4 bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-start gap-3 shadow-sm">
                    <Calculator className="text-emerald-500 mt-0.5 flex-shrink-0" size={18} />
                    <div>
                        <h4 className="text-sm font-bold text-gray-900 mb-1">Subscription Summary</h4>
                        <div className="text-xs text-gray-600 font-medium space-y-1">
                            <p>
                                {formData.requestedUsers} Users × {formData.requestedMonths} Months × {lists?.billing?.currency === 'INR' ? '₹' : (lists?.billing?.currency || '')}{lists?.billing?.pricePerUserPerMonth || 499}
                            </p>
                            <p className="text-emerald-700 font-bold text-sm mt-1">
                                Total: {lists?.billing?.currency === 'INR' ? '₹' : (lists?.billing?.currency || '')}{(formData.requestedUsers || 1) * (formData.requestedMonths || 1) * (lists?.billing?.pricePerUserPerMonth || 499)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Special Checkbox inside a bordered box */}
                <div className="mt-8 border-2 border-emerald-100 rounded-xl p-1 relative flex items-center bg-white shadow-sm overflow-hidden">
                    <label className="flex items-center gap-3 py-3 px-4 flex-1 cursor-pointer group">
                        <div className="relative flex items-center">
                            <input
                                type="checkbox"
                                name="loadSampleData"
                                checked={formData.loadSampleData}
                                onChange={handleChange}
                                className="w-5 h-5 appearance-none rounded border-2 border-emerald-500 checked:bg-emerald-500 checked:border-emerald-500 transition-colors cursor-pointer"
                            />
                            <CheckCircle2 className={`absolute pointer-events-none w-4 h-4 text-white left-0.5 opacity-0 ${formData.loadSampleData ? 'opacity-100' : ''}`} />
                        </div>
                        <span className="text-sm font-bold text-gray-700 group-hover:text-emerald-700 transition-colors">Load sample data for exploration</span>
                    </label>

                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-bold py-3.5 px-6 rounded-lg text-sm transition-colors flex items-center gap-2 relative shadow-lg shadow-emerald-500/20"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : 'Get Started'}
                        {!loading && <ChevronRight size={16} />}

                        {/* Decorator icon hanging off edge from screenshot */}
                        <div className="absolute -right-3 -top-3 w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white border-2 border-white shadow-sm rotate-12">
                            <Sparkles size={14} />
                        </div>
                    </button>
                </div>

            </form>
        </div>
    );
};

export default WorkspaceForm;
