import { supabase } from './supabase';

export type UserRole =
  | 'mobile_mechanic'
  | 'fleet_mechanic'
  | 'fleet_admin'
  | 'admin'
  | 'client';

export interface ProfileRecord {
  id: string; // Clerk user id or custom fleet mechanic id
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  phone_number: string | null;
  role: UserRole;
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SaveProfileInput {
  userId: string;
  email?: string | null;
  firstName: string;
  lastName: string;
  fullName?: string;
  phoneNumber: string;
  role: UserRole;
  avatarUrl?: string | null;
}

/**
 * Creates or updates user profile in Supabase db
 */
export async function saveUserProfileToSupabase(
  input: SaveProfileInput
): Promise<{ data: ProfileRecord | null; error: any }> {
  try {
    const payload: Partial<ProfileRecord> = {
      id: input.userId,
      user_id: input.userId,
      email: input.email || null,
      first_name: input.firstName,
      last_name: input.lastName,
      full_name: input.fullName || `${input.firstName} ${input.lastName}`.trim(),
      phone_number: input.phoneNumber,
      role: input.role,
      avatar_url: input.avatarUrl || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.warn('Supabase profile upsert warning:', error.message || error);
      return { data: null, error };
    }

    return { data: data as ProfileRecord, error: null };
  } catch (err: any) {
    console.error('saveUserProfileToSupabase exception:', err);
    return { data: null, error: err };
  }
}

/**
 * Fetch profile from Supabase using user ID
 */
export async function getUserProfileFromSupabase(
  userId: string
): Promise<{ data: ProfileRecord | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Supabase fetch profile warning:', error.message || error);
      return { data: null, error };
    }

    return { data: data as ProfileRecord | null, error: null };
  } catch (err: any) {
    console.error('getUserProfileFromSupabase exception:', err);
    return { data: null, error: err };
  }
}
