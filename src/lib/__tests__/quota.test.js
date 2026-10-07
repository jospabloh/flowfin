import { describe, expect, it } from 'vitest';
import { quotaTone } from '@/lib/quota';

// The member life bar in Familia colours itself from this. The tone is what tells
// an admin they are about to run out of seats, so the thresholds are the contract.
describe('quotaTone', () => {
  it('stays ok below 80% of the plan', () => {
    expect(quotaTone(0, 4)).toBe('ok');
    expect(quotaTone(3, 5)).toBe('ok'); // 60%
  });

  it('warns from 80% until the last seat is taken', () => {
    expect(quotaTone(4, 5)).toBe('near'); // 80%
    expect(quotaTone(3, 4)).toBe('ok');   // 75%: still room, no warning yet
  });

  it('is full at or over the limit, so inviting is blocked visibly', () => {
    expect(quotaTone(4, 4)).toBe('full');
    expect(quotaTone(6, 4)).toBe('full');
  });

  it('treats a limit of 0 as full: no seats allowed is not "ok"', () => {
    expect(quotaTone(0, 0)).toBe('full');
  });

  it('never fills an unlimited plan', () => {
    expect(quotaTone(50, Infinity)).toBe('ok');
  });
});
