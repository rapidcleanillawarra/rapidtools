// Workshop service for Supabase operations
import { supabase } from '$lib/supabase';
import type { Customer } from './customers';
import { currentUser } from '$lib/firebase';
import { get } from 'svelte/store';
import { fetchUserProfile } from '$lib/userProfile';

// Workshop form data interface
export interface WorkshopFormData {
  // Machine Information
  locationOfRepair: 'Site' | 'Workshop' | null;
  productName: string | null;
  clientsWorkOrder: string;
  makeModel: string;
  serialNumber: string;
  siteLocation: string; // Now optional
  faultDescription: string;

  // User Information
  customerName: string | null;
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
  quoteOrRepaired: 'Quote' | 'Repaired';

  // API data
  customerApiData?: any;
  orderApiData?: any;
  order_id?: string | null;
  status?: string;

  // Photo handling
  existingPhotoUrls?: string[];
}

// Database record interfaces
export interface WorkshopRecord {
  id: string;
  created_at: string;
  updated_at: string;

  // Machine Information
  location_of_repair: 'Site' | 'Workshop' | null;
  product_name: string | null;
  clients_work_order: string;
  make_model: string;
  serial_number: string;
  site_location: string | null; // Now nullable
  fault_description: string;

  // Customer Information
  customer_name: string | null;
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
  status: 'new' | 'pickup' | 'to_be_quoted' | 'in_progress' | 'completed' | 'cancelled';
  created_by: string;

  // Workflow tracking
  started_with: 'form' | 'camera';

  // Photo references
  photo_urls: string[];

  // Quote or Repaired
  quote_or_repaired: 'Quote' | 'Repaired';

  // Order information
  order_id: string | null;
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

    // Fetch user profile to get name information (same as Header)
    let userProfile = null;
    try {
      userProfile = await fetchUserProfile(finalUserId);
    } catch (error) {
      console.warn('Could not fetch user profile:', error);
      // Continue without profile - we'll use email fallback
    }

    // Create user name from profile or fallback to email
    let createdByName = 'Unknown User';
    if (userProfile && userProfile.firstName && userProfile.lastName) {
      createdByName = `${userProfile.firstName} ${userProfile.lastName}`;
    } else {
      // Fallback to current user's email if profile not available
      const currentUserData = get(currentUser);
      if (currentUserData?.email) {
        createdByName = currentUserData.email.split('@')[0] || 'Unknown User';
      }
    }

    // Upload photos first
    const photoUrls = await uploadWorkshopPhotos(data.photos, data.clientsWorkOrder || 'workshop');

    // Debug optional contacts
    console.log('Optional contacts before formatting:', data.optionalContacts);
    console.log('Optional contacts length:', data.optionalContacts?.length);
    console.log('Optional contacts type:', typeof data.optionalContacts);

    // Format optional contacts for PostgreSQL jsonb[] type
    // PostgreSQL jsonb[] expects an array of JSONB objects
    let formattedContacts: any[] = [];
    if (data.optionalContacts && Array.isArray(data.optionalContacts) && data.optionalContacts.length > 0) {
      formattedContacts = data.optionalContacts.map(contact => ({
        name: String(contact.name || ''),
        number: String(contact.number || ''),
        email: String(contact.email || '')
      }));
    }
    console.log('Formatted contacts:', formattedContacts);
    console.log('Formatted contacts length:', formattedContacts.length);
    console.log('Formatted contacts type:', typeof formattedContacts[0]);
    
    // Prepare workshop data
    const workshopData = {
      location_of_repair: data.locationOfRepair || null,
      product_name: data.productName || null,
      clients_work_order: data.clientsWorkOrder,
      make_model: data.makeModel,
      serial_number: data.serialNumber,
      site_location: data.siteLocation?.trim() || null, // Store null for empty values
      fault_description: data.faultDescription,
      customer_name: data.customerName || null,
      contact_email: data.contactEmail,
      contact_number: data.contactNumber,
      customer_data: data.selectedCustomer,
      optional_contacts: formattedContacts.length > 0 ? formattedContacts : [],
      status: (data.status as any) || 'new',
      created_by: createdByName,
      started_with: data.startedWith,
      photo_urls: photoUrls,
      order_id: data.order_id || null
    };

    console.log('Inserting workshop data:', JSON.stringify(workshopData, null, 2));
    console.log('Optional contacts in workshopData:', workshopData.optional_contacts);
    console.log('Optional contacts type in workshopData:', typeof workshopData.optional_contacts);
    console.log('Optional contacts length in workshopData:', workshopData.optional_contacts?.length);

    const { data: workshop, error } = await supabase
      .from('workshop')
      .insert(workshopData)
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      console.error('Error details:', error.details, error.hint, error.message);
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
  // Make workOrder more dynamic if it's the default
  const dynamicWorkOrder = workOrder === 'workshop'
    ? `workshop_${Date.now().toString().slice(-6)}` // Add timestamp suffix for uniqueness
    : workOrder;

  console.log('uploadWorkshopPhotos called with:', {
    photoCount: photos?.length,
    originalWorkOrder: workOrder,
    dynamicWorkOrder
  });

  if (!photos || photos.length === 0) {
    console.log('No photos to upload, returning empty array');
    return [];
  }

  try {
    const uploadedUrls: string[] = [];

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      console.log(`Uploading photo ${i + 1}:`, { name: photo.name, size: photo.size, type: photo.type });

      // Generate unique filename with timestamp for each photo
      const timestamp = Date.now() + Math.random() * 1000; // Add randomness to avoid collisions
      const sanitizedFileName = photo.name.replace(/[^a-zA-Z0-9._-]/g, '_'); // Sanitize filename
      const fileName = `${dynamicWorkOrder}_${timestamp}_${i + 1}_${sanitizedFileName}`;

      console.log(`Generated filename for photo ${i + 1}:`, fileName);
      console.log(`Filename breakdown: workOrder=${dynamicWorkOrder}, timestamp=${Math.floor(timestamp)}, index=${i + 1}, originalName=${photo.name}`);

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
      .neq('status', 'deleted') // Exclude soft-deleted records
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
    let photoUrls: string[] = [];
    if (data.photos && data.photos.length > 0) {
      const newPhotoUrls = await uploadWorkshopPhotos(data.photos, data.clientsWorkOrder || 'workshop');
      photoUrls = newPhotoUrls;
    }

    // Merge with existing photo URLs if provided
    if (data.existingPhotoUrls && data.existingPhotoUrls.length > 0) {
      photoUrls = [...data.existingPhotoUrls, ...photoUrls];
      console.log('Merged photo URLs:', {
        existing: data.existingPhotoUrls,
        new: photoUrls.slice(data.existingPhotoUrls.length),
        merged: photoUrls
      });
    }

    // Debug optional contacts
    console.log('Update - Optional contacts before formatting:', data.optionalContacts);
    console.log('Update - Optional contacts length:', data.optionalContacts?.length);
    console.log('Update - Optional contacts type:', typeof data.optionalContacts);

    // Format optional contacts for PostgreSQL jsonb[] type
    // PostgreSQL jsonb[] expects an array of JSONB objects
    let formattedContacts: any[] = [];
    if (data.optionalContacts && Array.isArray(data.optionalContacts) && data.optionalContacts.length > 0) {
      formattedContacts = data.optionalContacts.map(contact => ({
        name: String(contact.name || ''),
        number: String(contact.number || ''),
        email: String(contact.email || '')
      }));
    }
    console.log('Update - Formatted contacts:', formattedContacts);
    console.log('Update - Formatted contacts length:', formattedContacts.length);
    console.log('Update - Formatted contacts type:', typeof formattedContacts[0]);
    
    // Prepare update data
    const updateData: any = {
      location_of_repair: data.locationOfRepair || null,
      product_name: data.productName || null,
      clients_work_order: data.clientsWorkOrder,
      make_model: data.makeModel,
      serial_number: data.serialNumber,
      site_location: data.siteLocation?.trim() || null,
      fault_description: data.faultDescription,
      customer_name: data.customerName || null,
      contact_email: data.contactEmail,
      contact_number: data.contactNumber,
      customer_data: data.selectedCustomer,
      optional_contacts: formattedContacts.length > 0 ? formattedContacts : [],
      updated_at: new Date().toISOString()
    };

    // Add order_id if provided
    if (data.order_id !== undefined) {
      updateData.order_id = data.order_id;
    }

    // Add status if provided
    if (data.status) {
      updateData.status = data.status;
    }

    // Add started_with if provided
    if (data.startedWith) {
      updateData.started_with = data.startedWith;
    }

    // Note: We don't update created_by on updates as it should remain the original creator's name

    // Update photo_urls if we have photos (existing or new)
    if (photoUrls.length > 0 || (data.existingPhotoUrls && data.existingPhotoUrls.length > 0)) {
      const finalPhotoUrls = photoUrls.length > 0 ? photoUrls : data.existingPhotoUrls || [];
      updateData.photo_urls = finalPhotoUrls;
      console.log('Updating photo_urls with:', finalPhotoUrls);
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
 * Delete workshop (soft delete by changing status to 'deleted')
 */
export async function deleteWorkshop(id: string): Promise<void> {
  try {
    // First clean up photos associated with this workshop
    await cleanupWorkshopPhotos(id);

    // Then soft delete the workshop by setting status to 'deleted' and deleted_at timestamp
    const { error } = await supabase
      .from('workshop')
      .update({
        status: 'deleted',
        deleted_at: new Date().toISOString(),
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
      workshop.photo_urls?.forEach((url: string) => {
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
      workshop.photo_urls?.forEach((url: string) => {
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
    const fileNames = workshop.photo_urls.map((url: string) => {
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
