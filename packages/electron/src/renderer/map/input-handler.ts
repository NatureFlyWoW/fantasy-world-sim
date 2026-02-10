/**
 * Map input handler — keyboard, scroll wheel, and click-drag.
 *
 * Binds to the document (keyboard) and canvas (mouse) and delegates
 * pan/zoom to the Viewport.
 */
import { TILE_W, TILE_H } from './glyph-atlas.js';
import type { Viewport } from './viewport.js';

const PAN_SPEED = 3; // tiles per keypress

export interface InputCallbacks {
  onDirty: () => void;
  onCycleOverlay?: () => void;
}

/**
 * Binds keyboard and mouse input to the Viewport.
 * Returns a cleanup function to remove all listeners.
 */
export function bindMapInput(
  viewport: Viewport,
  canvas: HTMLCanvasElement,
  callbacks: InputCallbacks,
): () => void {
  const { onDirty, onCycleOverlay } = callbacks;

  // ── Keyboard ──────────────────────────────────────────────────────────

  function handleKeyDown(e: KeyboardEvent): void {
    // Don't handle if typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    let handled = true;
    switch (e.code) {
      case 'ArrowUp':    case 'KeyW': viewport.pan(0, -PAN_SPEED); break;
      case 'ArrowDown':  case 'KeyS': viewport.pan(0, PAN_SPEED);  break;
      case 'ArrowLeft':  case 'KeyA': viewport.pan(-PAN_SPEED, 0); break;
      case 'ArrowRight': case 'KeyD': viewport.pan(PAN_SPEED, 0);  break;
      case 'Equal': case 'NumpadAdd':     viewport.zoomIn();  break;
      case 'Minus': case 'NumpadSubtract': viewport.zoomOut(); break;
      case 'KeyO':
        if (onCycleOverlay !== undefined) onCycleOverlay();
        break;
      default: handled = false;
    }
    if (handled) {
      e.preventDefault();
      onDirty();
    }
  }

  // ── Mouse scroll (zoom) ───────────────────────────────────────────────

  function handleWheel(e: WheelEvent): void {
    e.preventDefault();
    if (e.deltaY < 0) {
      viewport.zoomIn();
    } else {
      viewport.zoomOut();
    }
    onDirty();
  }

  // ── Click-drag (pan) ──────────────────────────────────────────────────

  let dragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  function handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return; // left click only
    dragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    canvas.style.cursor = 'grabbing';
  }

  function handleMouseMove(e: MouseEvent): void {
    if (!dragging) return;
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    // Convert pixel delta to tile delta (negative: dragging moves view opposite)
    // viewport.pan() already multiplies by zoom, so don't apply zoom here
    const tileDx = -dx / TILE_W;
    const tileDy = -dy / TILE_H;
    viewport.pan(tileDx, tileDy);
    onDirty();
  }

  function handleMouseUp(): void {
    if (!dragging) return;
    dragging = false;
    canvas.style.cursor = 'default';
  }

  // ── Bind events ───────────────────────────────────────────────────────

  document.addEventListener('keydown', handleKeyDown);
  canvas.addEventListener('wheel', handleWheel, { passive: false });
  canvas.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  // Return cleanup function
  return () => {
    document.removeEventListener('keydown', handleKeyDown);
    canvas.removeEventListener('wheel', handleWheel);
    canvas.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
}
