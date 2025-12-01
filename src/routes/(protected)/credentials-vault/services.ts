import { supabase } from '$lib/supabase';
import type { Credential, CredentialFormData } from './types';

const TABLE_NAME = 'credentials_vault';

export async function fetchCredentials(): Promise<Credential[]> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .order('website', { ascending: true });

  if (error) {
    console.error('Error fetching credentials:', error);
    throw new Error('Failed to fetch credentials');
  }

  return data || [];
}

export async function createCredential(formData: CredentialFormData): Promise<Credential> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert({
      website: formData.website,
      username: formData.username || null,
      email: formData.email || null,
      password: formData.password || null,
      mfa_phone: formData.mfa_phone || null,
      description: formData.description || null
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating credential:', error);
    throw new Error('Failed to create credential');
  }

  return data;
}

export async function updateCredential(id: string, formData: CredentialFormData): Promise<Credential> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update({
      website: formData.website,
      username: formData.username || null,
      email: formData.email || null,
      password: formData.password || null,
      mfa_phone: formData.mfa_phone || null,
      description: formData.description || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating credential:', error);
    throw new Error('Failed to update credential');
  }

  return data;
}

export async function deleteCredential(id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting credential:', error);
    throw new Error('Failed to delete credential');
  }
}

