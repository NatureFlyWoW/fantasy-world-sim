/**
 * Template index - exports all narrative templates.
 */

export * from './types.js';

import type { NarrativeTemplate } from './types.js';
import { politicalTemplates } from './political.js';
import { militaryTemplates } from './military.js';
import { personalTemplates } from './personal.js';
import { magicalTemplates } from './magical.js';
import { religiousTemplates } from './religious.js';
import { culturalTemplates } from './cultural.js';
import { economicTemplates } from './economic.js';
import { disasterTemplates } from './disaster.js';
import { secretTemplates } from './secret.js';
import { ecologicalTemplates } from './ecological.js';
import { characterActionTemplates } from './character-actions.js';

/**
 * All narrative templates combined.
 */
export const ALL_TEMPLATES: readonly NarrativeTemplate[] = [
  ...politicalTemplates,
  ...militaryTemplates,
  ...personalTemplates,
  ...magicalTemplates,
  ...religiousTemplates,
  ...culturalTemplates,
  ...economicTemplates,
  ...disasterTemplates,
  ...secretTemplates,
  ...ecologicalTemplates,
  ...characterActionTemplates,
];

// Re-export individual template collections
export {
  politicalTemplates,
  militaryTemplates,
  personalTemplates,
  magicalTemplates,
  religiousTemplates,
  culturalTemplates,
  economicTemplates,
  disasterTemplates,
  secretTemplates,
  ecologicalTemplates,
  characterActionTemplates,
};

/**
 * Get the count of templates by category.
 */
export function getTemplateStats(): {
  total: number;
  byCategory: Record<string, number>;
} {
  const byCategory: Record<string, number> = {};

  for (const template of ALL_TEMPLATES) {
    const category = template.category;
    byCategory[category] = (byCategory[category] ?? 0) + 1;
  }

  return {
    total: ALL_TEMPLATES.length,
    byCategory,
  };
}
