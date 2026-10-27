import { describe, expect, it } from 'vitest';
import { maxFlow } from '../src/engine/flow';

describe('max-flow dispatch solver', () => {
  it('delivers power from a generator to a load through a link', () => {
    const result = maxFlow(3, [10, 0, 0], [0, 0, 6], [
      { a: 0, b: 1, cap: 20 },
      { a: 1, b: 2, cap: 20 },
    ]);
    expect(result.total).toBeCloseTo(6, 6);
    expect(result.produced[0]).toBeCloseTo(6, 6);
    expect(result.served[2]).toBeCloseTo(6, 6);
    expect(result.congested.some(Boolean)).toBe(false);
  });

  it('respects a bottleneck and reports congestion', () => {
    const result = maxFlow(3, [50, 0, 0], [0, 0, 40], [
      { a: 0, b: 1, cap: 12 },
      { a: 1, b: 2, cap: 30 },
    ]);
    expect(result.total).toBeCloseTo(12, 6);
    expect(result.served[2]).toBeCloseTo(12, 6);
    expect(result.produced[0]).toBeCloseTo(12, 6);
    expect(result.congested[0]).toBe(true);
  });

  it('keeps disconnected islands independent', () => {
    const result = maxFlow(4, [20, 0, 0, 0], [0, 0, 25, 0], [
      { a: 0, b: 1, cap: 30 },
    ]);
    expect(result.total).toBeCloseTo(0, 6);
    expect(result.produced[0]).toBeCloseTo(0, 6);
    expect(result.served[2]).toBeCloseTo(0, 6);
  });

  it('allocates partial service when supply is short', () => {
    const result = maxFlow(2, [3, 0], [0, 9], [{ a: 0, b: 1, cap: 20 }]);
    expect(result.total).toBeCloseTo(3, 6);
    expect(result.produced[0]).toBeCloseTo(3, 6);
    expect(result.served[1]).toBeCloseTo(3, 6);
  });

  it('never exceeds source, sink or edge capacities', () => {
    const result = maxFlow(4, [8, 7, 0, 0], [0, 0, 9, 9], [
      { a: 0, b: 2, cap: 6 },
      { a: 1, b: 2, cap: 6 },
      { a: 2, b: 3, cap: 5 },
    ]);
    expect(result.total).toBeLessThanOrEqual(5 + 6 + 6);
    expect(result.produced[0]).toBeLessThanOrEqual(8);
    expect(result.produced[1]).toBeLessThanOrEqual(7);
    expect(result.served[2]).toBeLessThanOrEqual(9);
    expect(result.served[3]).toBeLessThanOrEqual(9);
  });
});
