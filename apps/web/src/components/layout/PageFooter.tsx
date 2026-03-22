import React, { FC } from 'react';
import { Link } from 'react-router-dom';

export const PageFooter: FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[#1a2333] bg-[#0b1326]">
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#869ab8]">
        <span>© {year} BeamLab. All rights reserved.</span>
        <div className="flex items-center gap-3">
          <Link to="/help" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">Help</Link>
                   <Link to="/support" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">Support</Link>
                   <Link to="/contact" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">Contact</Link>
          <Link to="/trust" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">Trust</Link>
          <Link to="/privacy-policy" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">Privacy</Link>
          <Link to="/terms-and-conditions" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">Terms</Link>
        </div>
      </div>
    </footer>
  );
};

export default PageFooter;