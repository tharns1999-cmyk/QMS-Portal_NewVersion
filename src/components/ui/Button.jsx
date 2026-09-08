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
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]';
  
  const variants = {
    primary: 'bg-[#262746] text-white hover:bg-[#1e1f38] hover:-translate-y-[1px] active:translate-y-0 shadow-sm hover:shadow-dream focus:ring-[#262746]/20 cursor-pointer',
    secondary: 'bg-dream-surface text-dream-primary border border-dream-subtle hover:bg-dream-surface-soft hover:border-slate-300 shadow-xs focus:ring-indigo-100 cursor-pointer',
    outline: 'border border-dream-subtle text-dream-primary hover:border-slate-400 hover:bg-dream-surface-soft focus:ring-indigo-100 cursor-pointer',
    ghost: 'text-dream-secondary hover:text-dream-primary hover:bg-dream-surface-soft focus:ring-indigo-100 cursor-pointer',
    danger: 'bg-rose-500 text-white hover:bg-rose-600 active:bg-rose-700 shadow-sm shadow-rose-200/50 focus:ring-rose-400/20 cursor-pointer',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200/50 focus:ring-emerald-400/20 cursor-pointer'
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
