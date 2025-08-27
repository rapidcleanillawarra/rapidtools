// Workshop service for Supabase operations
import { supabase } from '$lib/supabase';
import type { Customer } from './customers';
import { currentUser } from '$lib/firebase';
import { get } from 'svelte/store';

// Workshop form data interface
export interface WorkshopFormData {
  // Machine Information
  locationOfRepair: 'Site' | 'Workshop';
  productName: string;
  clientsWorkOrder: string;
  makeModel: string;
  serialNumber: string;
  siteLocation: string; // Now optional
  faultDescription: string;

  // User Information
  customerName: string;
  contactEmail: string;
  contactNumber: string;
  selectedCustomer: Customer | null;
  optionalContacts: Array<{
    name: string;
    number: string;
    email: string;
  }>;

  // Photos (File objects)
  photos: File[];

  // Workflow tracking
  startedWith: 'form' | 'camera';
}

// Database record interfaces
export interface WorkshopRecord {
  id: string;
  created_at: string;
  updated_at: string;

  // Machine Information
  location_of_repair: 'Site' | 'Workshop';
  product_name: string;
  clients_work_order: string;
  make_model: string;
  serial_number: string;
  site_location: string | null; // Now nullable
  fault_description: string;

  // Customer Information
  customer_name: string;
  contact_email: string;
  contact_number: string;
  customer_data: Customer | null;

  // Optional Contacts
  optional_contacts: Array<{
    name: string;
    number: string;
    email: string;
  }>;

  // Status
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created_by: string;

  // Workflow tracking
  started_with: 'form' | 'camera';

  // Photo references
  photo_urls: string[];
}

export interface WorkshopPhoto {
  id: string;
  workshop_id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  created_at: string;
}

/**
 * Create a new workshop record
 */
export async function createWorkshop(data: WorkshopFormData, userId?: string): Promise<WorkshopRecord> {
  try {
    // Get current user if no userId provided
    let finalUserId = userId;
    if (!finalUserId) {
      const currentUserData = get(currentUser);
      if (currentUserData) {
        finalUserId = currentUserData.uid;
      } else {
        throw new Error('You must be logged in to create a workshop');
      }
    }

    // Upload photos first
    const photoUrls = await uploadWorkshopPhotos(data.photos, data.clientsWorkOrder || 'workshop');

    // Prepare workshop data
    const workshopData = {
      location_of_repair: data.locationOfRepair,
      product_name: data.productName,
      clients_work_order: data.clientsWorkOrder,
      make_model: data.makeModel,
      serial_number: data.serialNumber,
      site_location: data.siteLocation?.trim() || null, // Store null for empty values
      fault_description: data.faultDescription,
      customer_name: data.customerName,
      contact_email: data.contactEmail,
      contact_number: data.contactNumber,
      customer_data: data.selectedCustomer,
      optional_contacts: data.optionalContacts,
      status: 'pending' as const,
      created_by: finalUserId,
      started_with: data.startedWith,
      photo_urls: photoUrls
    };

    console.log('Inserting workshop data:', workshopData);

    const { data: workshop, error } = await supabase
      .from('workshop')
      .insert(workshopData)
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }

    console.log('Workshop created successfully:', workshop);

    return workshop as WorkshopRecord;
  } catch (error) {
    console.error('Error creating workshop:', error);
    throw error;
  }
}

/**
 * Upload photos to Supabase storage
 */
export async function uploadWorkshopPhotos(photos: File[], workOrder: string): Promise<string[]> {
  console.log('uploadWorkshopPhotos called with:', { photoCount: photos?.length, workOrder });

  if (!photos || photos.length === 0) {
    console.log('No photos to upload, returning empty array');
    return [];
  }

  try {
    const uploadedUrls: string[] = [];

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      console.log(`Uploading photo ${i + 1}:`, { name: photo.name, size: photo.size, type: photo.type });

      const fileName = `${workOrder}_${Date.now()}_${i + 1}_${photo.name}`;

      const { data, error } = await supabase.storage
        .from('workshop-photos')
        .upload(fileName, photo);

      if (error) {
        console.error(`Error uploading photo ${i + 1}:`, error);
        throw error;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('workshop-photos')
        .getPublicUrl(fileName);

      console.log(`Photo ${i + 1} uploaded successfully:`, urlData.publicUrl);
      uploadedUrls.push(urlData.publicUrl);
    }

    console.log('All photos uploaded successfully:', uploadedUrls);
    return uploadedUrls;
  } catch (error) {
    console.error('Error uploading photos:', error);
    throw error;
  }
}

/**
 * Get workshop by ID
 */
export async function getWorkshop(id: string): Promise<WorkshopRecord | null> {
  try {
    const { data, error } = await supabase
      .from('workshop')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw error;
    }

    return data as WorkshopRecord;
  } catch (error) {
    console.error('Error fetching workshop:', error);
    throw error;
  }
}

/**
 * Get all workshops with optional filtering
 */
export async function getWorkshops(filters?: {
  status?: string;
  customer_name?: string;
  limit?: number;
}): Promise<WorkshopRecord[]> {
  try {
    let query = supabase
      .from('workshop')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.customer_name) {
      query = query.ilike('customer_name', `%${filters.customer_name}%`);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data as WorkshopRecord[];
  } catch (error) {
    console.error('Error fetching workshops:', error);
    throw error;
  }
}

/**
 * Update workshop status
 */
export async function updateWorkshopStatus(id: string, status: WorkshopRecord['status']): Promise<void> {
  try {
    const { error } = await supabase
      .from('workshop')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error updating workshop status:', error);
    throw error;
  }
}

/**
 * Update workshop
 */
export async function updateWorkshop(id: string, data: Partial<WorkshopFormData>): Promise<WorkshopRecord> {
  try {
    // Handle photo uploads if new photos are provided
    let photoUrls = [];
    if (data.photos && data.photos.length > 0) {
      const newPhotoUrls = await uploadWorkshopPhotos(data.photos, data.clientsWorkOrder || 'workshop');
      photoUrls = newPhotoUrls;
    }

    // Prepare update data
    const updateData: any = {
      location_of_repair: data.locationOfRepair,
      product_name: data.productName,
      clients_work_order: data.clientsWorkOrder,
      make_model: data.makeModel,
      serial_number: data.serialNumber,
      site_location: data.siteLocation?.trim() || null,
      fault_description: data.faultDescription,
      customer_name: data.customerName,
      contact_email: data.contactEmail,
      contact_number: data.contactNumber,
      customer_data: data.selectedCustomer,
      optional_contacts: data.optionalContacts,
      updated_at: new Date().toISOString()
    };

    // Only add photo_urls if we have new photos
    if (photoUrls.length > 0) {
      updateData.photo_urls = photoUrls;
    }

    const { data: workshop, error } = await supabase
      .from('workshop')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return workshop as WorkshopRecord;
  } catch (error) {
    console.error('Error updating workshop:', error);
    throw error;
  }
}

/**
 * Delete workshop (soft delete by changing status)
 */
export async function deleteWorkshop(id: string): Promise<void> {
  try {
    // First clean up photos associated with this workshop
    await cleanupWorkshopPhotos(id);

    // Then soft delete the workshop
    const { error } = await supabase
      .from('workshop')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error deleting workshop:', error);
    throw error;
  }
}

/**
 * Clean up orphaned photos from storage
 */
export async function cleanupOrphanedPhotos(): Promise<{
  found: number;
  deleted: number;
  errors: string[];
}> {
  const result = {
    found: 0,
    deleted: 0,
    errors: [] as string[]
  };

  try {
    // Get all photo URLs from workshop records
    const { data: workshops, error: workshopsError } = await supabase
      .from('workshop')
      .select('photo_urls')
      .not('photo_urls', 'is', null);

    if (workshopsError) {
      throw new Error(`Failed to fetch workshops: ${workshopsError.message}`);
    }

    // Extract all photo URLs from workshops
    const usedPhotoUrls = new Set<string>();
    workshops?.forEach(workshop => {
      workshop.photo_urls?.forEach(url => {
        if (url) {
          // Extract file path from Supabase URL
          const urlParts = url.split('/storage/v1/object/public/workshop-photos/');
          if (urlParts.length > 1) {
            usedPhotoUrls.add(urlParts[1]);
          }
        }
      });
    });

    // Get all files from storage bucket
    const { data: storageFiles, error: storageError } = await supabase.storage
      .from('workshop-photos')
      .list('', {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (storageError) {
      throw new Error(`Failed to list storage files: ${storageError.message}`);
    }

    // Find orphaned photos (files in storage but not referenced in any workshop)
    const orphanedFiles = storageFiles?.filter(file => {
      return !usedPhotoUrls.has(file.name);
    }) || [];

    result.found = orphanedFiles.length;

    // Delete orphaned photos
    if (orphanedFiles.length > 0) {
      const deletePromises = orphanedFiles.map(async (file) => {
        const { error: deleteError } = await supabase.storage
          .from('workshop-photos')
          .remove([file.name]);

        if (deleteError) {
          result.errors.push(`Failed to delete ${file.name}: ${deleteError.message}`);
        } else {
          result.deleted++;
        }
      });

      await Promise.all(deletePromises);
    }

    return result;
  } catch (error) {
    console.error('Error during photo cleanup:', error);
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return result;
  }
}

/**
 * Get storage usage and photo statistics
 */
export async function getPhotoStatistics(): Promise<{
  totalPhotos: number;
  usedPhotos: number;
  orphanedPhotos: number;
  storageSize: number;
  workshopsCount: number;
}> {
  try {
    // Get all photo URLs from workshop records
    const { data: workshops, error: workshopsError } = await supabase
      .from('workshop')
      .select('photo_urls')
      .not('photo_urls', 'is', null);

    if (workshopsError) {
      throw workshopsError;
    }

    // Count used photos
    const usedPhotos = new Set<string>();
    let workshopsCount = 0;

    workshops?.forEach(workshop => {
      workshopsCount++;
      workshop.photo_urls?.forEach(url => {
        if (url) {
          const urlParts = url.split('/storage/v1/object/public/workshop-photos/');
          if (urlParts.length > 1) {
            usedPhotos.add(urlParts[1]);
          }
        }
      });
    });

    // Get all files from storage bucket
    const { data: storageFiles, error: storageError } = await supabase.storage
      .from('workshop-photos')
      .list('', {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (storageError) {
      throw storageError;
    }

    // Calculate statistics
    const totalPhotos = storageFiles?.length || 0;
    const orphanedPhotos = totalPhotos - usedPhotos.size;
    const storageSize = storageFiles?.reduce((total, file) => total + (file.metadata?.size || 0), 0) || 0;

    return {
      totalPhotos,
      usedPhotos: usedPhotos.size,
      orphanedPhotos: Math.max(0, orphanedPhotos),
      storageSize,
      workshopsCount
    };
  } catch (error) {
    console.error('Error getting photo statistics:', error);
    throw error;
  }
}

/**
 * Clean up photos for a specific workshop (when workshop is deleted)
 */
export async function cleanupWorkshopPhotos(workshopId: string): Promise<number> {
  try {
    // Get workshop photo URLs
    const { data: workshop, error: fetchError } = await supabase
      .from('workshop')
      .select('photo_urls')
      .eq('id', workshopId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    if (!workshop?.photo_urls || workshop.photo_urls.length === 0) {
      return 0; // No photos to clean up
    }

    // Extract file names from URLs
    const fileNames = workshop.photo_urls.map(url => {
      const urlParts = url.split('/storage/v1/object/public/workshop-photos/');
      return urlParts.length > 1 ? urlParts[1] : null;
    }).filter(Boolean) as string[];

    if (fileNames.length === 0) {
      return 0;
    }

    // Delete photos from storage
    const { error: deleteError } = await supabase.storage
      .from('workshop-photos')
      .remove(fileNames);

    if (deleteError) {
      throw deleteError;
    }

    return fileNames.length;
  } catch (error) {
    console.error('Error cleaning up workshop photos:', error);
    throw error;
  }
}
