/**
 * Centralized Design System Tokens
 * Adheres to:
 * - 60:30:10 Rule (Background 60%, Cards 30%, Accent 10%)
 * - 4px Grid Spacing Rule
 */

export const colors = {
  // 60% Dominant Background
  bg: 'bg-slate-50 dark:bg-slate-950 transition-colors duration-200',
  text: 'text-slate-800 dark:text-slate-50 transition-colors duration-200',
  
  // 30% Secondary Containers/Cards
  card: 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none transition-all duration-200',
  cardHover: 'hover:bg-slate-100/60 dark:hover:bg-slate-800/80',
  cardSelected: 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700',
  border: 'border-slate-200 dark:border-slate-800 transition-colors duration-200',
  borderHover: 'hover:border-slate-300 dark:hover:border-slate-700',
  inputBg: 'bg-slate-100/60 dark:bg-slate-950/60 transition-colors duration-200',
  inputBorder: 'border-slate-300 dark:border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors duration-200',
  textMuted: 'text-slate-500 dark:text-slate-400 transition-colors duration-200',
  textDark: 'text-slate-950 dark:text-slate-50 transition-colors duration-200',
  
  // 10% Vibrant Accent
  accent: 'emerald-500',
  accentBg: 'bg-emerald-500',
  accentHoverBg: 'hover:bg-emerald-600',
  accentText: 'text-emerald-600 dark:text-emerald-400 transition-colors duration-200',
  accentBorder: 'border-emerald-500',
  
  // Alert Status Colors
  success: 'emerald-500',
  warning: 'amber-500',
  danger: 'rose-500',
  info: 'sky-500'
};

export const spacing = {
  px: '1px',
  xs: '4px',    // p-1
  sm: '8px',    // p-2
  md: '12px',   // p-3
  lg: '16px',   // p-4
  xl: '20px',   // p-5
  xxl: '24px',  // p-6
  xxxl: '32px', // p-8
  xxxxl: '48px',// p-12
};

export const borderRadius = {
  sm: 'rounded-sm',     // 2px
  md: 'rounded',        // 4px
  lg: 'rounded-md',     // 6px
  xl: 'rounded-lg',     // 8px
  xxl: 'rounded-xl',    // 12px
  xxxl: 'rounded-2xl',  // 16px
  full: 'rounded-full',
};

export const shadows = {
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
  glow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]',
};
