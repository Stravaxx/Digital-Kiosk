import React from 'react';
import { GlassCard } from './GlassCard';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  color?: 'primary' | 'secondary' | 'warning' | 'danger';
}

export function StatCard({ title, value, icon, trend, color = 'primary' }: StatCardProps) {
  const colorClasses = {
    primary: 'text-[#3b82f6]',
    secondary: 'text-[#22c55e]',
    warning: 'text-[#f59e0b]',
    danger: 'text-[#ef4444]',
  };

  return (
    <GlassCard className="p-6 hover:scale-[1.02]">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[#9ca3af] text-sm mb-2">{title}</p>
          <p className={`text-3xl mb-1 ${colorClasses[color]}`}>{value}</p>
          {trend && (
            <p className={`text-sm ${trend.isPositive ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {trend.isPositive ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        {icon && (
          <div className={`${colorClasses[color]} opacity-20`}>
            {icon}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
