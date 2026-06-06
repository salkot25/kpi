import React from 'react';
import { colors, borderRadius } from '../../design-system/tokens';

interface InputFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  value: number | string;
  onChange: (value: string) => void;
  helperText?: string;
  suffix?: string;
  error?: string;
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  value,
  onChange,
  helperText,
  suffix,
  error,
  className = '',
  ...props
}) => {
  return (
    <div className={`flex flex-col gap-2px w-full ${className}`}>
      <label className={`text-xs font-semibold ${colors.textMuted} tracking-wide`}>
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-4 py-3 text-sm font-medium ${colors.inputBg} ${colors.text} 
            border ${colors.inputBorder} ${borderRadius.xl} outline-none transition-custom 
            ${suffix ? 'pr-12' : ''} ${error ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : ''}`}
          {...props}
        />
        {suffix && (
          <span className={`absolute right-4 text-xs font-semibold ${colors.textMuted} pointer-events-none`}>
            {suffix}
          </span>
        )}
      </div>
      {error ? (
        <span className="text-xs text-rose-400 mt-1">{error}</span>
      ) : helperText ? (
        <span className={`text-xs ${colors.textMuted} mt-1`}>{helperText}</span>
      ) : null}
    </div>
  );
};
