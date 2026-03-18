import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

export function GlassCard({ children, className = '', onClick }: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-[rgba(255,255,255,0.08)] backdrop-blur-[20px] border border-[rgba(255,255,255,0.12)] rounded-[16px] shadow-lg transition-all duration-200 ${className}`}
    >
      {children}
    </div>
  );
}
