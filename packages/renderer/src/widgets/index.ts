/**
 * Renderer widgets module.
 * Provides reusable visual components for panels.
 */

export {
  generateCoatOfArms,
  evolveCoatOfArms,
  renderLargeCoatOfArms,
  renderSmallCoatOfArms,
  renderInlineCoatOfArms,
  renderCoatOfArms,
  describeCoatOfArms,
  getShieldShape,
  TINCTURES,
  ALL_CHARGES,
  ANIMAL_CHARGES,
  WEAPON_CHARGES,
  NATURE_CHARGES,
  RELIGIOUS_CHARGES,
} from './heraldry.js';

export type {
  ShieldShape,
  FieldDivision,
  ChargeCategory,
  Charge,
  Tincture,
  CoatOfArms,
  HeraldryEvent,
  FactionProperties,
  DisplaySize,
} from './heraldry.js';
