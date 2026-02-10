// @ts-nocheck
// Note: Uses @ts-nocheck due to cross-package imports requiring built declarations.

/**
 * Entity Inspector — re-exports from the modular inspector structure.
 *
 * This file maintains backward compatibility with existing imports while
 * the implementation has been split into sub-inspectors under inspectors/.
 */

export { inspectEntity } from './inspectors/index.js';
