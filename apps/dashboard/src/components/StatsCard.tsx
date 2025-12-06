import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

type Props = {
  title: string;
  value: string | number;
  hint?: string;
  accent?: 'default' | 'blue' | 'green' | 'red';
};

const accentClass: Record<NonNullable<Props['accent']>, string> = {
  default: 'text-gray-900',
  blue: 'text-blue-600',
  green: 'text-green-600',
  red: 'text-red-600',
};

export function StatsCard({ title, value, hint, accent = 'default' }: Props) {
  return (
    <Card className="border-gray-200 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
        {hint && <CardDescription>{hint}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-semibold ${accentClass[accent]}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
