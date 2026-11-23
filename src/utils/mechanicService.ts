/* eslint-disable no-unreachable */
import { supabase } from './supabase';
import { saveRescuerDocument } from './storageService';


export type MechanicStatus = 'online' | 'busy' | 'offline';
export type MechanicType = 'mobile_mechanic' | 'fleet_mechanic';



export interface OnboardMechanicInput {
  userId: string;
  mechanicType: MechanicType;
  fullName: string;
  phoneNumber: string;
  avatarUrl?: string | null;
  serviceTypes: string[];
  garageName?: string | null;
  latitude?: number;
  longitude?: number;
  tradeCertNumber?: string;
  driverLicenseNumber?: string;
  driverLicenseDocUri?: string;
  idDocUri?: string;
  tradeCertDocUri?: string;
  fleetCompany?: string;
  fleetId?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  vehiclePlate?: string;
  vehicleColor?: string;
  vehicleType?: string;
  fuelType?: string;
}

/**
 * Upserts a rescuer / mechanic record in Supabase
 * Differentiates rescuer data (in `rescuers` table) and vehicle data (in `vehicles` table)
 */
export async function saveRescuerProfile(input: OnboardMechanicInput){
  try {
    const rescuerPayload: any = {
      user_id: input.userId,
      mechanic_type: input.mechanicType,
      full_name: input.fullName,
      phone_number: input.phoneNumber,
      avatar_url: input.avatarUrl || null,
      status: 'online',
      service_types: input.serviceTypes.length > 0 ? input.serviceTypes : ['tow', 'tyre', 'fuel', 'battery'],
      garage_name: input.garageName?.trim() || 'Independent ResQ Responder',
      vehicle_make: input.vehicleMake || 'Isuzu',
      vehicle_model: input.vehicleModel || input.vehicleType || 'NPR 400 Mobile Service Unit',
      vehicle_plate: input.vehiclePlate || null,
      vehicle_color: input.vehicleColor || 'White',
      current_latitude: input.latitude !== undefined ? input.latitude : -26.2041,
      current_longitude: input.longitude !== undefined ? input.longitude : 28.0473,
      garage_latitude: input.latitude !== undefined ? input.latitude : -26.2041,
      garage_longitude: input.longitude !== undefined ? input.longitude : 28.0473,
      is_verified: true,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from('rescuers')
      .select('id')
      .eq('user_id', input.userId)
      .maybeSingle();

    let res;
    if (existing?.id) {
      res = await supabase
        .from('rescuers')
        .update(rescuerPayload)
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      res = await supabase
        .from('rescuers')
        .insert({
          ...rescuerPayload,
          rating: 4.9,
          total_rescues: 0,
        })
        .select()
        .single();
    }

    if (res.error) {
      console.warn('Supabase rescuer profile save error:', res.error);
      return { data: null, error: res.error };
    }

   const rescuerId = res.data?.id;

    if (input.driverLicenseNumber || input.driverLicenseDocUri) {
      await saveRescuerDocument({
        userId: input.userId,
        rescuerId,
        documentType: 'driver_license',
        documentName: "Driver's License (Code 10/14)",
        documentNumber: input.driverLicenseNumber || undefined,
        fileUri: input.driverLicenseDocUri,
      });
    }

    if (input.idDocUri) {
      await saveRescuerDocument({
        userId: input.userId,
        rescuerId,
        documentType: 'national_id',
        documentName: 'National ID / Passport',
        fileUri: input.idDocUri,
      });
    }

    if (input.tradeCertNumber || input.tradeCertDocUri) {
      await saveRescuerDocument({
        userId: input.userId,
        rescuerId,
        documentType: 'trade_certificate',
        documentName: 'Certified Mechanic Trade Test Certificate',
        documentNumber: input.tradeCertNumber || undefined,
        fileUri: input.tradeCertDocUri,
      });
    }

    if (input.vehicleMake || input.vehiclePlate) {
      const { data: existingVehicle } = await supabase
        .from('vehicles')
        .select('id')
        .eq('user_id', input.userId)
        .eq('is_rescuer_vehicle', true)
        .maybeSingle();

      const vehiclePayload = {
        user_id: input.userId,
        make: input.vehicleMake || 'Isuzu',
        model: input.vehicleModel || input.vehicleType || 'Service Unit',
        year: input.vehicleYear || String(new Date().getFullYear()),
        reg_no: input.vehiclePlate || 'PENDING',
        color: input.vehicleColor || 'White',
        fuel_type: input.fuelType || 'Diesel',
        vehicle_type: input.vehicleType || 'service_van',
        is_rescuer_vehicle: true,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (existingVehicle?.id) {
        await supabase.from('vehicles').update(vehiclePayload).eq('id', existingVehicle.id);
        await supabase.from('rescuers').update({ vehicle_id: existingVehicle.id }).eq('id', rescuerId);
      } else {
        const inserted = await supabase.from('vehicles').insert(vehiclePayload).select('id').single();
        if (inserted.data?.id) {
          await supabase.from('rescuers').update({ vehicle_id: inserted.data.id }).eq('id', rescuerId);
        }
      }
    }

    return { success:true, error: null };
  } catch (err: any) {
    console.error('saveRescuerProfile exception:', err);
    return { data: null, error: err };
  }
}

/**
 * Get rescuer profile by Clerk user ID, joined with vehicle details
 */

export interface techData{
  userId: string;
  name: string;
}

export async function getRescuerByUserId(userId: string){
  try {
    const { data, error } = await supabase
      .from('rescuers')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    return {data:data ,error: null};



  } catch (err: any) {
    console.error('getRescuerByUserId exception:', err);
    return { data: null, error: err };
  }
}



/**
 * Updates mechanic online / busy / offline status
 */
export async function setMechanicStatus(
  userId: string,
  status: MechanicStatus
): Promise<{ success: boolean; error: any }> {
  try {
    const { error } = await supabase
      .from('rescuers')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (error) return { success: false, error };
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

export async function updateMechanicLocation(userId: string, latitude: number, longitude: number, heading: number = 0): Promise<{ success: boolean; error: any }> {
  try {
    const { error } = await supabase
      .from('rescuers')
      .update({
        current_latitude: latitude,
        current_longitude: longitude,
        heading,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      return { success: false, error };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

export async function getMechanicVehicle(user_id: string) {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('user_id', user_id)
    .eq('is_rescuer_vehicle', true)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: [], error };
  }
  return { data: data || [], error: null };
}