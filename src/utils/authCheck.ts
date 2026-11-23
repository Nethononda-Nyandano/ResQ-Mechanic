import { UserRole } from './profileService';

export type ClerkUserType = {
  id?: string;
  firstName?: string | null;
  lastName?: string | null;
  primaryPhoneNumber?: { phoneNumber?: string | null } | null;
  phoneNumbers?: Array<{ phoneNumber?: string | null }> | null;
  unsafeMetadata?: Record<string, any>;
  publicMetadata?: Record<string, any>;
};

export function isProfileComplete(user: ClerkUserType | null | undefined): boolean {
  if (!user) return false;

  const unsafe = (user.unsafeMetadata || {}) as Record<string, any>;
  const pub = (user.publicMetadata || {}) as Record<string, any>;

  const hasPhone = Boolean(
    user.primaryPhoneNumber?.phoneNumber ||
    (user.phoneNumbers && user.phoneNumbers.length > 0) ||
    unsafe.phoneNumber ||
    pub.phoneNumber
  );

  const hasFirstName = Boolean(
    user.firstName?.trim() ||
    unsafe.firstName ||
    pub.firstName
  );

  const hasLastName = Boolean(
    user.lastName?.trim() ||
    unsafe.lastName ||
    pub.lastName
  );

  const isMechanicOnboarded = Boolean(
    unsafe.mechanicOnboarded ||
    unsafe.isProfileComplete ||
    unsafe.onboarded ||
    pub.mechanicOnboarded ||
    pub.isProfileComplete ||
    pub.onboarded
  );

  return hasPhone && hasFirstName && hasLastName && isMechanicOnboarded;
}

export function getUserRole(user: ClerkUserType | null | undefined): UserRole {
  if (!user) return 'mobile_mechanic';
  const role =
    (user.unsafeMetadata as Record<string, any>)?.role ||
    (user.publicMetadata as Record<string, any>)?.role;
  return role === 'fleet_mechanic' ? 'fleet_mechanic' : 'mobile_mechanic';
}
