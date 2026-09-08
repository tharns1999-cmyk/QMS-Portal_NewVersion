import React from 'react';

const VARIANTS = {
  active: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60',
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60',
  pending: 'bg-amber-50 text-amber-700 border border-amber-200/60',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200/60',
  review: 'bg-amber-50 text-amber-700 border border-amber-200/60',
  rejected: 'bg-rose-50 text-rose-700 border border-rose-200/60',
  danger: 'bg-rose-50 text-rose-700 border border-rose-200/60',
  obsolete: 'bg-rose-50 text-rose-700 border border-rose-200/60',
  draft: 'bg-slate-100 text-slate-700 border border-slate-200/60',
  neutral: 'bg-slate-100 text-slate-700 border border-slate-200/60',
  info: 'bg-slate-100 text-slate-700 border border-slate-200/60',
  system: 'bg-dream-lavender text-indigo-700 border border-indigo-200/60',
  inactive: 'bg-slate-100 text-dream-muted border border-dream-subtle'
};

const StatusBadge = ({ 
  children, 
  variant = 'active', 
  status,
  className = '', 
  dot = false,
  ...props 
}) => {
  const normalizedVariant = (status || variant || 'active').toLowerCase();
  const variantClass = VARIANTS[normalizedVariant] || VARIANTS.active;

  return (
    <span 
      className={`font-semibold text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 leading-snug whitespace-nowrap ${variantClass} ${className}`}
      {...props}
    >
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0 opacity-80" />
      )}
      {children}
    </span>
  );
};

export default StatusBadge;
export { StatusBadge, StatusBadge as Badge };
