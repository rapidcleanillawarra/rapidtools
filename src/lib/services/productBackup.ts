// Product backup service for storing product history before changes
import { supabase } from '$lib/supabase';
import { get } from 'svelte/store';
import { currentUser } from '$lib/firebase';
import { userProfile, fetchUserProfile } from '$lib/userProfile';
import type { ProductInfo } from '../../routes/(protected)/product-information-update/types';

export interface ProductBackupRecord {
  id: string;
  sku: string;
  full_data: ProductInfo;
  created_at: string;
  updated_at: string;
  last_modified_by?: string | null;
}

/**
 * Save product backup before making changes
 * This creates a history record of the product state before any modifications
 */
export async function saveProductBackup(sku: string, productData: ProductInfo): Promise<ProductBackupRecord> {
  try {
    console.log('Creating product backup for SKU:', sku);

    // Get current user for last_modified_by
    const currentUserData = get(currentUser);
    let userProfileData = get(userProfile);
    let lastModifiedBy = null;

    if (currentUserData) {
      // If profile isn't loaded yet, try to fetch it synchronously
      if (!userProfileData && currentUserData.uid) {
        try {
          userProfileData = await fetchUserProfile(currentUserData.uid);
        } catch (error) {
          console.warn('Could not fetch user profile for backup:', error);
        }
      }

      // Use user profile name (firstName + lastName), fallback to email, then display name or UID
      if (userProfileData && userProfileData.firstName && userProfileData.lastName) {
        lastModifiedBy = `${userProfileData.firstName} ${userProfileData.lastName}`;
      } else {
        lastModifiedBy = currentUserData.email ||
                        currentUserData.displayName ||
                        currentUserData.uid ||
                        'Unknown User';
      }
    }

    const backupData = {
      sku,
      full_data: productData,
      last_modified_by: lastModifiedBy
    };

    const { data, error } = await supabase
      .from('product_backup_history')
      .insert(backupData)
      .select()
      .single();

    if (error) {
      console.error('Error saving product backup:', error);
      throw error;
    }

    console.log('Product backup saved successfully:', data.id);
    return data as ProductBackupRecord;
  } catch (error) {
    console.error('Failed to save product backup:', error);
    // Don't throw here - we don't want backup failures to prevent product updates
    // But we should log it for monitoring
    throw error;
  }
}

/**
 * Get backup history for a specific SKU
 */
export async function getProductBackupHistory(sku: string, limit: number = 50): Promise<ProductBackupRecord[]> {
  try {
    const { data, error } = await supabase
      .from('product_backup_history')
      .select('*')
      .eq('sku', sku)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data as ProductBackupRecord[];
  } catch (error) {
    console.error('Error fetching product backup history:', error);
    throw error;
  }
}

/**
 * Get a specific backup record by ID
 */
export async function getProductBackup(id: string): Promise<ProductBackupRecord | null> {
  try {
    const { data, error } = await supabase
      .from('product_backup_history')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // Not found
        return null;
      }
      throw error;
    }

    return data as ProductBackupRecord;
  } catch (error) {
    console.error('Error fetching product backup:', error);
    throw error;
  }
}
