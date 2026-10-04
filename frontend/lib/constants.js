export const STATUSES = ['Reported', 'Verified', 'Assigned', 'In Progress', 'Resolved'];
export const CATEGORIES = {
  pothole: 'Pothole', streetlight: 'Broken streetlight', garbage: 'Garbage or dumping',
  water_leak: 'Water leak', road_damage: 'Road damage', other: 'Other',
};
export const STATUS_COLOR = { Reported: '#B7791F', Verified: '#1F5FA8', Assigned: '#6B46C1', 'In Progress': '#0E7C86', Resolved: '#2F855A' };
export const priorityTone = (p) => (p >= 70 ? { label: 'Urgent', c: '#B83A26' } : p >= 45 ? { label: 'High', c: '#C77700' } : { label: 'Routine', c: '#5B6770' });
export const timeAgo = (d) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};
