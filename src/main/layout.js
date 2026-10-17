'use strict';
// Dock geometry. Pure functions, no Electron.

const BUBBLE = 56; // bubble diameter
const GAP = 12; // space between bubbles
const PAD = 14; // room around the column for badges and shadows
const PREVIEW_W = 300; // preview card width (incl. gap to the bubble)
const COLUMN_W = BUBBLE + PAD * 2;

/** Height of the bubble column for n visible bubbles. */
function columnHeight(n) {
  const k = Math.max(1, n);
  return k * BUBBLE + (k - 1) * GAP + PAD * 2;
}

/** Y offset (inside the dock) of the top of bubble i. */
function bubbleTop(i) {
  return PAD + i * (BUBBLE + GAP);
}

/**
 * Dock window size.
 * @param n visible bubbles (in merged mode and collapsed: 1)
 * @param extra {previewHeight, previewIndex} when a preview card is shown
 */
function dockSize(n, extra = {}) {
  let width = COLUMN_W;
  let height = columnHeight(n);
  if (extra.previewHeight) {
    width += PREVIEW_W;
    // extra room below the card for its shadow
    height = Math.max(height, bubbleTop(extra.previewIndex || 0) + extra.previewHeight + PAD * 2);
  }
  return { width, height };
}

function clamp(v, lo, hi) {
  return Math.min(Math.max(v, lo), Math.max(lo, hi));
}

/**
 * Where the dock sits: hugging the left or right edge of the work area.
 * @param pos {edge:'left'|'right', y}
 */
function dockBounds(pos, size, workArea) {
  const x = pos.edge === 'left' ? workArea.x : workArea.x + workArea.width - size.width;
  const y = clamp(Math.round(pos.y ?? workArea.y + workArea.height * 0.3), workArea.y, workArea.y + workArea.height - size.height);
  return { x, y, width: size.width, height: size.height };
}

/** After a drag, snap to the nearest side of the display. */
function snapToEdge(bounds, workArea) {
  const cx = bounds.x + bounds.width / 2;
  const edge = cx < workArea.x + workArea.width / 2 ? 'left' : 'right';
  const y = clamp(bounds.y, workArea.y, workArea.y + workArea.height - bounds.height);
  return { edge, y };
}

/**
 * Popup next to the dock, on the inner side, top aligned with the clicked
 * bubble and kept inside the work area.
 */
function popupBounds(dock, edge, anchorY, size, workArea) {
  const width = Math.min(size.width, workArea.width - COLUMN_W);
  const height = Math.min(size.height, workArea.height);
  const x = edge === 'left' ? dock.x + COLUMN_W : dock.x + dock.width - COLUMN_W - width;
  const y = clamp(Math.round(anchorY - 20), workArea.y, workArea.y + workArea.height - height);
  return { x: clamp(x, workArea.x, workArea.x + workArea.width - width), y, width, height };
}

/** Pointer moved far enough to count as a drag (not a click). */
function isDrag(dx, dy, threshold = 4) {
  return Math.abs(dx) > threshold || Math.abs(dy) > threshold;
}

module.exports = { BUBBLE, GAP, PAD, PREVIEW_W, COLUMN_W, columnHeight, bubbleTop, dockSize, dockBounds, snapToEdge, popupBounds, isDrag, clamp };
