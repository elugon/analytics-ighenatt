export { readReport as loadReport } from '@flarelytics/measurement';
export type { Report } from '@flarelytics/measurement';

export function formatDuration(seconds: number): string {
  const rounded = Math.round(seconds);
  if (rounded <= 0) return '0 s';
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  if (minutes === 0) return `${rest} s`;
  return `${minutes} min ${rest} s`;
}
