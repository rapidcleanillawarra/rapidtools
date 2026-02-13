// Workshop service for Supabase operations
import { supabase } from '$lib/supabase';
import type { Customer } from './customers';
import { currentUser } from '$lib/firebase';
import { get } from 'svelte/store';
import { fetchUserProfile } from '$lib/userProfile';

// Workshop form data interface
export interface WorkshopFormData {
  // Machine Information
  locationOfMachine: 'Site' | 'Workshop' | null;
  action?: string | null; // Missing field
  productName: string | null;
  clientsWorkOrder: string;
  makeModel: string;
  serialNumber: string;
  siteLocation: string; // Now optional
  schedules?: any; // JSONB field for schedule data
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

  // Files (File objects)
  files: File[];

  // Workflow tracking
  startedWith: 'form' | 'camera';
  quoteOrRepaired: 'Quote' | 'Repaired';

  // Docket info (for "to_be_quoted" status submissions)
  docket_info?: any; // JSONB field for docket information

  // Comments
  comments?: Array<{
    id: string;
    text: string;
    author: string;
    created_at: string;
  }>;

  // History
  history?: Array<{
    id: string;
    timestamp: string;
    user: string;
    status: string;
    isCreation?: boolean;
  }>;

  // API data
  customerApiData?: any;
  orderApiData?: any;
  order_id?: string | null;
  status?: string;

  // Photo handling
  existingPhotoUrls?: string[];

  // File handling
  existingFileUrls?: string[];
}

// Database record interfaces
export interface WorkshopRecord {
  id: string;
  created_at: string;
  updated_at: string;

  // Machine Information
  location_of_machine: 'Site' | 'Workshop' | null;
  action: string | null;
  product_name: string | null;
  clients_work_order: string;
  make_model: string;
  serial_number: string;
  site_location: string | null; // Now nullable
  schedules?: any; // JSONB field for schedule data
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
  status: 'new' | 'pickup' | 'to_be_quoted' | 'docket_ready' | 'quoted' | 'repaired' | 'pickup_from_workshop' | 'return' | 'waiting_approval_po' | 'waiting_for_parts' | 'booked_in_for_repair_service' | 'pending_jobs' | 'completed' | 'to_be_scrapped' | 'warranty_claim';
  created_by: string;

  // Workflow tracking
  started_with: 'form' | 'camera';

  // Photo references
  photo_urls: string[];

  // File references
  file_urls: string[] | string;

  // Quote or Repaired
  quote_or_repaired: 'Quote' | 'Repaired';

  // Order information
  order_id: string | null;

  // Docket information (JSONB)
  docket_info?: any;

  // Comments (JSONB)
  comments?: Array<{
    id: string;
    text: string;
    author: string;
    created_at: string;
  }> | any;

  // History (JSONB)
  history?: Array<{
    id: string;
    timestamp: string;
    user: string;
    status: string;
    isCreation?: boolean;
  }> | any;
}

export interface WorkshopPhoto {
  id: string;
  workshop_id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  created_at: string;
}

const PICKUP_POWER_AUTOMATE_URL =
  'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/c616bc7890dc4174877af4a47898eca2/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=huzEhEV42TBgQraOgxHRDDp_ZD6GjCmrD-Nuy4YtOFA';

function buildPickupHtmlBody(
  workshop: WorkshopRecord,
  status: 'pickup' | 'return'
): string {
  const header = status === 'return' ? 'FOR RETURN' : 'FOR PICK UP';
  const company =
    workshop.customer_data?.BillingAddress?.BillCompany ?? workshop.customer_name ?? 'N/A';
  const firstName = workshop.customer_data?.BillingAddress?.BillFirstName ?? '';
  const lastName = workshop.customer_data?.BillingAddress?.BillLastName ?? '';
  const phone = workshop.customer_data?.BillingAddress?.BillPhone ?? workshop.contact_number ?? '';
  const contactName =
    (`${firstName} ${lastName}`.trim() || workshop.customer_name) ?? 'N/A';
  const contactLine = phone ? `${contactName} - ${phone}` : contactName;
  const orderId = workshop.order_id ?? 'N/A';
  const product = [workshop.product_name, workshop.make_model].filter(Boolean).join(' ') || 'N/A';
  const fault = workshop.fault_description ?? 'N/A';

  return [
    `<p><strong>${header}</strong></p>`,
    `<p>Order #${orderId}</p>`,
    `<p>${escapeHtml(company)}</p>`,
    `<p>${escapeHtml(contactLine)}</p>`,
    '<p><br></p>',
    `<p>${escapeHtml(product)}</p>`,
    `<p>${escapeHtml(fault)}</p>`
  ].join('\n');
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Notify Teams via Power Automate when a workshop is marked for pickup or return.
 * Returns true on success, false on failure. Does not throw.
 */
export async function notifyPickupToTeams(
  workshop: WorkshopRecord,
  status: 'pickup' | 'return' = 'pickup'
): Promise<boolean> {
  try {
    const body = buildPickupHtmlBody(workshop, status);
    const payload = { body, action: 'pickup_deliveries' };

    const response = await fetch(PICKUP_POWER_AUTOMATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return response.ok;
  } catch {
    return false;
  }
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

    // Upload photos and files first
    const photoUrls = await uploadWorkshopPhotos(data.photos, data.clientsWorkOrder || 'workshop');
    const fileUrls = await uploadWorkshopFiles(data.files, data.clientsWorkOrder || 'workshop');

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
      location_of_machine: data.locationOfMachine || null,
      action: data.action || null,
      product_name: data.productName || null,
      clients_work_order: data.clientsWorkOrder,
      make_model: data.makeModel,
      serial_number: data.serialNumber,
      site_location: data.siteLocation?.trim() || null, // Store null for empty values
      schedules: data.schedules || null,
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
      file_urls: fileUrls,
      order_id: data.order_id || null,
      comments: data.comments || [],
      history: data.history || []
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
 * Upload files to Supabase storage
 */
export async function uploadWorkshopFiles(files: File[], workOrder: string): Promise<string[]> {
  // Make workOrder more dynamic if it's the default
  const dynamicWorkOrder = workOrder === 'workshop'
    ? `workshop_${Date.now().toString().slice(-6)}` // Add timestamp suffix for uniqueness
    : workOrder;

  console.log('uploadWorkshopFiles called with:', {
    fileCount: files?.length,
    originalWorkOrder: workOrder,
    dynamicWorkOrder
  });

  if (!files || files.length === 0) {
    console.log('No files to upload, returning empty array');
    return [];
  }

  try {
    const uploadedUrls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`Uploading file ${i + 1}:`, { name: file.name, size: file.size, type: file.type });

      // Generate unique filename with timestamp for each file
      const timestamp = Date.now() + Math.random() * 1000; // Add randomness to avoid collisions
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_'); // Sanitize filename
      const fileName = `${dynamicWorkOrder}_${timestamp}_${i + 1}_${sanitizedFileName}`;

      console.log(`Generated filename for file ${i + 1}:`, fileName);
      console.log(`Filename breakdown: workOrder=${dynamicWorkOrder}, timestamp=${Math.floor(timestamp)}, index=${i + 1}, originalName=${file.name}`);

      const { data, error } = await supabase.storage
        .from('workshop-files')
        .upload(fileName, file);

      if (error) {
        console.error(`Error uploading file ${i + 1}:`, error);
        throw error;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('workshop-files')
        .getPublicUrl(fileName);

      console.log(`File ${i + 1} uploaded successfully:`, urlData.publicUrl);
      uploadedUrls.push(urlData.publicUrl);
    }

    console.log('All files uploaded successfully:', uploadedUrls);
    return uploadedUrls;
  } catch (error) {
    console.error('Error uploading files:', error);
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
  excludeStatuses?: string[];
}): Promise<WorkshopRecord[]> {
  try {
    let query = supabase
      .from('workshop')
      .select('*')
      .neq('status', 'deleted') // Exclude soft-deleted records
      .order('created_at', { ascending: false });

    if (filters?.excludeStatuses?.length) {
      for (const s of filters.excludeStatuses) {
        query = query.neq('status', s);
      }
    }

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
    // Handle photo and file uploads if new files are provided
    let newPhotoUrls: string[] = [];
    if (data.photos && data.photos.length > 0) {
      newPhotoUrls = await uploadWorkshopPhotos(data.photos, data.clientsWorkOrder || 'workshop');
    }

    let newFileUrls: string[] = [];
    if (data.files && data.files.length > 0) {
      newFileUrls = await uploadWorkshopFiles(data.files, data.clientsWorkOrder || 'workshop');
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
    
    // Prepare update data - only include fields that are explicitly provided
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    console.log('[UPDATE_WORKSHOP] Input data:', data);
    console.log('[UPDATE_WORKSHOP] Initial updateData:', updateData);

    // Only update fields that are explicitly provided (not undefined)
    if (data.locationOfMachine !== undefined) {
      updateData.location_of_machine = data.locationOfMachine || null;
    }
    if (data.action !== undefined) {
      updateData.action = data.action || null;
    }
    if (data.productName !== undefined) {
      updateData.product_name = data.productName || null;
    }
    if (data.clientsWorkOrder !== undefined) {
      updateData.clients_work_order = data.clientsWorkOrder;
    }
    if (data.makeModel !== undefined) {
      updateData.make_model = data.makeModel;
    }
    if (data.serialNumber !== undefined) {
      updateData.serial_number = data.serialNumber;
    }
    if (data.siteLocation !== undefined) {
      updateData.site_location = data.siteLocation?.trim() || null;
    }
    if (data.schedules !== undefined) {
      updateData.schedules = data.schedules || null;
    }
    if (data.faultDescription !== undefined) {
      updateData.fault_description = data.faultDescription;
    }
    if (data.customerName !== undefined) {
      updateData.customer_name = data.customerName || null;
    }
    if (data.contactEmail !== undefined) {
      updateData.contact_email = data.contactEmail;
    }
    if (data.contactNumber !== undefined) {
      updateData.contact_number = data.contactNumber;
    }
    if (data.selectedCustomer !== undefined) {
      updateData.customer_data = data.selectedCustomer;
    }
    if (data.optionalContacts !== undefined) {
      updateData.optional_contacts = formattedContacts.length > 0 ? formattedContacts : [];
    }

    // Add comments if provided
    if (data.comments !== undefined) {
      updateData.comments = data.comments;
    }

    // Add order_id if provided
    if (data.order_id !== undefined) {
      updateData.order_id = data.order_id;
    }

    // Add status if provided
    if (data.status) {
      updateData.status = data.status;
      console.log('UpdateWorkshop - Setting status to:', data.status);
    } else {
      console.log('UpdateWorkshop - No status provided in data');
    }

    // Add started_with if provided
    if (data.startedWith) {
      updateData.started_with = data.startedWith;
    }

    // Add docket_info if provided (for "to_be_quoted" status submissions)
    if (data.docket_info !== undefined) {
      updateData.docket_info = data.docket_info;
    }

    // Add history if provided
    if (data.history !== undefined) {
      updateData.history = data.history;
    }

    // Note: We don't update created_by on updates as it should remain the original creator's name

    // Update photo_urls - only update when there are actual changes
    const hasExistingPhotos = data.existingPhotoUrls && data.existingPhotoUrls.length > 0;
    const hasNewPhotos = newPhotoUrls.length > 0;

    // Only update photo_urls if:
    // 1. There are new photos to upload (merge with existing)
    // 2. existingPhotoUrls is explicitly provided (even if empty, to allow clearing photos)
    if (hasNewPhotos || data.existingPhotoUrls !== undefined) {
      let finalPhotoUrls: string[] = [];

      if (hasNewPhotos && hasExistingPhotos) {
        // Merge new photos with existing photos
        finalPhotoUrls = [...(data.existingPhotoUrls || []), ...newPhotoUrls];
      } else if (hasNewPhotos && !hasExistingPhotos) {
        // Only new photos
        finalPhotoUrls = newPhotoUrls;
      } else if (!hasNewPhotos && data.existingPhotoUrls !== undefined) {
        // No new photos, use existing photos as-is (or empty if clearing)
        finalPhotoUrls = data.existingPhotoUrls || [];
      }

      updateData.photo_urls = finalPhotoUrls;
      console.log('Updating photo_urls with:', finalPhotoUrls, {
        hasNewPhotos,
        hasExistingPhotos,
        existingPhotoUrlsLength: data.existingPhotoUrls?.length || 0,
        newPhotoUrlsLength: newPhotoUrls.length
      });
    }

    // Update file_urls - only update when there are actual changes
    const hasExistingFiles = data.existingFileUrls && data.existingFileUrls.length > 0;
    const hasNewFiles = newFileUrls.length > 0;

    // Only update file_urls if:
    // 1. There are new files to upload (merge with existing)
    // 2. existingFileUrls is explicitly provided (even if empty, to allow clearing files)
    if (hasNewFiles || data.existingFileUrls !== undefined) {
      let finalFileUrls: string[] = [];

      if (hasNewFiles && hasExistingFiles) {
        // Merge new files with existing files
        finalFileUrls = [...(data.existingFileUrls || []), ...newFileUrls];
      } else if (hasNewFiles && !hasExistingFiles) {
        // Only new files
        finalFileUrls = newFileUrls;
      } else if (!hasNewFiles && data.existingFileUrls !== undefined) {
        // No new files, use existing files as-is (or empty if clearing)
        finalFileUrls = data.existingFileUrls || [];
      }

      updateData.file_urls = finalFileUrls;
      console.log('Updating file_urls with:', finalFileUrls, {
        hasNewFiles,
        hasExistingFiles,
        existingFileUrlsLength: data.existingFileUrls?.length || 0,
        newFileUrlsLength: newFileUrls.length
      });
    }

    console.log('[UPDATE_WORKSHOP] Final updateData being sent to database:', updateData);

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
