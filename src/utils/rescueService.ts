import { supabase } from './supabase';
import { isValidRescueStatusTransition } from './rescueStatus';

export type RescueType = 'tow' | 'tyre' | 'fuel' | 'battery' | 'diagnostics';
export type RescueStatus =
  | 'pending'
  | 'searching'
  | 'assigned'
  | 'en_route'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface RescueRequestRecord {
  id: string;
  user_id: string;
  rescuer_id?: string | null;
  vehicle_id?: string | null;
  rescue_type: RescueType;
  payment_method: string;
  pickup_latitude: number;
  pickup_longitude: number;
  pickup_address?: string | null;
  destination_latitude?: number | null;
  destination_longitude?: number | null;
  destination_address?: string | null;
  distance_km?: number | null;
  notes?: string | null;
  status: RescueStatus;
  estimated_price?: number | null;
  fuel_type?: string | null;
  fuel_litres?: number | null;
  tyre_size?: string | null;
  has_spare_wheel?: boolean;
  battery_action?: string | null;
  created_at: string;
  updated_at?: string;

  client_name?: string;
  client_phone?: string;
  client_avatar?: string | null;
  vehicle_info?: string;
  vehicle_plate?: string;
  vehicle_color?: string;
}

/**
 * Helper to enrich rescue requests with customer profile and vehicle info
 */
export async function enrichRescueRequests(
  requests: any[]
): Promise<RescueRequestRecord[]> {
  if (!requests || requests.length === 0) return [];

  const enriched = await Promise.all(
    requests.map(async (req) => {
      let client_name = 'Customer';
      let client_phone = '';
      let client_avatar = null;
      let vehicle_info = 'Standard Vehicle';
      let vehicle_plate = '';
      let vehicle_color = '';

      try {
        if (req.user_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, phone_number, avatar_url')
            .eq('id', req.user_id)
            .maybeSingle();

          if (profile) {
            const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
            if (fullName) client_name = fullName;
            client_phone = profile.phone_number || '';
            client_avatar = profile.avatar_url || null;
          }
        }

        if (req.vehicle_id) {
          const { data: vehicle } = await supabase
            .from('vehicles')
            .select('make, model, year, reg_no, color')
            .eq('id', req.vehicle_id)
            .maybeSingle();

          if (vehicle) {
            vehicle_info = `${vehicle.year ? vehicle.year + ' ' : ''}${vehicle.make || ''} ${vehicle.model || ''}`.trim();
            vehicle_plate = (vehicle as any).reg_no || (vehicle as any).license_plate || '';
            vehicle_color = vehicle.color || '';
          }
        } else if (req.user_id) {
          // Fallback to customer's active vehicle if vehicle_id not explicitly set
          const { data: vehicle } = await supabase
            .from('vehicles')
            .select('make, model, year, reg_no, color')
            .eq('user_id', req.user_id)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (vehicle) {
            vehicle_info = `${vehicle.year ? vehicle.year + ' ' : ''}${vehicle.make || ''} ${vehicle.model || ''}`.trim();
            vehicle_plate = (vehicle as any).reg_no || (vehicle as any).license_plate || '';
            vehicle_color = vehicle.color || '';
          }
        }
      } catch (err) {
        console.warn('Error enriching rescue request:', err);
      }

      return {
        ...req,
        client_name,
        client_phone,
        client_avatar,
        vehicle_info,
        vehicle_plate,
        vehicle_color,
      } as RescueRequestRecord;
    })
  );

  return enriched;
}

/**
 * Fetch open emergency requests available for dispatch
 */
export async function getOpenRescueRequests(): Promise<{
  data: RescueRequestRecord[];
  error: any;
}> {
  try {
    const { data, error } = await supabase
      .from('rescue_requests')
      .select('*')
      .in('status', ['pending', 'searching'])
      .order('created_at', { ascending: false });

            if (error) {
                console.warn('Error fetching open rescue requests:', error);
                return { data: [], error };
            }

            const enriched = await enrichRescueRequests(data || []);
            return { data: enriched, error: null };
        } catch (err: any) {
            return { data: [], error: err };
        }
}

export function subscribeToRescueRequestChanges(onChange: () => void): () => void {
  const channel = supabase
    .channel(`rescue-requests-feed-${Date.now()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rescue_requests' },
      () => onChange()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Fetch active rescue request assigned to this rescuer/mechanic
 */
export async function getActiveRescueRequest(
  rescuerId: string
): Promise<{ data: RescueRequestRecord | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('rescue_requests')
      .select('*')
      .eq('rescuer_id', rescuerId)
      .in('status', ['assigned', 'en_route', 'arrived', 'in_progress'])
      .order('updated_at', { ascending: false })
      .maybeSingle();

    if (error) {
      console.warn('Error fetching active rescue request:', error);
      return { data: null, error };
    }

    if (!data) return { data: null, error: null };

    const enrichedList = await enrichRescueRequests([data]);
    return { data: enrichedList[0] || null, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

/**
 * Accept a rescue request
 */
export async function acceptRescueRequest(
  requestId: string,
  rescuerId: string
): Promise<{ success: boolean; data?: RescueRequestRecord; error?: any }> {
  try {
    const { data, error } = await supabase
      .from('rescue_requests')
      .update({
        rescuer_id: rescuerId,
        status: 'en_route',
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .in('status', ['pending', 'searching'])
      .select()
      .maybeSingle();

    if (error) {
      return { success: false, error };
    }

    if (!data) {
      return { success: false, error: { message: 'This request was already taken or cancelled.' } };
    }

    // Also mark mechanic status as busy
    await supabase
      .from('rescuers')
      .update({ status: 'busy', updated_at: new Date().toISOString() })
      .eq('id', rescuerId);

    const enrichedList = await enrichRescueRequests([data]);
    return { success: true, data: enrichedList[0] };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

/**
 * Update step of a rescue request
 */
export async function updateRescueStatus(
  requestId: string,
  rescuerId: string,
  currentStatus: RescueStatus,
  newStatus: RescueStatus,
  additionalDetails?: { notes?: string; finalPrice?: number }
): Promise<{ success: boolean; data?: RescueRequestRecord; error?: any }> {
  try {
    if (!isValidRescueStatusTransition(currentStatus, newStatus)) {
      return { success: false, error: { message: 'This job status can no longer be updated. Refresh and try again.' } };
    }

    const payload: any = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (additionalDetails?.notes) {
      payload.notes = additionalDetails.notes;
    }
    if (additionalDetails?.finalPrice) {
      payload.estimated_price = additionalDetails.finalPrice;
    }

    const { data, error } = await supabase
      .from('rescue_requests')
      .update(payload)
      .eq('id', requestId)
      .eq('rescuer_id', rescuerId)
      .eq('status', currentStatus)
      .select()
      .maybeSingle();

    if (error) {
      return { success: false, error };
    }
    if (!data) {
      return {
        success: false,
        error: { message: 'This job changed before your update was saved. The latest status is being refreshed.' },
      };
    }

    // If job is completed or cancelled, set rescuer back to online
    if (newStatus === 'completed' || newStatus === 'cancelled') {
      const { data: rescuer } = await supabase
        .from('rescuers')
        .select('total_rescues')
        .eq('id', rescuerId)
        .maybeSingle();
      const nextCount = newStatus === 'completed' ? Number(rescuer?.total_rescues || 0) + 1 : Number(rescuer?.total_rescues || 0);
      await supabase
        .from('rescuers')
        .update({
          status: 'online',
          total_rescues: nextCount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rescuerId);
    }

    const enrichedList = await enrichRescueRequests([data]);
    return { success: true, data: enrichedList[0] };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

/**
 * Fetch rescue history for a rescuer/mechanic
 */
export async function getRescuerHistory(
  rescuerId: string
): Promise<{ data: RescueRequestRecord[]; error: any }> {
  try {
    const { data, error } = await supabase
      .from('rescue_requests')
      .select('*')
      .eq('rescuer_id', rescuerId)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false });

    if (error) {
      return { data: [], error };
    }

    const enriched = await enrichRescueRequests(data || []);
    return { data: enriched, error: null };
  } catch (err: any) {
    return { data: [], error: err };
  }
}
