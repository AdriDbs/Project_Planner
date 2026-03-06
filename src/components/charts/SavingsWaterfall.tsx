import React from 'react';
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { formatNumber } from '../../lib/calculations';

interface WaterfallEntry {
  name: string;
  value: number;
  type: 'baseline' | 'saving' | 'total';
}

interface SavingsWaterfallProps {
  data: WaterfallEntry[];
  locale?: 'fr' | 'en';
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-sm">
        <p className="font-semibold text-gray-900">{label}</p>
        <p className="text-gray-600">{formatNumber(Math.abs(payload[0]?.value || 0))} €</p>
      </div>
    );
  }
  return null;
};

export function SavingsWaterfall({ data, locale = 'fr' }: SavingsWaterfallProps) {
  const chartData = data.map((d, i) => {
    if (d.type === 'baseline') return { ...d, fill: '#003057' };
    if (d.type === 'total') return { ...d, fill: '#00A3E0' };
    return { ...d, fill: '#00B050' };
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 40, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={(v) => formatNumber(v, locale)} tick={{ fontSize: 11 }} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={index} fill={entry.fill} />
          ))}
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}
