import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import { Upload, CheckCircle2, AlertCircle, Copy, Loader2, IndianRupee } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useAuthStore from '../../store/useAuthStore';
import useWorkspaceStore from '../../store/useWorkspaceStore';
import SeeakkProductLoader from '../../components/common/SeeakkProductLoader';
import { format } from 'date-fns';

interface PaymentRequest {
  id: string;
  calculatedAmount: number;
  paymentReference: string;
  requestedUsers: number;
  requestedMonths: number;
}

interface BillingSettings {
  upiId: string;
  upiPayeeName: string;
  pricePerUserPerMonth: number;
}

const PaymentPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [settings, setSettings] = useState<BillingSettings | null>(null);
  const [mode, setMode] = useState<'PAYMENT_SUBMISSION' | 'RENEWAL_SETUP'>('PAYMENT_SUBMISSION');

  // Renewal setup states
  const workspace = useAuthStore(state => state.user?.workspace) as any;
  const [users, setUsers] = useState<number>(workspace?.approvedUserLimit || 4);
  const [months, setMonths] = useState<number>(1);

  
  const [utrNumber, setUtrNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [remarks, setRemarks] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fetchWorkspaceConfig = useWorkspaceStore(state => state.fetchWorkspaceConfig);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/subscription/request');
      setPaymentRequest(res.data.paymentRequest);
      setSettings(res.data.billingSettings);
      setMode('PAYMENT_SUBMISSION');
    } catch (err: any) {
      if (err.response?.status === 404) {
        // Switch to renewal setup mode
        setMode('RENEWAL_SETUP');
        // Fetch billing settings manually
        try {
          // We can fetch basic billing settings by creating a dummy API or it's returned somehow
          // For Phase 3, we can assume the backend should provide billing settings for renewal if needed.
          // Let's call a new or existing endpoint if needed. But wait, we can just use the create request.
        } catch(e) {}
      } else {
        toast.error('Could not load payment details. Please refresh.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRenewal = async () => {
    try {
      setLoading(true);
      const res = await api.post('/subscription/renew', {
        requestedUsers: users,
        requestedMonths: months
      });
      if (res.data.success) {
        await fetchData(); // Reload the new request
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create renewal request.');
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!utrNumber || !paymentDate || !file || !paymentRequest) {
      toast.error('Please provide UTR number, date, and payment proof.');
      return;
    }

    try {
      setSubmitting(true);
      
      // 1. Upload proof
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      if (!uploadRes.data.success || !uploadRes.data.key) {
        throw new Error('File upload failed');
      }

      // 2. Submit payment proof
      await api.post('/subscription/submit', {
        paymentRequestId: paymentRequest.id,
        paymentMethod: 'UPI',
        utrNumber,
        paymentDate,
        proofStorageKey: uploadRes.data.key,
        remarks,
      });

      toast.success('Payment submitted successfully!');
      useWorkspaceStore.getState().setWorkspaceConfig({ billingStatus: 'PAYMENT_PENDING' });
      await fetchWorkspaceConfig(); // This will pull the new PAYMENT_PENDING status
      
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to submit payment proof.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <SeeakkProductLoader fullScreen />;
  }

  if (!paymentRequest) {
    if (mode === 'RENEWAL_SETUP') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 max-w-md w-full p-8"
          >
            <div className="text-center mb-8">
              <h1 className="text-2xl font-extrabold text-slate-900">Renew Subscription</h1>
              <p className="mt-2 text-slate-600">Your current access has expired or requires payment.</p>
              {workspace?.approvedUserLimit ? (
                <p className="mt-2 text-sm text-amber-600 font-medium">Previous Limit: {workspace.approvedUserLimit} Users</p>
              ) : null}
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Number of Users</label>
                <div className="flex items-center space-x-4">
                  <button onClick={() => setUsers(Math.max(workspace?.approvedUserLimit || 1, users - 1))} className="p-3 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors text-slate-700 font-bold w-12 h-12 flex items-center justify-center">-</button>
                  <div className="flex-1 text-center font-bold text-2xl text-slate-800">{users}</div>
                  <button onClick={() => setUsers(users + 1)} className="p-3 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors text-slate-700 font-bold w-12 h-12 flex items-center justify-center">+</button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Number of Months</label>
                <div className="flex items-center space-x-4">
                  <button onClick={() => setMonths(Math.max(1, months - 1))} className="p-3 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors text-slate-700 font-bold w-12 h-12 flex items-center justify-center">-</button>
                  <div className="flex-1 text-center font-bold text-2xl text-slate-800">{months}</div>
                  <button onClick={() => setMonths(months + 1)} className="p-3 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors text-slate-700 font-bold w-12 h-12 flex items-center justify-center">+</button>
                </div>
              </div>

              <button
                onClick={handleCreateRenewal}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-8 rounded-xl shadow-lg transition-all flex items-center justify-center"
              >
                Proceed to Payment
              </button>
            </div>
          </motion.div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white p-8 rounded-xl shadow-md text-center max-w-md w-full">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800">No Payment Request Found</h2>
          <p className="text-slate-600 mt-2">Please contact support or set up your workspace billing first.</p>
        </div>
      </div>
    );
  }

  const hasValidUpi = Boolean(settings?.upiId && settings?.upiPayeeName);
  // Google Pay / UPI String format: upi://pay?pa=UPI_ID&pn=PAYEE_NAME&am=AMOUNT&tr=REF_ID&cu=INR
  const upiString = hasValidUpi
    ? `upi://pay?pa=${encodeURIComponent(settings!.upiId)}&pn=${encodeURIComponent(settings!.upiPayeeName)}&am=${paymentRequest.calculatedAmount}&tr=${encodeURIComponent(paymentRequest.paymentReference)}&cu=INR`
    : '';

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-slate-900">Workspace Subscription Payment</h1>
          <p className="mt-3 text-lg text-slate-600">Please complete your payment to activate your account.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* LEFT: QR Code and Details */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200"
          >
            <div className="bg-emerald-500 p-6 text-white text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-emerald-400 rounded-full opacity-50 blur-2xl"></div>
              <h2 className="text-2xl font-bold mb-1">Amount Due</h2>
              <div className="flex items-center justify-center text-4xl font-extrabold tracking-tight">
                <IndianRupee className="w-8 h-8 mr-1" />
                {paymentRequest.calculatedAmount.toLocaleString()}
              </div>
              <p className="mt-2 text-emerald-100 text-sm">
                For {paymentRequest.requestedUsers} Users × {paymentRequest.requestedMonths} Months
              </p>
            </div>

            <div className="p-8 flex flex-col items-center">
              {hasValidUpi ? (
                <>
                  <div className="bg-white p-4 rounded-xl shadow-inner border-2 border-slate-100 mb-6 relative group">
                    <QRCodeSVG value={upiString} size={220} level="H" includeMargin={true} />
                  </div>
                  
                  <p className="text-sm font-medium text-slate-500 mb-6 uppercase tracking-wider">Scan with any UPI App (GPay, PhonePe, Paytm)</p>
                  
                  <div className="w-full space-y-4">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="overflow-hidden">
                        <p className="text-xs text-slate-500 uppercase font-semibold">UPI ID</p>
                        <p className="font-medium text-slate-800 truncate">{settings?.upiId}</p>
                      </div>
                      <button onClick={() => copyToClipboard(settings?.upiId || '', 'UPI ID')} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors">
                        <Copy className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="overflow-hidden">
                        <p className="text-xs text-slate-500 uppercase font-semibold">Reference ID (Required)</p>
                        <p className="font-mono font-medium text-slate-800 truncate">{paymentRequest.paymentReference}</p>
                      </div>
                      <button onClick={() => copyToClipboard(paymentRequest.paymentReference, 'Reference ID')} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors">
                        <Copy className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="w-full">
                  <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-center mb-6 w-full">
                    <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                    <h3 className="font-bold text-amber-900 text-sm">Payment Receiving Account Not Configured</h3>
                    <p className="text-xs text-amber-700 mt-1">Payment receiving account is not configured. Please contact SEEAKK support.</p>
                  </div>

                  <div className="w-full space-y-4">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="overflow-hidden">
                        <p className="text-xs text-slate-500 uppercase font-semibold">Reference ID</p>
                        <p className="font-mono font-medium text-slate-800 truncate">{paymentRequest.paymentReference}</p>
                      </div>
                      <button onClick={() => copyToClipboard(paymentRequest.paymentReference, 'Reference ID')} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors">
                        <Copy className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* RIGHT: Submission Form */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200"
          >
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Submit Payment Details</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  UTR / Transaction ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  placeholder="e.g. 123456789012"
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-slate-800 bg-slate-50 font-mono"
                />
                <p className="mt-1 text-xs text-slate-500">12-digit reference number from your bank or UPI app.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Payment Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  max={format(new Date(), 'yyyy-MM-dd')}
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-slate-800 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Upload Payment Screenshot <span className="text-red-500">*</span>
                </label>
                
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                    file ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400'
                  }`}
                >
                  <input 
                    type="file" 
                    className="hidden" 
                    ref={fileInputRef}
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleFileChange}
                  />
                  
                  {file ? (
                    <div className="flex flex-col items-center">
                      <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
                      <p className="text-sm font-medium text-emerald-800 truncate max-w-full">{file.name}</p>
                      <p className="text-xs text-emerald-600 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <Upload className="w-10 h-10 text-slate-400 mb-2" />
                      <p className="text-sm font-medium text-slate-700">Click to upload screenshot</p>
                      <p className="text-xs text-slate-500 mt-1">PNG, JPG, PDF up to 5MB</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Remarks (Optional)
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={2}
                  placeholder="Any additional information..."
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-slate-800 bg-slate-50 resize-none"
                />
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={submitting || !hasValidUpi || !utrNumber || !file}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-8 rounded-xl shadow-lg transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed group"
                >
                  {submitting ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Submitting...</>
                  ) : (
                    <>Submit Payment Details</>
                  )}
                </button>
                {!hasValidUpi && (
                  <p className="text-xs text-amber-700 font-medium text-center">
                    Payment receiving account is not configured. Submissions are temporarily disabled.
                  </p>
                )}
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;
