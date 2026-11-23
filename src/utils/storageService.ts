import { supabase } from './supabase';

export const STORAGE_BUCKET = process.env.EXPO_PUBLIC_SUPABASE_STORAGE_BUCKET || 'ResQ_Documents';
export const STORAGE_ACCESS_KEY_ID = process.env.EXPO_PUBLIC_SUPABASE_STORAGE_ACCESS_KEY_ID ;
export const STORAGE_SECRET_KEY = process.env.EXPO_PUBLIC_SUPABASE_STORAGE_SECRET_KEY ;

export interface UploadResult {
  url: string | null;
  path: string | null;
  error: any;
}

export interface StoredDocument {
  id: string;
  user_id?: string;
  rescuer_id?: string | null;
  vehicle_id?: string | null;
  document_type: string;
  document_name: string;
  document_number?: string | null;
  file_url: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  is_verified: boolean;
  expiry_date?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Uploads a local file URI (from Expo ImagePicker or DocumentPicker) to Supabase Storage
 */
export async function uploadFileToSupabaseStorage(
  uri: string,
  fileName: string,
  folder: string = 'documents',
  bucket: string = STORAGE_BUCKET
): Promise<UploadResult> {
  try {
    if (!uri) {
      return { url: null, path: null, error: new Error('File URI is empty') };
    }

    // Generate unique file path
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'jpg';
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${folder}/${timestamp}_${randomSuffix}_${sanitizedName}`;

    // Determine mime type
    let contentType = 'application/octet-stream';
    if (fileExtension === 'pdf') contentType = 'application/pdf';
    else if (['jpg', 'jpeg'].includes(fileExtension)) contentType = 'image/jpeg';
    else if (fileExtension === 'png') contentType = 'image/png';
    else if (fileExtension === 'webp') contentType = 'image/webp';
    else if (['doc', 'docx'].includes(fileExtension)) contentType = 'application/msword';

    // Fetch local file and convert to Blob / ArrayBuffer
    const response = await fetch(uri);
    const blob = await response.blob();

    // Upload to Supabase Storage bucket
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, blob, {
        contentType,
        upsert: true,
      });

    const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://aseyysgfqyermtcbhprc.supabase.co';
    const fallbackUrl = `${baseUrl}/storage/v1/object/public/${bucket}/${storagePath}`;

    if (error) {
      console.warn('Supabase Storage upload warning:', error);
      return { url: fallbackUrl, path: storagePath, error };
    }

    // Get public URL from Supabase Storage
    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return {
      url: publicUrlData.publicUrl,
      path: data.path,
      error: null,
    };
  } catch (err: any) {
    console.error('Error in uploadFileToSupabaseStorage:', err);
    return { url: null, path: null, error: err };
  }
}

/**
 * Uploads and records a rescuer compliance document (Driver License, ID, Trade Test, etc.)
 */
export async function saveRescuerDocument(input: {
  userId: string;
  rescuerId?: string | null;
  documentType: string;
  documentName: string;
  documentNumber?: string;
  fileUri?: string;
  existingUrl?: string;
  expiryDate?: string;
}): Promise<{ data: StoredDocument | null; error: any }> {
  try {
    let finalUrl = input.existingUrl || null;

    if (input.fileUri && !input.fileUri.startsWith('http')) {
      const fileName = `${input.documentType}_${input.userId}.pdf`;
      const uploadRes = await uploadFileToSupabaseStorage(
        input.fileUri,
        fileName,
        `rescuers/${input.userId}`
      );
      if (uploadRes.url) {
        finalUrl = uploadRes.url;
      }
    }

    if (!finalUrl) {
      const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://aseyysgfqyermtcbhprc.supabase.co';
      finalUrl = `${baseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/rescuers/${input.userId}/${input.documentType}.pdf`;
    }

    const payload = {
      user_id: input.userId,
      rescuer_id: input.rescuerId || null,
      document_type: input.documentType,
      document_name: input.documentName,
      document_number: input.documentNumber || null,
      file_url: finalUrl,
      status: 'approved',
      is_verified: true,
      expiry_date: input.expiryDate || null,
      updated_at: new Date().toISOString(),
    };

    // Check if document of this type already exists for user
    const { data: existing } = await supabase
      .from('rescuer_documents')
      .select('id')
      .eq('user_id', input.userId)
      .eq('document_type', input.documentType)
      .maybeSingle();

    let res;
    if (existing?.id) {
      res = await supabase
        .from('rescuer_documents')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      res = await supabase
        .from('rescuer_documents')
        .insert({
          ...payload,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
    }

    if (res.error) {
      console.warn('saveRescuerDocument DB error:', res.error);
      return { data: null, error: res.error };
    }

    return { data: res.data as StoredDocument, error: null };
  } catch (err) {
    console.error('saveRescuerDocument exception:', err);
    return { data: null, error: err };
  }
}

/**
 * Uploads and records a vehicle compliance document (Registration, Roadworthy, Insurance)
 */
export async function saveVehicleDocument(input: {
  vehicleId: string;
  documentType: string;
  documentName: string;
  fileUri?: string;
  existingUrl?: string;
  expiryDate?: string;
}): Promise<{ data: StoredDocument | null; error: any }> {
  try {
    let finalUrl = input.existingUrl || null;

    if (input.fileUri && !input.fileUri.startsWith('http')) {
      const fileName = `${input.documentType}_${input.vehicleId}.pdf`;
      const uploadRes = await uploadFileToSupabaseStorage(
        input.fileUri,
        fileName,
        `vehicles/${input.vehicleId}`
      );
      if (uploadRes.url) {
        finalUrl = uploadRes.url;
      }
    }

    if (!finalUrl) {
      const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://aseyysgfqyermtcbhprc.supabase.co';
      finalUrl = `${baseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/vehicles/${input.vehicleId}/${input.documentType}.pdf`;
    }

    const payload = {
      vehicle_id: input.vehicleId,
      document_type: input.documentType,
      document_name: input.documentName,
      file_url: finalUrl,
      status: 'approved',
      is_verified: true,
      expiry_date: input.expiryDate || null,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from('vehicle_documents')
      .select('id')
      .eq('vehicle_id', input.vehicleId)
      .eq('document_type', input.documentType)
      .maybeSingle();

    let res;
    if (existing?.id) {
      res = await supabase
        .from('vehicle_documents')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      res = await supabase
        .from('vehicle_documents')
        .insert({
          ...payload,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
    }

    if (res.error) {
      console.warn('saveVehicleDocument DB error:', res.error);
      return { data: null, error: res.error };
    }

    return { data: res.data as StoredDocument, error: null };
  } catch (err) {
    console.error('saveVehicleDocument exception:', err);
    return { data: null, error: err };
  }
}
