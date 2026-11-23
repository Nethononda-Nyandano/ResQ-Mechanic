export function isEligibleForRescueRequest(input: {
  rescueType: string | null | undefined;
  serviceTypes: string[];
  mechanicStatus: 'online' | 'busy' | 'offline';
  hasActiveJob: boolean;
}): boolean {
  return Boolean(
    input.rescueType &&
      input.mechanicStatus === 'online' &&
      !input.hasActiveJob &&
      input.serviceTypes.includes(input.rescueType),
  );
}