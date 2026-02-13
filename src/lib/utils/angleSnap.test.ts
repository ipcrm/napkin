import { calculateAngleSnap } from './angleSnap';

describe('calculateAngleSnap', () => {
  it('does not snap very short lines', () => {
    const result = calculateAngleSnap(0, 0, 2, 0);
    expect(result.snapped).toBe(false);
    expect(result.snapAxis).toBeNull();
    expect(result.x).toBe(2);
    expect(result.y).toBe(0);
  });

  it('snaps to horizontal when angle is near 0 degrees (rightward)', () => {
    // Slight upward drift on a rightward line
    const result = calculateAngleSnap(0, 0, 100, 2);
    expect(result.snapped).toBe(true);
    expect(result.snapAxis).toBe('horizontal');
    expect(result.x).toBe(100);
    expect(result.y).toBe(0); // snapped to startY
  });

  it('snaps to horizontal when angle is near 180 degrees (leftward)', () => {
    const result = calculateAngleSnap(100, 50, 0, 52);
    expect(result.snapped).toBe(true);
    expect(result.snapAxis).toBe('horizontal');
    expect(result.y).toBe(50);
  });

  it('snaps to vertical when angle is near 90 degrees (downward)', () => {
    const result = calculateAngleSnap(50, 0, 51, 100);
    expect(result.snapped).toBe(true);
    expect(result.snapAxis).toBe('vertical');
    expect(result.x).toBe(50); // snapped to startX
    expect(result.y).toBe(100);
  });

  it('snaps to vertical when angle is near 270 degrees (upward)', () => {
    const result = calculateAngleSnap(50, 100, 51, 0);
    expect(result.snapped).toBe(true);
    expect(result.snapAxis).toBe('vertical');
    expect(result.x).toBe(50);
  });

  it('does not snap at 45 degrees', () => {
    const result = calculateAngleSnap(0, 0, 100, 100);
    expect(result.snapped).toBe(false);
    expect(result.snapAxis).toBeNull();
    expect(result.x).toBe(100);
    expect(result.y).toBe(100);
  });

  it('does not snap at ~30 degrees', () => {
    // atan2(50, 87) ≈ 29.9°
    const result = calculateAngleSnap(0, 0, 87, 50);
    expect(result.snapped).toBe(false);
  });

  it('preserves exact coordinates when no snap occurs', () => {
    const result = calculateAngleSnap(10, 20, 60, 80);
    expect(result.x).toBe(60);
    expect(result.y).toBe(80);
    expect(result.snapped).toBe(false);
  });
});
