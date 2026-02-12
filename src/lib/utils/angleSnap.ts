/**
 * Angle snapping utilities for line/arrow drawing
 *
 * When drawing lines or arrows, if the angle is within a small threshold
 * of 0/90/180/270 degrees (perfectly horizontal or vertical), the endpoint
 * snaps to exact alignment and a visual guide line is drawn.
 */

/** Threshold in degrees for angle snapping */
const SNAP_THRESHOLD_DEGREES = 3;

/** Result of angle snap calculation */
export interface AngleSnapResult {
  /** The (possibly snapped) x coordinate of the endpoint */
  x: number;
  /** The (possibly snapped) y coordinate of the endpoint */
  y: number;
  /** Whether snapping occurred */
  snapped: boolean;
  /** The snapped axis: 'horizontal' if the line is horizontal, 'vertical' if vertical, or null */
  snapAxis: 'horizontal' | 'vertical' | null;
}

/**
 * Given a start point and a candidate endpoint, check if the angle is
 * within SNAP_THRESHOLD_DEGREES of 0/90/180/270 degrees. If so, snap
 * the endpoint to exact alignment.
 */
export function calculateAngleSnap(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): AngleSnapResult {
  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Don't snap for very short lines (avoids jittery behavior at start)
  if (distance < 5) {
    return { x: endX, y: endY, snapped: false, snapAxis: null };
  }

  // Calculate angle in degrees (0-360)
  let angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
  if (angleDeg < 0) angleDeg += 360;

  // Check proximity to cardinal angles (0, 90, 180, 270)
  const cardinalAngles = [0, 90, 180, 270, 360];
  for (const cardinal of cardinalAngles) {
    const diff = Math.abs(angleDeg - cardinal);
    if (diff <= SNAP_THRESHOLD_DEGREES) {
      // Snap to this cardinal direction
      const isHorizontal = cardinal === 0 || cardinal === 180 || cardinal === 360;
      if (isHorizontal) {
        // Snap Y to match start Y (horizontal line)
        return {
          x: endX,
          y: startY,
          snapped: true,
          snapAxis: 'horizontal'
        };
      } else {
        // Snap X to match start X (vertical line)
        return {
          x: startX,
          y: endY,
          snapped: true,
          snapAxis: 'vertical'
        };
      }
    }
  }

  return { x: endX, y: endY, snapped: false, snapAxis: null };
}

/**
 * Draw a visual guide line on the canvas when angle snapping is active.
 * Draws a dashed line extending across the visible canvas area through
 * the snapped alignment axis.
 */
export function renderAngleSnapGuide(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  snapResult: AngleSnapResult
): void {
  if (!snapResult.snapped || !snapResult.snapAxis) return;

  ctx.save();

  // Style: cyan/teal dashed line
  ctx.strokeStyle = 'rgba(0, 188, 212, 0.7)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);

  // Get canvas dimensions in canvas coordinates (we extend the line far in both directions)
  // Using a large value that will cover any reasonable canvas size
  const extent = 100000;

  ctx.beginPath();

  if (snapResult.snapAxis === 'horizontal') {
    // Horizontal guide: y is fixed at startY, extend left and right
    ctx.moveTo(startX - extent, startY);
    ctx.lineTo(startX + extent, startY);
  } else {
    // Vertical guide: x is fixed at startX, extend up and down
    ctx.moveTo(startX, startY - extent);
    ctx.lineTo(startX, startY + extent);
  }

  ctx.stroke();

  // Draw a small indicator label near the midpoint of the drawn line
  const midX = (startX + snapResult.x) / 2;
  const midY = (startY + snapResult.y) / 2;

  ctx.setLineDash([]);
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const label = snapResult.snapAxis === 'horizontal' ? '0\u00B0' : '90\u00B0';

  // Background pill
  const textMetrics = ctx.measureText(label);
  const pillWidth = textMetrics.width + 10;
  const pillHeight = 18;
  const pillX = snapResult.snapAxis === 'horizontal'
    ? midX - pillWidth / 2
    : startX + 8;
  const pillY = snapResult.snapAxis === 'horizontal'
    ? startY - pillHeight - 4
    : midY - pillHeight / 2;

  ctx.fillStyle = 'rgba(0, 188, 212, 0.85)';
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 4);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.fillText(
    label,
    pillX + pillWidth / 2,
    pillY + pillHeight / 2
  );

  ctx.restore();
}
