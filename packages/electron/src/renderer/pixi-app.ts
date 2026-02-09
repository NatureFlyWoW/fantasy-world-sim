/**
 * PixiJS Application wrapper.
 *
 * Phase 0: mounts a dark background canvas. Map rendering added in Phase 1.
 */
import 'pixi.js/unsafe-eval';
import { Application } from 'pixi.js';

let pixiApp: Application | null = null;

export async function initPixiApp(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
): Promise<Application> {
  const app = new Application();

  await app.init({
    canvas,
    resizeTo: container,
    backgroundColor: 0x0c0c14, // --bg0
    antialias: false,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  pixiApp = app;
  return app;
}

export function getPixiApp(): Application | null {
  return pixiApp;
}
