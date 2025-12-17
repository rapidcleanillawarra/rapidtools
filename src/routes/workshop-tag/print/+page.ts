import type { PageLoad } from './$types';
import { supabase } from '$lib/supabase';

type WorkshopPrintData = {
  id: string | null;
  workshop: {
    order_id: string | null;
    clients_work_order: string | null;
    product_name: string | null;
    customer_name: string | null;
    customer_data: {
      BillingAddress?: {
        BillCompany?: string;
      };
    } | null;
    optional_contacts: Array<{
      name: string;
      number: string;
      email: string;
    }> | null;
    make_model: string | null;
    serial_number: string | null;
    site_location: string | null;
    fault_description: string | null;
    created_at: string | null;
  } | null;
  error?: string;
};

export const load: PageLoad = async ({ url }) => {
  const id = url.searchParams.get('id');

  if (!id) {
    return {
      id: null,
      workshop: null,
      error: 'No workshop ID provided'
    } satisfies WorkshopPrintData;
  }

  try {
    const { data, error } = await supabase
      .from('workshop')
      .select('id, order_id, clients_work_order, product_name, customer_name, customer_data, optional_contacts, make_model, serial_number, site_location, fault_description, created_at')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return {
        id,
        workshop: null,
        error: 'Workshop not found'
      } satisfies WorkshopPrintData;
    }

    // Parse optional_contacts if it's a string
    let optionalContacts = data?.optional_contacts;
    if (typeof optionalContacts === 'string') {
      try {
        optionalContacts = JSON.parse(optionalContacts);
      } catch (parseErr) {
        console.warn('Failed to parse optional_contacts:', parseErr);
        optionalContacts = [];
      }
    }

    // Parse customer_data if it's a string
    let customerData = data?.customer_data;
    if (typeof customerData === 'string') {
      try {
        customerData = JSON.parse(customerData);
      } catch (parseErr) {
        console.warn('Failed to parse customer_data:', parseErr);
        customerData = null;
      }
    }

    return {
      id: data.id,
      workshop: {
        order_id: data.order_id,
        clients_work_order: data.clients_work_order,
        product_name: data.product_name,
        customer_name: data.customer_name,
        customer_data: customerData,
        optional_contacts: optionalContacts,
        make_model: data.make_model,
        serial_number: data.serial_number,
        site_location: data.site_location,
        fault_description: data.fault_description,
        created_at: data.created_at
      }
    } satisfies WorkshopPrintData;
  } catch (err) {
    console.error('Unexpected error:', err);
    return {
      id,
      workshop: null,
      error: 'Failed to load workshop'
    } satisfies WorkshopPrintData;
  }
};
