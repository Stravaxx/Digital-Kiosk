import React from 'react';

interface GlassButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'warning' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export function GlassButton({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  onClick,
  disabled = false,
  type = 'button',
}: GlassButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center text-center gap-2 backdrop-blur-[20px] border rounded-[16px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantClasses = {
    primary: 'bg-[#3b82f6] hover:bg-[#2563eb] border-[rgba(255,255,255,0.12)] text-white',
    secondary: 'bg-[#22c55e] hover:bg-[#16a34a] border-[rgba(255,255,255,0.12)] text-white',
    warning: 'bg-[#f59e0b] hover:bg-[#d97706] border-[rgba(255,255,255,0.12)] text-white',
    danger: 'bg-[#ef4444] hover:bg-[#dc2626] border-[rgba(255,255,255,0.12)] text-white',
    ghost: 'bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.12)] border-[rgba(255,255,255,0.12)] text-[#e5e7eb]',
  };
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  };
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </button>
  );
}
