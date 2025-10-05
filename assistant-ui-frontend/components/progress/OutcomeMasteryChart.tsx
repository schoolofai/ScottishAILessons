'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getMasteryLabel, getMasteryColor } from '@/lib/services/progress-service';

interface OutcomeMasteryData {
  outcomeRef: string;
  outcomeTitle: string;
  mastery: number;
}

interface OutcomeMasteryChartProps {
  data: OutcomeMasteryData[];
}

export function OutcomeMasteryChart({ data }: OutcomeMasteryChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-600">
        No mastery data available yet. Complete some lessons to see your progress!
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(400, data.length * 60)}>
      <BarChart data={data} layout="horizontal" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <XAxis type="number" domain={[0, 1]} />
        <YAxis
          type="category"
          dataKey="outcomeTitle"
          width={200}
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          content={({ payload }) => {
            if (!payload?.[0]) return null;
            const data = payload[0].payload as OutcomeMasteryData;
            return (
              <div className="bg-white p-3 border rounded shadow">
                <p className="font-medium">{data.outcomeTitle}</p>
                <p className="text-sm">Mastery: {data.mastery.toFixed(2)}</p>
                <p className="text-sm text-gray-600">{getMasteryLabel(data.mastery)}</p>
              </div>
            );
          }}
        />
        <Bar dataKey="mastery" radius={[0, 4, 4, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getMasteryColor(entry.mastery)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
