import type { RescueStatus } from './rescueService';

const allowedTransitions: Partial<Record<RescueStatus, RescueStatus[]>> = {
  assigned: ['arrived', 'cancelled'],
  en_route: ['arrived', 'cancelled'],
  arrived: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
};

export function isValidRescueStatusTransition(
  currentStatus: RescueStatus,
  nextStatus: RescueStatus,
): boolean {
  return allowedTransitions[currentStatus]?.includes(nextStatus) ?? false;
}