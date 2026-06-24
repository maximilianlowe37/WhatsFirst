// Centralized urgency color logic for task cards.
import { Urgency } from '@/types';

export function urgencyColor(urgency: Urgency, dueDate: string | null): string {
  if (!dueDate) return '#9CA3AF';

  const now = new Date();
  const due = new Date(dueDate + 'T23:59:59');
  const diffMs = due.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  // Overdue (past) — grey
  if (diffHours < 0) return '#9CA3AF';

  // RED: high urgency AND due within 24h
  if (urgency === 'high' && diffHours <= 24) return '#EF4444';

  // ORANGE: medium urgency OR due within 48h (but not red)
  if (urgency === 'medium' || diffHours <= 48) return '#F97316';

  // GREEN: low urgency AND due more than 48h away
  if (urgency === 'low' && diffHours > 48) return '#22C55E';

  return '#9CA3AF';
}

export function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  return due < today;
}
