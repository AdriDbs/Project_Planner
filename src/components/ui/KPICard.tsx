import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning';
  trend?: { value: string; positive: boolean };
}

const colorMap = {
  primary: { bg: 'bg-bp-primary/10', text: 'text-bp-primary', icon: 'bg-bp-primary' },
  secondary: { bg: 'bg-bp-secondary/10', text: 'text-bp-secondary', icon: 'bg-bp-secondary' },
  accent: { bg: 'bg-bp-accent/10', text: 'text-bp-accent', icon: 'bg-bp-accent' },
  success: { bg: 'bg-green-50', text: 'text-green-700', icon: 'bg-bp-success' },
  warning: { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: 'bg-bp-warning' },
};

export function KPICard({ title, value, subtitle, icon: Icon, color = 'primary', trend }: KPICardProps) {
  const colors = colorMap[color];
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-xl ${colors.icon} flex items-center justify-center flex-shrink-0`}>
        <Icon size={22} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-500 font-medium truncate">{title}</p>
        <p className={`text-2xl font-bold ${colors.text} mt-1 truncate`}>{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        {trend && (
          <p className={`text-xs mt-1 font-medium ${trend.positive ? 'text-green-600' : 'text-red-500'}`}>
            {trend.positive ? '↑' : '↓'} {trend.value}
          </p>
        )}
      </div>
    </div>
  );
}
