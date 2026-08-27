import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const Button = React.forwardRef(({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  icon,
  isLoading,
  disabled,
  ...props 
}, ref) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]';
  
  const variants = {
    primary: 'bg-[#0D99FF] text-white hover:bg-[#007BE5] active:bg-[#0066C0] shadow-sm focus:ring-[#0D99FF]/20',
    secondary: 'bg-white text-slate-700 border border-[#E5E5E5] hover:bg-[#F5F5F5] hover:border-slate-300 shadow-xs focus:ring-slate-200',
    outline: 'border border-[#E5E5E5] text-slate-700 hover:border-slate-400 hover:bg-[#F5F5F5] focus:ring-[#0D99FF]/20',
    ghost: 'text-slate-600 hover:text-slate-900 hover:bg-[#F5F5F5] focus:ring-slate-200',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm shadow-rose-200 focus:ring-rose-500/20',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200 focus:ring-emerald-500/20'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-2.5 text-base',
    icon: 'p-2'
  };

  const classes = `${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`;

  return (
    <motion.button
      ref={ref}
      className={classes}
      disabled={disabled || isLoading}
      whileTap={{ scale: disabled || isLoading ? 1 : 0.96, transition: { type: "spring", stiffness: 500, damping: 30 } }}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" strokeWidth={2} />
      ) : icon ? (
        <span className="mr-2">{icon}</span>
      ) : null}
      {children}
    </motion.button>
  );
});

Button.displayName = 'Button';

export default Button;
