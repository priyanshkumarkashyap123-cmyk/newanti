/**
 * CookieConsent — GDPR/IT Act compliant cookie consent banner
 * 
 * Shows a non-intrusive bottom banner on first visit.
 * Persists choice in localStorage. Slides up with animation.
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, X } from "lucide-react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "beamlab-cookie-consent";

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check after a short delay so it doesn't interfere with page load
    const timer = setTimeout(() => {
      const consent = localStorage.getItem(STORAGE_KEY);
      if (!consent) {
        setIsVisible(true);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleAccept = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setIsVisible(false);
  }, []);

  const handleDecline = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "declined");
    setIsVisible(false);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-0 inset-x-0 z-[60] p-4 sm:p-6"
          role="dialog"
          aria-label="Cookie consent"
        >
          <div className="max-w-4xl mx-auto bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl border border-white/[0.08] shadow-2xl shadow-black/30 p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/10 flex items-center justify-center">
                <Cookie className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-300 leading-relaxed">
                  We use cookies and local storage to enhance your experience, remember your preferences, 
                  and improve our services. By clicking "Accept", you consent to the use of cookies.{" "}
                  <Link
                    to="/privacy-policy"
                    className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
                  >
                    Privacy Policy
                  </Link>
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 w-full sm:w-auto">
                <button type="button"
                  onClick={handleDecline}
                  className="flex-1 sm:flex-none px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors rounded-lg hover:bg-white/[0.05] cursor-pointer"
                >
                  Decline
                </button>
                <button type="button"
                  onClick={handleAccept}
                  className="flex-1 sm:flex-none px-5 py-2 text-sm font-medium tracking-wide tracking-wide bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors cursor-pointer"
                >
                  Accept
                </button>
              </div>
              <button type="button"
                onClick={handleDecline}
                className="absolute top-3 right-3 sm:relative sm:top-auto sm:right-auto text-slate-500 hover:text-slate-300 transition-colors p-1 cursor-pointer"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default CookieConsent;
