# Troubleshooting: Blank/Broken Map Rendering (Phase 9.1)

## Symptoms
- Electron app launches, UI chrome renders (topbar, panels, statusbar)
- PixiJS canvas shows only BG0 background — no terrain, no glyphs
- Status bar stuck at initial values (Tick: 0, Entities: 0, FPS: --)

## Root Causes Found (3 issues)

### 1. Preload Script ESM/CJS Mismatch
- **Error**: `require() of ES Module preload.js not supported`
- **Cause**: Package has `"type": "module"`, so `dist/preload/preload.js` is ESM. But Electron's preload context uses `require()` (CJS).
- **Fix**: Bundle preload with esbuild as CJS → `preload.cjs`
  ```bash
  esbuild src/preload/preload.ts --bundle --platform=node --format=cjs --outfile=dist/preload/preload.cjs --external:electron
  ```
- **Impact**: Without preload, `window.aeternum` is undefined → IPC fails → no snapshot → no rendering

### 2. PixiJS CSP `unsafe-eval` Blocked
- **Error**: `Current environment does not allow unsafe-eval, please use pixi.js/unsafe-eval module`
- **Cause**: `<meta http-equiv="Content-Security-Policy">` in index.html has `script-src 'self'` — no `unsafe-eval`. PixiJS WebGL shader compiler uses `eval()`.
- **Fix**: Import `pixi.js/unsafe-eval` before creating Application (provides eval-free shader compilation)
  ```typescript
  import 'pixi.js/unsafe-eval';
  import { Application } from 'pixi.js';
  ```
- **Impact**: PixiJS Application.init() throws → entire renderer init fails

### 3. Wrong PixiJS v8 TextureSource Type for Canvas
- **Error**: Glyphs invisible — only bg rectangles render, no ASCII characters
- **Cause**: Used generic `TextureSource` for HTMLCanvasElement. PixiJS v8 requires type-specific sources: `CanvasSource` for canvas, `ImageSource` for images.
- **Fix**:
  ```typescript
  // Wrong:
  const source = new TextureSource({ resource: canvas, scaleMode: 'nearest' });
  // Correct:
  const source = new CanvasSource({ resource: canvas, scaleMode: 'nearest' });
  ```

## Additional Fixes
- **`Graphics.fill(number)`** → **`Graphics.fill({ color: number })`** — v8 API requires object form
- **`e.tick`** → **`e.timestamp`** — WorldEvent uses `timestamp` not `tick` property

## Debugging Process
1. **Screenshot analysis** → Status bar values revealed init() never completed
2. **Added diagnostic console.logs** to renderer init flow → pinpointed failure at PixiJS init
3. **User provided DevTools console output** → revealed exact error messages
4. **Fixed in order of dependency**: preload CJS → CSP/unsafe-eval → TextureSource type
5. **Rebuild cycle**: `tsc` (main) + `esbuild` (preload) + `vite build` (renderer) + `electron .`

## Key Lesson
Always check the **DevTools console** (Ctrl+Shift+I) in Electron renderer. Errors are swallowed by async init patterns — the UI renders but functionality silently fails.
