export const STATUSES = ['Reported', 'Verified', 'Assigned', 'In Progress', 'Resolved'];
export const CATEGORIES = ['pothole', 'streetlight', 'garbage', 'water_leak', 'road_damage', 'other'];
export const DEPARTMENTS = {
  pothole: 'Roads & Highways', road_damage: 'Roads & Highways', streetlight: 'Street Lighting',
  garbage: 'Sanitation', water_leak: 'Water & Sewerage', other: 'General Services',
};
const CATEGORY_WEIGHT = { water_leak: 20, pothole: 16, road_damage: 14, streetlight: 12, garbage: 8, other: 5 };

/** Priority 0-100 = severity (50) + category risk (20) + public-zone proximity (15) + repeat reports (15). */
export function computePriority({ severity, category, near, duplicates = 0 }) {
  const s = Math.max(1, Math.min(10, Number(severity) || 5));
  return Math.min(100, Math.round(s * 5 + (CATEGORY_WEIGHT[category] ?? 5) + (near ? 15 : 0) + Math.min(duplicates, 5) * 3));
}
