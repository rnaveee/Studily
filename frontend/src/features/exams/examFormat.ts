export function dayCountLabel(daysLeft: number): string {
  if (daysLeft <= 0) return "Today";
  if (daysLeft === 1) return "Tomorrow";
  return `${daysLeft} days`;
}
