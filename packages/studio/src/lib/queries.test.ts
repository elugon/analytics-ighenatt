import type { MeasurementDatabase } from '@flarelytics/measurement';
import { describe, expect, it, vi } from 'vitest';
import { loadReport } from './queries';
import { SITES } from './sites';

describe('studio measurement source', () => {
  it('propagates D1 failure instead of returning false zero figures', async () => {
    const prepare = vi.fn(() => {
      throw new Error('offline');
    });
    const db = { prepare } as unknown as MeasurementDatabase;
    await expect(loadReport(db, SITES['salagraupera.com'], 7)).rejects.toThrow(
      'offline'
    );
    expect(prepare).toHaveBeenCalled();
  });
});
