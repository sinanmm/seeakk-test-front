import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, ArrowRight, TrendingUp, Users, Calendar, Search, Eye, EyeOff } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { CredentialResponse } from '@react-oauth/google';
import { toast } from 'react-hot-toast';
import useAuthStore from '../store/useAuthStore';
import api from '../services/api';
import { User } from '../types/user.types';
import GoogleSignInButton from '../components/auth/GoogleSignInButton';
import BrandLogo from '../components/BrandLogo';
import { setGoogleSignInHandlers } from '../auth/googleSignInBridge';
import {
  getAuthErrorMessage,
  getLoginRedirectNotice,
  normalizeLoginCredentials,
} from '../utils/authErrors';

interface LoginResponse {
    user: User;
    accessToken: string;
    refreshToken: string;
    session?: {
        mandatoryFollowupRequired?: boolean;
        mandatoryFollowupCount?: number;
    };
}

const Login = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const setAuth = useAuthStore((state) => state.setAuth);

    const [email, setEmail] = useState(() => (searchParams.get('email') || '').trim());
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const sessionNotice = getLoginRedirectNotice(searchParams.get('reason'));

    const loginMutation = useMutation<LoginResponse, unknown, { email: string; password: string }>({
        mutationFn: async (credentials) => {
            const response = await api.post('/auth/login', normalizeLoginCredentials(credentials.email, credentials.password));
            return response.data;
        },
        onSuccess: (data) => {
            console.log('Login Successful');
            setAuth(data.user, data.accessToken, data.refreshToken, data.session);
            toast.success(`Welcome back, ${data.user.name.split(' ')[0]}!`);
            if (!data.user.isOnboarded) {
                navigate('/workspace/setup', { replace: true });
            } else {
                navigate('/dashboard', { replace: true });
            }
        },
        onError: (error: unknown) => {
            toast.error(getAuthErrorMessage(error));
        },
    });

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (loginMutation.isPending) return;
        console.log('Login Started');
        loginMutation.mutate({ email, password });
    };

    const googleLoginMutation = useMutation<LoginResponse, any, string>({
        mutationFn: async (credential) => {
            const response = await api.post('/auth/google', { credential });
            return response.data;
        },
        onSuccess: (data) => {
            setAuth(data.user, data.accessToken, data.refreshToken, data.session);
            toast.success('Successfully logged in with Google!');
            if (!data.user.isOnboarded) {
                navigate('/workspace/setup', { replace: true });
            } else {
                navigate('/dashboard', { replace: true });
            }
        },
        onError: (error: unknown) => {
            toast.error(getAuthErrorMessage(error, 'Google sign-in failed. Please try again.'));
        },
    });

    const handleGoogleSuccess = useCallback((credentialResponse: CredentialResponse) => {
        if (credentialResponse.credential) {
            googleLoginMutation.mutate(credentialResponse.credential);
            return;
        }

        toast.error('Google did not return a credential token.');
    }, [googleLoginMutation]);

    const handleGoogleError = useCallback(() => {
        toast.error('Google Login failed completely.');
    }, []);

    useEffect(() => {
        setGoogleSignInHandlers({
            onCredential: handleGoogleSuccess,
            onError: handleGoogleError,
        });
        return () => setGoogleSignInHandlers({ onCredential: null, onError: null });
    }, [handleGoogleSuccess, handleGoogleError]);
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="min-h-[100dvh] bg-white flex flex-col lg:flex-row overflow-x-hidden"
        >
            {/* Left Column - Graphic/Branding */}
            <motion.div
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="hidden lg:flex w-1/2 bg-emerald-500 relative flex-col justify-between py-12 px-8 xl:px-12 overflow-hidden"
            >
                {/* Background Decorative Rings */}
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] border-[40px] border-emerald-400/30 rounded-full blur-3xl" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-emerald-600/20 rounded-full blur-3xl" />

                <div className="relative z-10">
                    <Link to="/" className="inline-flex items-center justify-center rounded-2xl bg-white/95 px-4 py-2 shadow-sm">
                        <BrandLogo alt="Seeakk" imgClassName="object-center" />
                    </Link>
                </div>

                {/* Dashboard Graphic Rebuild */}
                <div className="relative z-10 w-full max-w-lg mx-auto transform translate-x-4 xl:translate-x-12">

                    {/* Main Glass Panel */}
                    <div className="bg-emerald-400/40 backdrop-blur-xl border border-emerald-300/50 rounded-2xl p-6 shadow-2xl relative">

                        {/* Top Bar inside glass */}
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-3 h-3 rounded-full bg-red-400"></div>
                            <div className="px-4 py-2 bg-emerald-500/50 rounded-lg flex items-center gap-2 w-48">
                                <Search size={14} className="text-emerald-100" />
                                <div className="w-24 h-1.5 bg-emerald-300/50 rounded-full"></div>
                            </div>
                        </div>

                        {/* Grid for inner cards */}
                        <div className="grid grid-cols-2 gap-4">

                            {/* Customers Card */}
                            <div className="bg-white rounded-xl p-4 shadow-sm flex flex-col gap-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-500">
                                        <Users size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Customers</p>
                                        <div className="flex items-baseline gap-2">
                                            <h4 className="text-lg font-bold text-gray-900">12,842</h4>
                                            <span className="text-xs font-bold text-emerald-500">+14%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Revenue Overview Chart */}
                            <div className="bg-white rounded-xl p-4 shadow-sm row-span-2 flex flex-col">
                                <p className="text-[10px] font-bold text-gray-800 uppercase tracking-wider mb-4">Revenue Overview</p>
                                <div className="flex-grow flex items-end">
                                    <svg className="w-full h-24 overflow-visible" viewBox="0 0 100 50">
                                        <path d="M0,35 Q15,25 30,30 T50,20 T75,25 T100,5" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
                                        <path d="M0,35 Q15,25 30,30 T50,20 T75,25 T100,5 L100,50 L0,50 Z" fill="url(#gradient)" opacity="0.2" />
                                        <defs>
                                            <linearGradient id="gradient" x1="0" x2="0" y1="0" y2="1">
                                                <stop offset="0%" stopColor="#10b981" />
                                                <stop offset="100%" stopColor="transparent" />
                                            </linearGradient>
                                        </defs>
                                    </svg>
                                </div>
                                <div className="flex justify-between items-center mt-4">
                                    <span className="text-[10px] text-gray-400 font-medium">Avg. Deal Size</span>
                                    <span className="text-xs font-bold text-gray-900">$4,290</span>
                                </div>
                            </div>

                            {/* Recent Activity Card */}
                            <div className="bg-white rounded-xl p-4 shadow-sm h-[140px]">
                                <div className="flex justify-between items-center mb-4">
                                    <p className="text-[10px] font-bold text-gray-800 uppercase tracking-wider">Recent Activity</p>
                                    <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">Live</span>
                                </div>
                                <div className="space-y-3">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <img src={`https://i.pravatar.cc/100?img=${i + 10}`} className="w-6 h-6 rounded-full" />
                                            <div className="w-16 h-1.5 bg-gray-100 rounded-full"></div>
                                            <div className="ml-auto w-3 h-3 border-2 border-gray-300 rounded flex items-center justify-center">
                                                <div className="w-1 h-1 bg-emerald-500 rounded-full opacity-50"></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>

                        {/* Floating External Cards */}
                        <motion.div
                            animate={{ y: [0, -5, 0] }}
                            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                            className="absolute -top-6 -right-6 bg-white p-3 rounded-xl shadow-xl flex items-center gap-3"
                        >
                            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                                <TrendingUp size={16} />
                            </div>
                            <div>
                                <p className="text-[9px] text-gray-400 font-medium">Conversion Rate</p>
                                <p className="text-sm font-bold text-gray-900">32.4%</p>
                            </div>
                        </motion.div>

                        <motion.div
                            animate={{ y: [0, 5, 0] }}
                            transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", delay: 1 }}
                            className="absolute -bottom-8 -left-8 bg-white p-4 rounded-xl shadow-xl w-48"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <Calendar size={14} className="text-emerald-500" />
                                <p className="text-[10px] font-bold text-gray-800">Upcoming Meetings</p>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 rounded-full mb-1"></div>
                            <div className="w-2/3 h-1.5 bg-gray-100 rounded-full"></div>
                        </motion.div>

                    </div>
                </div>

                <div className="relative z-10 pt-16">
                    <div className="flex justify-end pr-10">
                        <div className="inline-flex items-center justify-center rounded-2xl bg-white/20 px-4 py-2 backdrop-blur-sm">
                            <BrandLogo alt="Seeakk" imgClassName="object-center opacity-80" />
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Right Column - Login Form */}
            <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
                className="w-full lg:w-1/2 min-h-[100dvh] lg:min-h-0 flex items-center justify-center px-4 py-8 sm:p-12 relative overflow-y-auto overflow-x-hidden"
            >
                {/* Desktop Back Button */}
                <Link
                    to="/"
                    className="hidden lg:inline-flex items-center gap-2 px-4 py-2 bg-white/90 hover:bg-white border border-slate-200/80 rounded-full text-xs font-bold text-slate-700 hover:text-emerald-600 shadow-sm hover:shadow transition-all duration-200 group active:scale-95 absolute top-6 left-6 z-30"
                >
                    <ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-0.5 transition-transform text-slate-400 group-hover:text-emerald-600" />
                    <span>Back to Landing</span>
                </Link>

                <div className="w-full max-w-md mx-auto">

                    {/* Mobile Header (Visible only on small screens) */}
                    <div className="lg:hidden flex items-center justify-between mb-8 sm:mb-10 w-full">
                        <Link to="/" className="flex items-center gap-1 sm:gap-2 text-gray-500 hover:text-[#22c55e] transition-colors font-medium text-xs sm:text-sm whitespace-nowrap">
                            <ArrowRight className="rotate-180" size={16} />
                            <span>Back home</span>
                        </Link>
                        <BrandLogo alt="Seeakk" className="flex-shrink-0" imgClassName="object-center" />
                    </div>

                    <div className="mb-10 text-center sm:text-left">
                        <h1 className="text-[32px] font-extrabold text-gray-900 mb-2 tracking-tight">Welcome Back</h1>
                        <p className="text-[15px] text-gray-500 font-medium">Please enter your details to sign in to your account.</p>
                        {sessionNotice ? (
                            <p className="mt-3 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                {sessionNotice}
                            </p>
                        ) : null}
                    </div>

                    <div className="w-full mb-8 flex justify-center">
                        <GoogleSignInButton />
                    </div>

                    <div className="flex items-center mb-8 w-full gap-2">
                        <div className="flex-grow h-px bg-gray-200"></div>
                        <span className="text-[10px] sm:text-[11px] flex-shrink-0 font-bold text-gray-400 uppercase tracking-wider sm:tracking-widest text-center">OR CONTINUE WITH EMAIL</span>
                        <div className="flex-grow h-px bg-gray-200"></div>
                    </div>
                    <form className="space-y-6" onSubmit={handleLogin}>
                        <div>
                            <label className="block text-sm font-bold text-gray-900 mb-2">Email Address</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Mail size={18} className="text-gray-400" />
                                </div>
                                <input
                                    id="login-email"
                                    name="email"
                                    type="email"
                                    autoComplete="username email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="block w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors shadow-sm text-gray-900 font-medium placeholder-gray-400"
                                    placeholder="alex@example.com"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-bold text-gray-900">Password</label>
                                <Link to="/forgot-password" className="text-sm font-bold text-emerald-500 hover:text-emerald-600">Forgot password?</Link>
                            </div>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock size={18} className="text-gray-400" />
                                </div>
                                <input
                                    id="login-password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                    required
                                    className={`block w-full pl-11 pr-12 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors shadow-sm text-gray-900 font-medium placeholder-gray-400 ${
                                        showPassword ? '' : 'tracking-widest'
                                    }`}
                                    placeholder="Enter your password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-emerald-600 focus:outline-none focus-visible:text-emerald-600 rounded-r-xl"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    aria-controls="login-password"
                                    aria-pressed={showPassword}
                                >
                                    {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center">
                            <input
                                id="remember-me"
                                name="remember-me"
                                type="checkbox"
                                className="h-4 w-4 text-emerald-500 focus:ring-emerald-500 border-gray-300 rounded cursor-pointer"
                            />
                            <label htmlFor="remember-me" className="ml-3 block text-sm font-medium text-gray-600 cursor-pointer">
                                Remember this device for 30 days
                            </label>
                        </div>

                        <div className="relative w-full">
                            <button
                                type="submit"
                                disabled={loginMutation.isPending}
                                className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-xl text-base font-bold text-white bg-[#22c55e] hover:bg-[#16a34a] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#22c55e] transition-all relative z-10 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loginMutation.isPending ? 'Logging in...' : 'Login to Account'}
                                {!loginMutation.isPending && <ArrowRight size={18} strokeWidth={2.5} />}
                            </button>
                            {/* The Purple Sweeping Figma Curve specific to design photo */}
                            <svg className="absolute top-1/2 left-[98%] hidden lg:block pointer-events-none z-0" width="250" height="200" viewBox="0 0 250 200" fill="none">
                                <path d="M0 0 C 80 0, 100 200, 250 200" stroke="#c4b5fd" strokeWidth="2" fill="none" />
                            </svg>
                        </div>
                    </form>

                    <p className="mt-8 text-center text-sm font-medium text-gray-500">
                        Don't have an account yet?{' '}
                        <a href="#" className="font-bold text-[#22c55e] hover:text-[#16a34a] hover:underline">
                            Activate your account
                        </a>
                    </p>

                    {/* Bottom visual filler rects from figma */}
                    <div className="flex justify-center gap-2 mt-8 opacity-20">
                        <div className="w-8 h-2 bg-gray-300 rounded-full"></div>
                        <div className="w-8 h-2 bg-gray-300 rounded-full"></div>
                        <div className="w-8 h-2 bg-gray-300 rounded-full"></div>
                    </div>

                </div>
            </motion.div>
        </motion.div>
    );
};

export default Login;
