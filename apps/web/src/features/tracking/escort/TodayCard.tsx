import type { ICareSummary } from '@my-project/shared';
import { formatLiters } from './care-ui';

/** "Hôm nay" (Figma E1): tổng thực tế, không có mục tiêu hay thanh tiến độ (quyết định 5.1). */
export default function TodayCard({ summary }: { summary: ICareSummary }) {
  const rows: [string, string][] = [
    ['Nước uống', formatLiters(summary.waterLiters)],
    ['Bữa ăn', `${summary.meals} bữa`],
    ['Lần nghỉ chân', `${summary.rests} lần · ${summary.restMinutes} phút`],
  ];
  return (
    <section className="drv-card esc-today" aria-labelledby="esc-today-title">
      <h3 id="esc-today-title" className="drv-card-title">Hôm nay</h3>
      <dl>
        {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
    </section>
  );
}
