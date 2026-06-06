import React from 'react';
import { colors, borderRadius, shadows } from '../../design-system/tokens';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  icon?: React.ReactNode;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  icon,
  loading = false,
  className = '',
  ...props
}) => {
  let styleClasses = '';
  
  switch (variant) {
    case 'primary':
      styleClasses = `${colors.accentBg} ${colors.textDark} ${colors.accentHoverBg} ${shadows.glow}`;
      break;
    case 'secondary':
      styleClasses = `bg-slate-800 text-slate-200 hover:bg-slate-700/80 border ${colors.border}`;
      break;
    case 'success':
      styleClasses = `bg-emerald-600 text-slate-100 hover:bg-emerald-700`;
      break;
    case 'danger':
      styleClasses = `bg-rose-600 text-slate-100 hover:bg-rose-700`;
      break;
  }

  return (
    <button
      className={`
        inline-flex items-center justify-center gap-8px px-5 py-3 
        text-sm font-bold tracking-wide transition-custom
        transform active:scale-[0.97] hover:scale-[1.02] 
        ${borderRadius.xl} ${styleClasses}
        disabled:opacity-50 disabled:pointer-events-none
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-5 w-5 text-current" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : icon ? (
        <span className="w-5 h-5 flex items-center justify-center">{icon}</span>
      ) : null}
      <span>{children}</span>
    </button>
  );
};
