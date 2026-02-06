/**
 * Controls module - Simulation controls for the CLI.
 * Provides time controls, focus management, bookmarks, and notifications.
 */

// Time controls
export {
  SimulationTimeControls,
  SimulationSpeed,
  type StepUnit,
  type SpeedChangeCallback,
  type AutoSlowdownConfig,
} from './time-controls.js';

// Focus manager
export {
  FocusManager,
  type FocusPosition,
  type FocusConfig,
  type FocusChangeCallback,
} from './focus.js';

// Bookmark manager
export {
  BookmarkManager,
  type BookmarkType,
  type Bookmark,
  type BookmarkAlert,
  type BookmarkAlertCallback,
  type BookmarkChangeCallback,
} from './bookmarks.js';

// Notification manager
export {
  NotificationManager,
  type NotificationPriority,
  type NotificationEntry,
  type NotificationConfig,
  type NotificationDisplayCallback,
} from './notification.js';
