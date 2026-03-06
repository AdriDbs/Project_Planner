import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, LineChart, Line
} from 'recharts';
import { formatNumber } from '../../lib/calculations';

interface PhasingData {
  year: string;
  commitment: number;
  additional: number;
  cumulative?: number;
}

interface Props {
  data: PhasingData[];
  locale?: 'fr' | 'en';
  showCumulative?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-sm">
        <p className="font-semibold text-gray-900 mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: {formatNumber(p.value)} €
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function SavingsPhasingChart({ data, locale = 'fr', showCumulative = false }: Props) {
  if (showCumulative) {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 40, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="year" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v) => formatNumber(v, locale)} tick={{ fontSize: 11 }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line type="monotone" dataKey="cumulative" name="Cumulé" stroke="#003057" strokeWidth={2} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 20, left: 40, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="year" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={(v) => formatNumber(v, locale)} tick={{ fontSize: 11 }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Bar dataKey="commitment" name="Commitment" stackId="a" fill="#003057" radius={[0, 0, 0, 0]} />
        <Bar dataKey="additional" name="Additional Potential" stackId="a" fill="#00A3E0" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
