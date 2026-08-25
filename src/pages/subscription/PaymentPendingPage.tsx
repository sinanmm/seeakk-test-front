import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, ShieldCheck } from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';

const PaymentPendingPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100"
      >
        <div className="bg-amber-50 p-6 flex flex-col items-center text-center border-b border-amber-100">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
            <Clock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Payment Verification Pending</h1>
          <p className="text-sm text-slate-600">
            We have received your payment submission. Our team is currently verifying the details.
          </p>
        </div>

        <div className="p-8">
          <div className="space-y-6">
            <div className="flex items-start">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-slate-800">Proof Submitted</h3>
                <p className="text-sm text-slate-500 mt-1">Your payment details and screenshot have been securely uploaded.</p>
              </div>
            </div>

            <div className="flex items-start">
              <ShieldCheck className="w-6 h-6 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-slate-800">Account Access</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Once verified, your account {user?.workspace?.companyName ? `(${user.workspace.companyName}) ` : ''}will be fully unlocked automatically.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-500">
              Verification typically takes a few hours during business days. Thank you for your patience!
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PaymentPendingPage;
