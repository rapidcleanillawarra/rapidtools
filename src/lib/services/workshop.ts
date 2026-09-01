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

  // Cold storage backup (B2 migration record)
  backup_files?: { migratedAt: string; photoUrls: string[]; fileUrls: string[] } | null;

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

  // Assigned technician (from active workshop_tech_schedule; not workshop columns)
  assigned_tech?: string | null;
  assigned_tech_name?: string | null;
  /** From workshop_tech_schedule (board enrichment; not a workshop column) */
  tech_schedule?: string | null;
  tech_job_type?: string | null;
}

export interface WorkshopPhoto {
  id: string;
  workshop_id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  created_at: string;
}

/** workshop_transport table record (assign person + schedule for pickup/return) */
export interface WorkshopTransportRecord {
  id: string;
  workshop_id: string;
  job_status: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  transport_status: 'new' | 'confirmed';
  schedule: string | null;
  assigned_by: string | null;
  assigned_by_name: string | null;
  created_at: string;
  updated_at: string;
}

/** Allowed job types for workshop tech assignment */
export const WORKSHOP_TECH_JOB_TYPES = ['Quote', 'Repair', 'Service', 'Warranty'] as const;
export type WorkshopTechJobType = (typeof WORKSHOP_TECH_JOB_TYPES)[number];

/** assignment_status on workshop_tech_schedule */
export type WorkshopTechAssignmentStatus = 'active' | 'superseded' | 'completed' | 'cancelled';

/** workshop_tech_schedule table record (assign tech + schedule; history via assignment_status) */
export interface WorkshopTechScheduleRecord {
  id: string;
  workshop_id: string;
  assigned_tech: string | null;
  assigned_tech_name: string | null;
  schedule: string | null;
  job_type: string | null;
  assignment_status: WorkshopTechAssignmentStatus;
  workshop_status: string | null;
  assigned_by: string | null;
  assigned_by_name: string | null;
  change_reason: string | null;
  created_at: string;
  updated_at: string;
}

/** Board enrichment row from workshop_tech_schedule (active only) */
export type WorkshopTechScheduleSummary = {
  assigned_tech: string | null;
  assigned_tech_name: string | null;
  schedule: string | null;
  job_type: string | null;
};

/** Flattened workshop_tech_schedule row joined with workshop job details */
export interface TechJobsSummaryRow {
  id: string;
  workshop_id: string;
  assigned_tech: string | null;
  assigned_tech_name: string | null;
  schedule: string | null;
  job_type: string | null;
  assignment_status: WorkshopTechAssignmentStatus;
  workshop_status: string | null;
  assigned_by: string | null;
  assigned_by_name: string | null;
  change_reason: string | null;
  created_at: string;
  updated_at: string;
  customer_name: string | null;
  product_name: string | null;
  order_id: string | null;
  clients_work_order: string | null;
  make_model: string | null;
  serial_number: string | null;
  current_workshop_status: string | null;
  site_location: string | null;
}

/** Flat row for transport list table: workshop_transport + workshop fields */
export interface WorkshopTransportListRow {
  id: string;
  order_id: string | null;
  product_name: string | null;
  fault_description: string | null;
  site_location: string | null;
  transport_status: 'new' | 'confirmed';
  created_at: string;
}

/** Delivery tracker row: active pickup/return workshop + latest matching transport */
export interface DeliveryTrackingRow {
  workshop: WorkshopRecord;
  job_status: 'pickup' | 'return';
  transport_id: string | null;
  transport_status: 'new' | 'confirmed' | null;
  assigned_to_name: string | null;
  assigned_at: string | null;
  schedule: string | null;
  is_pending: boolean;
}

/** workshop_status_history table row */
export interface WorkshopStatusHistoryRow {
  id: string;
  workshop_id: string;
  timestamp: string;
  user_name: string;
  user_email: string | null;
  status: string;
  is_creation: boolean;
}

/** UI-shaped history entry (used by form and board) */
export type WorkshopHistoryEntry = {
  id: string;
  timestamp: string;
  user: string;
  status: string;
  isCreation?: boolean;
};

/**
 * Fetch history from workshop_status_history for the given workshop ids.
 * Returns a Map of workshop_id -> array of history entries in UI shape.
 */
async function getWorkshopHistoryFromTable(
  workshopIds: string[]
): Promise<Map<string, WorkshopHistoryEntry[]>> {
  const map = new Map<string, WorkshopHistoryEntry[]>();
  if (!workshopIds.length) return map;

  const CHUNK_SIZE = 50;
  for (let i = 0; i < workshopIds.length; i += CHUNK_SIZE) {
    const chunk = workshopIds.slice(i, i + CHUNK_SIZE);
    const { data: rows, error } = await supabase
      .from('workshop_status_history')
      .select('id, workshop_id, timestamp, user_name, status, is_creation')
      .in('workshop_id', chunk)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Error fetching workshop status history:', error);
      throw error;
    }

    for (const row of rows ?? []) {
      const entry: WorkshopHistoryEntry = {
        id: row.id,
        timestamp: row.timestamp,
        user: row.user_name,
        status: row.status,
        isCreation: row.is_creation ?? false
      };
      const list = map.get(row.workshop_id) ?? [];
      list.push(entry);
      map.set(row.workshop_id, list);
    }
  }

  return map;
}

const PICKUP_POWER_AUTOMATE_URL =
  'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/c616bc7890dc4174877af4a47898eca2/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=huzEhEV42TBgQraOgxHRDDp_ZD6GjCmrD-Nuy4YtOFA';

const TECH_DASHBOARD_PUBLIC_BASE =
  'https://rapidcleantools.vercel.app/admin/workshop/tech-dashboard';

function techDashboardUrl(workshopId: string): string {
  return `${TECH_DASHBOARD_PUBLIC_BASE}?highlight=${encodeURIComponent(workshopId)}`;
}

function buildPickupHtmlBody(
  workshop: WorkshopRecord,
  status: 'pickup' | 'return',
  options?: { assignedToName?: string | null; schedule?: string | null }
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
  const location = workshop.site_location?.trim() || 'N/A';

  const lines: string[] = [
    `<p><strong>${header}</strong></p>`,
    `<p>Order #${orderId}</p>`,
    `<p>${escapeHtml(company)}</p>`,
    `<p>${escapeHtml(contactLine)}</p>`,
    '<p><br></p>',
    `<p>${escapeHtml(product)}</p>`,
    `<p>${escapeHtml(fault)}</p>`,
    `<p><strong>Location: ${escapeHtml(location)}</strong></p>`
  ];

  const firstOptional = workshop.optional_contacts?.[0];
  const whoToContact = firstOptional
    ? [firstOptional.name, firstOptional.number, firstOptional.email].filter(Boolean).join(' - ') || null
    : null;
  if (whoToContact) {
    lines.push(`<p><strong>Who to Contact: ${escapeHtml(whoToContact)}</strong></p>`);
  }

  if (options?.assignedToName?.trim()) {
    lines.push('<p><br></p>', `<p><strong>Assigned to: ${escapeHtml(options.assignedToName.trim())}</strong></p>`);
  }
  if (options?.schedule?.trim()) {
    const formatted = formatScheduleForTeams(options.schedule);
    if (formatted) {
      lines.push(`<p><strong>Scheduled: ${escapeHtml(formatted)}</strong></p>`);
    } else {
      lines.push(`<p><strong>Scheduled: ${escapeHtml(options.schedule)}</strong></p>`);
    }
  }

  return lines.join('\n');
}

function formatScheduleForTeams(schedule: string): string | null {
  try {
    const scheduleDate = new Date(schedule);
    if (isNaN(scheduleDate.getTime())) return null;
    return scheduleDate.toLocaleString('en-AU', {
      timeZone: 'Australia/Sydney',
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  } catch {
    return null;
  }
}

/** Teams HTML colors for notification headings. Yellow is amber so it stays readable. */
const TEAMS_HEADING_COLORS = {
  cancelled: '#DC2626',
  updated: '#CA8A04',
  assigned: '#2563EB',
  repaired: '#16A34A',
  docketReady: '#16A34A'
} as const;

function teamsColoredText(text: string, color: string): string {
  return `<font color="${color}"><span style="color:${color};">${text}</span></font>`;
}

type TeamsHeadingKind = 'cancelled' | 'updated' | 'assigned' | 'repaired' | 'docket_ready';

function teamsHeadingLine(kind: TeamsHeadingKind): string {
  switch (kind) {
    case 'cancelled':
      return `<p><strong>Tech Assignment is ${teamsColoredText('Cancelled', TEAMS_HEADING_COLORS.cancelled)}</strong></p>`;
    case 'updated':
      return `<p><strong>Tech Assignment ${teamsColoredText('Updated', TEAMS_HEADING_COLORS.updated)}</strong></p>`;
    case 'assigned':
      return `<p><strong>${teamsColoredText('Tech Assigned', TEAMS_HEADING_COLORS.assigned)}</strong></p>`;
    case 'repaired':
      return `<p><strong>${teamsColoredText('Repaired', TEAMS_HEADING_COLORS.repaired)}</strong></p>`;
    case 'docket_ready':
      return `<p><strong>${teamsColoredText('Docket Ready', TEAMS_HEADING_COLORS.docketReady)}</strong></p>`;
  }
}

function buildAssignTechHtmlBody(
  workshop: WorkshopRecord,
  options: {
    assignedToName?: string | null;
    schedule?: string | null;
    jobType?: string | null;
    assignedByName?: string | null;
    changeReason?: string | null;
    cancelled?: boolean;
  }
): string {
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
  const location = workshop.site_location?.trim() || 'N/A';

  const isCancelled =
    options.cancelled === true ||
    (!options.assignedToName?.trim() && !!options.changeReason?.trim());
  const isUpdate = !isCancelled && !!options.changeReason?.trim();
  const headingKind: TeamsHeadingKind = isCancelled
    ? 'cancelled'
    : isUpdate
      ? 'updated'
      : 'assigned';
  const lines: string[] = [
    teamsHeadingLine(headingKind),
    `<p>Order #${escapeHtml(orderId)}</p>`,
    `<p>${escapeHtml(company)}</p>`,
    `<p>${escapeHtml(contactLine)}</p>`,
    '<p><br></p>',
    `<p>${escapeHtml(product)}</p>`,
    `<p>${escapeHtml(fault)}</p>`,
    `<p><strong>Location: ${escapeHtml(location)}</strong></p>`
  ];

  const firstOptional = workshop.optional_contacts?.[0];
  const whoToContact = firstOptional
    ? [firstOptional.name, firstOptional.number, firstOptional.email].filter(Boolean).join(' - ') || null
    : null;
  if (whoToContact) {
    lines.push(`<p><strong>Who to Contact: ${escapeHtml(whoToContact)}</strong></p>`);
  }

  if (options.assignedToName?.trim()) {
    lines.push('<p><br></p>', `<p><strong>Assigned to: ${escapeHtml(options.assignedToName.trim())}</strong></p>`);
  } else if (options.changeReason?.trim()) {
    lines.push('<p><br></p>', '<p><strong>Assigned to: Unassigned</strong></p>');
  }
  if (options.jobType?.trim()) {
    lines.push(`<p><strong>Job type: ${escapeHtml(options.jobType.trim())}</strong></p>`);
  }
  if (options.schedule?.trim()) {
    const formatted = formatScheduleForTeams(options.schedule);
    lines.push(`<p><strong>Scheduled: ${escapeHtml(formatted ?? options.schedule)}</strong></p>`);
  }
  if (options.assignedByName?.trim()) {
    lines.push(`<p><strong>Assigned by: ${escapeHtml(options.assignedByName.trim())}</strong></p>`);
  }
  if (options.changeReason?.trim()) {
    lines.push(
      `<p><strong>Change reason: ${escapeHtml(options.changeReason.trim())}</strong></p>`
    );
  }

  const dashboardUrl = techDashboardUrl(workshop.id);
  lines.push(
    '<p><br></p>',
    `<p><a href="${dashboardUrl}">Open Tech Dashboard</a></p>`,
    `<p>${dashboardUrl}</p>`
  );

  return lines.join('\n');
}

function buildCompletedHtmlBody(workshop: WorkshopRecord, triggeredBy: string): string {
  const company =
    workshop.customer_data?.BillingAddress?.BillCompany ?? workshop.customer_name ?? 'N/A';
  const orderId = workshop.order_id ?? 'N/A';
  const product = [workshop.product_name, workshop.make_model].filter(Boolean).join(' ') || 'N/A';
  const fault = workshop.fault_description ?? 'N/A';
  const location = workshop.site_location?.trim() || 'N/A';
  const firstOptional = workshop.optional_contacts?.[0];
  const whoToContact = firstOptional
    ? [firstOptional.name, firstOptional.number, firstOptional.email].filter(Boolean).join(' - ') || null
    : null;

  const lines: string[] = [
    '<p><strong>WORKSHOP COMPLETED</strong></p>',
    `<p>Order #${escapeHtml(orderId)}</p>`,
    `<p>${escapeHtml(company)}</p>`,
    '<p><br></p>',
    `<p>${escapeHtml(product)}</p>`,
    `<p>${escapeHtml(fault)}</p>`,
    `<p><strong>Location: ${escapeHtml(location)}</strong></p>`
  ];
  if (whoToContact) {
    lines.push(`<p><strong>Who to Contact: ${escapeHtml(whoToContact)}</strong></p>`);
  }
  lines.push('<p><br></p>', `<p><strong>Marked as completed by: ${escapeHtml(triggeredBy)}</strong></p>`);

  return lines.join('\n');
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
 * Optional assignedToName and schedule are included in the notification body.
 * Returns true on success, false on failure. Does not throw.
 */
export async function notifyPickupToTeams(
  workshop: WorkshopRecord,
  status: 'pickup' | 'return' = 'pickup',
  options?: { assignedToName?: string | null; schedule?: string | null }
): Promise<boolean> {
  try {
    const body = buildPickupHtmlBody(workshop, status, options);
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

const WORKSHOP_FORM_PUBLIC_BASE =
  'https://rapidcleanillawarra.github.io/rapidtools/workshop/form';

/**
 * Notify Teams when a pickup job has been collected (Mark picked up on deliveries page).
 * Body: linked workshop id/order + "has been picked up by {name}".
 */
export async function notifyWorkshopPickedUpToTeams(
  workshop: WorkshopRecord,
  pickedUpBy: string
): Promise<boolean> {
  try {
    const link = `${WORKSHOP_FORM_PUBLIC_BASE}?workshop_id=${encodeURIComponent(workshop.id)}`;
    const label = escapeHtml(workshop.order_id?.trim() || workshop.id);
    const name = escapeHtml(pickedUpBy.trim() || 'Unknown User');
    const body = `<p><a href="${link}">${label}</a> has been picked up by ${name}</p>`;
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
 * Notify Teams via Power Automate when a workshop is marked as completed.
 * Returns true on success, false on failure. Does not throw.
 */
export async function notifyCompletedToTeams(
  workshop: WorkshopRecord,
  triggeredBy: string
): Promise<boolean> {
  try {
    const body = buildCompletedHtmlBody(workshop, triggeredBy);
    const payload = { body, action: 'workshop_completed' };

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
 * Notify Teams via Power Automate when a technician is assigned a schedule.
 * Returns true on success, false on failure. Does not throw.
 */
export async function notifyAssignTechToTeams(
  workshop: WorkshopRecord,
  options: {
    assignedToName?: string | null;
    schedule?: string | null;
    jobType?: string | null;
    assignedByName?: string | null;
    changeReason?: string | null;
    cancelled?: boolean;
  }
): Promise<boolean> {
  try {
    const dashboardUrl = techDashboardUrl(workshop.id);
    const body = buildAssignTechHtmlBody(workshop, options);
    const payload = {
      body,
      action: 'tech_dashboard',
      url: dashboardUrl,
      buttonUrl: dashboardUrl,
      button: {
        title: 'Open Tech Dashboard',
        url: dashboardUrl
      }
    };

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

    // Upload photos and files first (B2 if configured, else Supabase)
    const { photoUrls, fileUrls } = await uploadWorkshopPhotosAndFiles(
      data.photos,
      data.files,
      data.clientsWorkOrder || 'workshop'
    );

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
    
    // Prepare workshop data (history is stored in workshop_status_history, not here)
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
      comments: data.comments || []
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

    // Insert history into workshop_status_history
    const userEmail = get(currentUser)?.email ?? null;
    const historyEntries = data.history ?? [];
    if (historyEntries.length > 0) {
      const historyRows = historyEntries.map((entry) => ({
        workshop_id: workshop.id,
        timestamp: entry.timestamp,
        user_name: entry.user,
        user_email: userEmail,
        status: entry.status,
        is_creation: entry.isCreation ?? false
      }));
      const { error: historyError } = await supabase
        .from('workshop_status_history')
        .insert(historyRows);
      if (historyError) {
        console.error('Error inserting workshop status history:', historyError);
        throw historyError;
      }
    }

    const historyMap = await getWorkshopHistoryFromTable([workshop.id]);
    (workshop as WorkshopRecord).history = historyMap.get(workshop.id) ?? [];
    return workshop as WorkshopRecord;
  } catch (error) {
    console.error('Error creating workshop:', error);
    throw error;
  }
}

/**
 * Upload workshop photos and files. Uses Backblaze B2 when configured (server env),
 * otherwise falls back to Supabase storage.
 */
export async function uploadWorkshopPhotosAndFiles(
  photos: File[],
  files: File[],
  workOrder: string
): Promise<{ photoUrls: string[]; fileUrls: string[] }> {
  const dynamicWorkOrder =
    workOrder === 'workshop' ? `workshop_${Date.now().toString().slice(-6)}` : workOrder;

  if (!photos?.length && !files?.length) {
    return { photoUrls: [], fileUrls: [] };
  }

  try {
    const formData = new FormData();
    formData.set('workOrder', dynamicWorkOrder);
    photos?.forEach((p) => formData.append('photos', p));
    files?.forEach((f) => formData.append('files', f));

    const res = await fetch('/api/storage/upload-workshop', {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      const body = await res.json();
      return {
        photoUrls: Array.isArray(body.photoUrls) ? body.photoUrls : [],
        fileUrls: Array.isArray(body.fileUrls) ? body.fileUrls : []
      };
    }

    if (res.status === 503) {
      const photoUrls = await uploadWorkshopPhotos(photos ?? [], workOrder);
      const fileUrls = await uploadWorkshopFiles(files ?? [], workOrder);
      return { photoUrls, fileUrls };
    }

    const errText = await res.text();
    throw new Error(errText || `Upload failed: ${res.status}`);
  } catch (err) {
    console.error('B2 upload failed, falling back to Supabase:', err);
    const photoUrls = await uploadWorkshopPhotos(photos ?? [], workOrder);
    const fileUrls = await uploadWorkshopFiles(files ?? [], workOrder);
    return { photoUrls, fileUrls };
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

    if (!data) return null;

    const historyMap = await getWorkshopHistoryFromTable([id]);
    const fromTable = historyMap.get(id);
    const workshop = data as WorkshopRecord;
    if (fromTable?.length) {
      workshop.history = fromTable;
    } else if (workshop.history != null) {
      // Legacy: use workshop.history column if table has no rows
      if (typeof workshop.history === 'string') {
        try {
          workshop.history = JSON.parse(workshop.history) as WorkshopHistoryEntry[];
        } catch {
          workshop.history = [];
        }
      }
      if (!Array.isArray(workshop.history)) {
        workshop.history = [];
      }
    } else {
      workshop.history = [];
    }
    return workshop;
  } catch (error) {
    console.error('Error fetching workshop:', error);
    throw error;
  }
}

/**
 * Get transport assignment(s) for a workshop, optionally filtered by job_status (pickup | return)
 */
export async function getTransportByWorkshopId(
  workshopId: string,
  jobStatus?: 'pickup' | 'return'
): Promise<WorkshopTransportRecord | null> {
  try {
    let query = supabase
      .from('workshop_transport')
      .select('*')
      .eq('workshop_id', workshopId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (jobStatus) {
      query = query.eq('job_status', jobStatus);
    }

    const { data, error } = await query;

    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return (row as WorkshopTransportRecord) ?? null;
  } catch (error) {
    console.error('Error fetching workshop transport:', error);
    throw error;
  }
}

/**
 * Get list of workshop_transport rows with workshop fields for the transport table.
 * Returns flat rows: order_id, product_name, fault_description, site_location, transport_status, created_at (from workshop_transport).
 */
export async function getWorkshopTransportList(): Promise<WorkshopTransportListRow[]> {
  try {
    const { data, error } = await supabase
      .from('workshop_transport')
      .select(
        'id, transport_status, created_at, workshop:workshop_id(order_id, product_name, fault_description, site_location)'
      )
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rows = (data ?? []) as {
      id: string;
      transport_status: 'new' | 'confirmed';
      created_at: string;
      workshop: {
        order_id: string | null;
        product_name: string | null;
        fault_description: string | null;
        site_location: string | null;
      } | null;
    }[];

    return rows.map((r) => ({
      id: r.id,
      order_id: r.workshop?.order_id ?? null,
      product_name: r.workshop?.product_name ?? null,
      fault_description: r.workshop?.fault_description ?? null,
      site_location: r.workshop?.site_location ?? null,
      transport_status: r.transport_status,
      created_at: r.created_at
    }));
  } catch (error) {
    console.error('Error fetching workshop transport list:', error);
    throw error;
  }
}

/**
 * Insert or update a workshop_transport row for a workshop (pickup or return).
 * If a record exists for this workshop_id + job_status, it is updated; otherwise a new row is inserted.
 */
export async function upsertWorkshopTransport(params: {
  workshopId: string;
  jobStatus: 'pickup' | 'return';
  assignedTo?: string | null;
  assignedToName?: string | null;
  schedule?: string | null;
  assignedBy?: string | null;
  assignedByName?: string | null;
  transportStatus?: 'new' | 'confirmed';
}): Promise<WorkshopTransportRecord> {
  try {
    const existing = await getTransportByWorkshopId(params.workshopId, params.jobStatus);
    const payload = {
      workshop_id: params.workshopId,
      job_status: params.jobStatus,
      assigned_to: params.assignedTo ?? null,
      assigned_to_name: params.assignedToName ?? null,
      schedule: params.schedule ?? null,
      assigned_by: params.assignedBy ?? null,
      assigned_by_name: params.assignedByName ?? null,
      transport_status: params.transportStatus ?? 'new'
    };

    if (existing) {
      const { data, error } = await supabase
        .from('workshop_transport')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return data as WorkshopTransportRecord;
    }

    const { data, error } = await supabase
      .from('workshop_transport')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as WorkshopTransportRecord;
  } catch (error) {
    console.error('Error upserting workshop transport:', error);
    throw error;
  }
}

const DELIVERY_TRACKING_SELECT: string[] = [
  'id',
  'status',
  'created_at',
  'updated_at',
  'customer_name',
  'order_id',
  'clients_work_order',
  'product_name',
  'make_model',
  'photo_urls',
  'site_location',
  'fault_description',
  'contact_number'
];

/**
 * Active pickup/return workshops with latest matching transport for delivery tracking.
 * Pending = transport missing or transport_status === 'new'; Done = transport_status === 'confirmed'.
 */
export async function getDeliveryTrackingList(): Promise<DeliveryTrackingRow[]> {
  try {
    const [pickupJobs, returnJobs] = await Promise.all([
      getWorkshops({ status: 'pickup', select: DELIVERY_TRACKING_SELECT }),
      getWorkshops({ status: 'return', select: DELIVERY_TRACKING_SELECT })
    ]);

    const workshops = [...pickupJobs, ...returnJobs];
    if (workshops.length === 0) return [];

    const workshopIds = workshops.map((w) => w.id);
    const { data: transportRows, error } = await supabase
      .from('workshop_transport')
      .select(
        'id, workshop_id, job_status, transport_status, assigned_to_name, schedule, created_at'
      )
      .in('workshop_id', workshopIds)
      .in('job_status', ['pickup', 'return'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    const latestByKey = new Map<
      string,
      {
        id: string;
        transport_status: 'new' | 'confirmed';
        assigned_to_name: string | null;
        schedule: string | null;
        created_at: string;
      }
    >();

    for (const row of transportRows ?? []) {
      const key = `${row.workshop_id}:${row.job_status}`;
      if (latestByKey.has(key)) continue;
      latestByKey.set(key, {
        id: row.id,
        transport_status: row.transport_status as 'new' | 'confirmed',
        assigned_to_name: row.assigned_to_name ?? null,
        schedule: row.schedule ?? null,
        created_at: row.created_at
      });
    }

    return workshops
      .map((workshop) => {
        const job_status = workshop.status as 'pickup' | 'return';
        const transport = latestByKey.get(`${workshop.id}:${job_status}`) ?? null;
        const transport_status = transport?.transport_status ?? null;
        return {
          workshop,
          job_status,
          transport_id: transport?.id ?? null,
          transport_status,
          assigned_to_name: transport?.assigned_to_name ?? null,
          assigned_at: transport?.created_at ?? null,
          schedule: transport?.schedule ?? null,
          is_pending: transport_status !== 'confirmed'
        };
      })
      .sort((a, b) => {
        if (a.is_pending !== b.is_pending) return a.is_pending ? -1 : 1;
        return (
          new Date(b.workshop.updated_at || b.workshop.created_at).getTime() -
          new Date(a.workshop.updated_at || a.workshop.created_at).getTime()
        );
      });
  } catch (error) {
    console.error('Error fetching delivery tracking list:', error);
    throw error;
  }
}

/**
 * Mark a pickup/return transport as confirmed (delivered or returned).
 * Preserves existing assignee/schedule when a transport row already exists.
 */
export async function confirmDeliveryTransport(
  workshopId: string,
  jobStatus: 'pickup' | 'return'
): Promise<WorkshopTransportRecord> {
  try {
    const existing = await getTransportByWorkshopId(workshopId, jobStatus);

    if (existing) {
      const { data, error } = await supabase
        .from('workshop_transport')
        .update({
          transport_status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return data as WorkshopTransportRecord;
    }

    return await upsertWorkshopTransport({
      workshopId,
      jobStatus,
      transportStatus: 'confirmed'
    });
  } catch (error) {
    console.error('Error confirming delivery transport:', error);
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
  select?: string[];
  includeHistory?: boolean;
}): Promise<WorkshopRecord[]> {
  try {
    const selectColumns = filters?.select?.length ? filters.select.join(',') : '*';
    let query = supabase
      .from('workshop')
      .select(selectColumns)
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

    const list = (data ?? []) as WorkshopRecord[];
    const needsHistory =
      filters?.includeHistory !== false &&
      (!filters?.select?.length || filters.select.includes('history'));
    if (needsHistory && list.length > 0) {
      const ids = list.map((w) => w.id);
      const historyMap = await getWorkshopHistoryFromTable(ids);
      for (const workshop of list) {
        workshop.history = historyMap.get(workshop.id) ?? [];
      }
    }
    return list as unknown as WorkshopRecord[];
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
 * Get the active tech schedule row for a workshop (at most one).
 */
export async function getTechScheduleByWorkshopId(
  workshopId: string
): Promise<WorkshopTechScheduleRecord | null> {
  try {
    const { data, error } = await supabase
      .from('workshop_tech_schedule')
      .select('*')
      .eq('workshop_id', workshopId)
      .eq('assignment_status', 'active')
      .maybeSingle();

    if (error) throw error;
    return (data as WorkshopTechScheduleRecord) ?? null;
  } catch (error) {
    console.error('Error fetching workshop tech schedule:', error);
    throw error;
  }
}

/**
 * Get active tech schedules for many workshops (map of workshop_id → active assignment).
 */
export async function getTechSchedulesByWorkshopIds(
  workshopIds: string[]
): Promise<Map<string, WorkshopTechScheduleSummary>> {
  const result = new Map<string, WorkshopTechScheduleSummary>();
  if (workshopIds.length === 0) return result;

  try {
    const { data, error } = await supabase
      .from('workshop_tech_schedule')
      .select('workshop_id, assigned_tech, assigned_tech_name, schedule, job_type')
      .in('workshop_id', workshopIds)
      .eq('assignment_status', 'active');

    if (error) throw error;

    for (const row of data ?? []) {
      result.set(row.workshop_id, {
        assigned_tech: row.assigned_tech ?? null,
        assigned_tech_name: row.assigned_tech_name ?? null,
        schedule: row.schedule ?? null,
        job_type: row.job_type ?? null
      });
    }
    return result;
  } catch (error) {
    console.error('Error fetching workshop tech schedules:', error);
    throw error;
  }
}

/**
 * Get all workshop_tech_schedule rows joined with workshop job details.
 */
export async function getTechJobsSummary(): Promise<TechJobsSummaryRow[]> {
  try {
    const { data, error } = await supabase
      .from('workshop_tech_schedule')
      .select(
        'id, workshop_id, assigned_tech, assigned_tech_name, schedule, job_type, assignment_status, workshop_status, assigned_by, assigned_by_name, change_reason, created_at, updated_at, workshop:workshop_id(customer_name, product_name, order_id, clients_work_order, make_model, serial_number, status, site_location)'
      )
      .order('schedule', { ascending: false, nullsFirst: false });

    if (error) throw error;

    type WorkshopJoin = {
      customer_name: string | null;
      product_name: string | null;
      order_id: string | null;
      clients_work_order: string | null;
      make_model: string | null;
      serial_number: string | null;
      status: string | null;
      site_location: string | null;
    };

    const rows = (data ?? []) as Array<{
      id: string;
      workshop_id: string;
      assigned_tech: string | null;
      assigned_tech_name: string | null;
      schedule: string | null;
      job_type: string | null;
      assignment_status: WorkshopTechAssignmentStatus;
      workshop_status: string | null;
      assigned_by: string | null;
      assigned_by_name: string | null;
      change_reason: string | null;
      created_at: string;
      updated_at: string;
      workshop: WorkshopJoin | WorkshopJoin[] | null;
    }>;

    return rows.map((row) => {
      const workshop = Array.isArray(row.workshop) ? (row.workshop[0] ?? null) : row.workshop;
      return {
        id: row.id,
        workshop_id: row.workshop_id,
        assigned_tech: row.assigned_tech ?? null,
        assigned_tech_name: row.assigned_tech_name ?? null,
        schedule: row.schedule ?? null,
        job_type: row.job_type ?? null,
        assignment_status: row.assignment_status,
        workshop_status: row.workshop_status ?? null,
        assigned_by: row.assigned_by ?? null,
        assigned_by_name: row.assigned_by_name ?? null,
        change_reason: row.change_reason ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        customer_name: workshop?.customer_name ?? null,
        product_name: workshop?.product_name ?? null,
        order_id: workshop?.order_id ?? null,
        clients_work_order: workshop?.clients_work_order ?? null,
        make_model: workshop?.make_model ?? null,
        serial_number: workshop?.serial_number ?? null,
        current_workshop_status: workshop?.status ?? null,
        site_location: workshop?.site_location ?? null
      };
    });
  } catch (error) {
    console.error('Error fetching tech jobs summary:', error);
    throw error;
  }
}

/**
 * Get all tech schedule records (full assignment history) for a workshop.
 */
export async function getWorkshopTechScheduleHistory(
  workshopId: string
): Promise<WorkshopTechScheduleRecord[]> {
  try {
    const { data, error } = await supabase
      .from('workshop_tech_schedule')
      .select('*')
      .eq('workshop_id', workshopId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as WorkshopTechScheduleRecord[]) ?? [];
  } catch (error) {
    console.error('Error fetching tech schedule history:', error);
    throw error;
  }
}

/**
 * Append a comment/note to a workshop record.
 */
export async function addWorkshopComment(
  workshopId: string,
  text: string,
  author: string
): Promise<Array<{ id: string; text: string; author: string; created_at: string }>> {
  try {
    const { data: existingWorkshop, error: fetchError } = await supabase
      .from('workshop')
      .select('comments')
      .eq('id', workshopId)
      .single();

    if (fetchError) throw fetchError;

    let existingComments: Array<{ id: string; text: string; author: string; created_at: string }> = [];
    if (existingWorkshop?.comments) {
      if (Array.isArray(existingWorkshop.comments)) {
        existingComments = existingWorkshop.comments;
      } else if (typeof existingWorkshop.comments === 'string') {
        try {
          existingComments = JSON.parse(existingWorkshop.comments);
        } catch {
          existingComments = [];
        }
      }
    }

    const newComment = {
      id: Date.now().toString(),
      text: text.trim(),
      author: author.trim() || 'Unknown User',
      created_at: new Date().toISOString()
    };

    const updatedComments = [...existingComments, newComment];

    const { error: updateError } = await supabase
      .from('workshop')
      .update({
        comments: updatedComments,
        updated_at: new Date().toISOString()
      })
      .eq('id', workshopId);

    if (updateError) throw updateError;

    return updatedComments;
  } catch (error) {
    console.error('Error adding workshop comment:', error);
    throw error;
  }
}


/**
 * Close the current active schedule row (superseded or cancelled).
 * When cancelling (unassign), optional changeReason is stored on the closed row.
 */
async function closeActiveTechSchedule(
  workshopId: string,
  nextStatus: 'superseded' | 'cancelled',
  changeReason?: string | null
): Promise<void> {
  const update: {
    assignment_status: 'superseded' | 'cancelled';
    updated_at: string;
    change_reason?: string;
  } = {
    assignment_status: nextStatus,
    updated_at: new Date().toISOString()
  };
  if (nextStatus === 'cancelled' && changeReason?.trim()) {
    update.change_reason = changeReason.trim();
  }

  const { error } = await supabase
    .from('workshop_tech_schedule')
    .update(update)
    .eq('workshop_id', workshopId)
    .eq('assignment_status', 'active');

  if (error) throw error;
}

/**
 * Create a new active workshop_tech_schedule row, superseding any previous active row.
 * Pass assignedTech null to unassign (cancels active; no new row).
 */
export async function createWorkshopTechSchedule(params: {
  workshopId: string;
  assignedTech?: string | null;
  assignedTechName?: string | null;
  schedule?: string | null;
  jobType?: string | null;
  workshopStatus?: string | null;
  assignedBy?: string | null;
  assignedByName?: string | null;
  changeReason?: string | null;
}): Promise<WorkshopTechScheduleRecord | null> {
  try {
    const assignedTech = params.assignedTech ?? null;
    const changeReason = params.changeReason?.trim() || null;

    if (!assignedTech) {
      await closeActiveTechSchedule(params.workshopId, 'cancelled', changeReason);
      return null;
    }

    await closeActiveTechSchedule(params.workshopId, 'superseded');

    const payload = {
      workshop_id: params.workshopId,
      assigned_tech: assignedTech,
      assigned_tech_name: params.assignedTechName ?? null,
      schedule: params.schedule ?? null,
      job_type: params.jobType ?? null,
      workshop_status: params.workshopStatus ?? null,
      assignment_status: 'active' as const,
      assigned_by: params.assignedBy ?? null,
      assigned_by_name: params.assignedByName ?? null,
      change_reason: changeReason,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('workshop_tech_schedule')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as WorkshopTechScheduleRecord;
  } catch (error) {
    console.error('Error creating workshop tech schedule:', error);
    throw error;
  }
}

/**
 * Assign a technician via workshop_tech_schedule only (history preserved).
 * Does not write assigned_tech columns on workshop.
 */
export async function assignWorkshopTech(
  workshopId: string,
  assignedTech: string | null,
  assignedTechName: string | null,
  options?: {
    schedule?: string | null;
    jobType?: string | null;
    workshopStatus?: string | null;
    assignedBy?: string | null;
    assignedByName?: string | null;
    changeReason?: string | null;
  }
): Promise<void> {
  try {
    await createWorkshopTechSchedule({
      workshopId,
      assignedTech,
      assignedTechName,
      schedule: options?.schedule ?? null,
      jobType: options?.jobType ?? null,
      workshopStatus: options?.workshopStatus ?? null,
      assignedBy: options?.assignedBy ?? null,
      assignedByName: options?.assignedByName ?? null,
      changeReason: options?.changeReason ?? null
    });
  } catch (error) {
    console.error('Error assigning workshop tech:', error);
    throw error;
  }
}

/**
 * Update workshop
 */
export async function updateWorkshop(id: string, data: Partial<WorkshopFormData>): Promise<WorkshopRecord> {
  try {
    // Handle photo and file uploads if new files are provided (B2 if configured, else Supabase)
    const hasNewPhotos = data.photos && data.photos.length > 0;
    const hasNewFiles = data.files && data.files.length > 0;
    let newPhotoUrls: string[] = [];
    let newFileUrls: string[] = [];
    if (hasNewPhotos || hasNewFiles) {
      const result = await uploadWorkshopPhotosAndFiles(
        data.photos ?? [],
        data.files ?? [],
        data.clientsWorkOrder || 'workshop'
      );
      newPhotoUrls = result.photoUrls;
      newFileUrls = result.fileUrls;
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

    // Note: History is stored in workshop_status_history, not workshop.history

    // Note: We don't update created_by on updates as it should remain the original creator's name

    // Update photo_urls - only update when there are actual changes
    const hasExistingPhotos = data.existingPhotoUrls && data.existingPhotoUrls.length > 0;
    const hasNewPhotoUrls = newPhotoUrls.length > 0;

    // Only update photo_urls if:
    // 1. There are new photos to upload (merge with existing)
    // 2. existingPhotoUrls is explicitly provided (even if empty, to allow clearing photos)
    if (hasNewPhotoUrls || data.existingPhotoUrls !== undefined) {
      let finalPhotoUrls: string[] = [];

      if (hasNewPhotoUrls && hasExistingPhotos) {
        // Merge new photos with existing photos
        finalPhotoUrls = [...(data.existingPhotoUrls || []), ...newPhotoUrls];
      } else if (hasNewPhotoUrls && !hasExistingPhotos) {
        // Only new photos
        finalPhotoUrls = newPhotoUrls;
      } else if (!hasNewPhotoUrls && data.existingPhotoUrls !== undefined) {
        // No new photos, use existing photos as-is (or empty if clearing)
        finalPhotoUrls = data.existingPhotoUrls || [];
      }

      updateData.photo_urls = finalPhotoUrls;
      console.log('Updating photo_urls with:', finalPhotoUrls, {
        hasNewPhotoUrls,
        hasExistingPhotos,
        existingPhotoUrlsLength: data.existingPhotoUrls?.length || 0,
        newPhotoUrlsLength: newPhotoUrls.length
      });
    }

    // Update file_urls - only update when there are actual changes
    const hasExistingFiles = data.existingFileUrls && data.existingFileUrls.length > 0;
    const hasNewFileUrls = newFileUrls.length > 0;

    // Only update file_urls if:
    // 1. There are new files to upload (merge with existing)
    // 2. existingFileUrls is explicitly provided (even if empty, to allow clearing files)
    if (hasNewFileUrls || data.existingFileUrls !== undefined) {
      let finalFileUrls: string[] = [];

      if (hasNewFileUrls && hasExistingFiles) {
        // Merge new files with existing files
        finalFileUrls = [...(data.existingFileUrls || []), ...newFileUrls];
      } else if (hasNewFileUrls && !hasExistingFiles) {
        // Only new files
        finalFileUrls = newFileUrls;
      } else if (!hasNewFileUrls && data.existingFileUrls !== undefined) {
        // No new files, use existing files as-is (or empty if clearing)
        finalFileUrls = data.existingFileUrls || [];
      }

      updateData.file_urls = finalFileUrls;
      console.log('Updating file_urls with:', finalFileUrls, {
        hasNewFileUrls,
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

    // Insert new history entries into workshop_status_history (skip ones that already exist)
    const historyEntries = data.history ?? [];
    if (historyEntries.length > 0) {
      const { data: existingRows } = await supabase
        .from('workshop_status_history')
        .select('timestamp, user_name, status, is_creation')
        .eq('workshop_id', id);

      const existingSet = new Set(
        (existingRows ?? []).map(
          (r) =>
            `${r.timestamp}|${r.user_name}|${r.status}|${r.is_creation ?? false}`
        )
      );

      const toInsert = historyEntries.filter((entry) => {
        const key = `${entry.timestamp}|${entry.user}|${entry.status}|${entry.isCreation ?? false}`;
        return !existingSet.has(key);
      });

      if (toInsert.length > 0) {
        const userEmail = get(currentUser)?.email ?? null;
        const historyRows = toInsert.map((entry) => ({
          workshop_id: id,
          timestamp: entry.timestamp,
          user_name: entry.user,
          user_email: userEmail,
          status: entry.status,
          is_creation: entry.isCreation ?? false
        }));
        const { error: historyError } = await supabase
          .from('workshop_status_history')
          .insert(historyRows);
        if (historyError) {
          console.error('Error inserting workshop status history:', historyError);
          throw historyError;
        }
      }
    }

    const historyMap = await getWorkshopHistoryFromTable([id]);
    (workshop as WorkshopRecord).history = historyMap.get(id) ?? [];
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
 * Get job counts grouped by status for the workshop table.
 * @param options.excludeDeleted - when true, excludes rows with status 'deleted' (default true)
 * @param options.dateFrom - optional start of date range (UTC start-of-day used for updated_at filter)
 * @param options.dateTo - optional end of date range (UTC end-of-day used for updated_at filter)
 * When both dateFrom and dateTo are set, only rows with updated_at in that range are counted.
 */
export async function getJobStatusCounts(options?: {
  excludeDeleted?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}): Promise<{ status: string; count: number }[]> {
  const excludeDeleted = options?.excludeDeleted !== false;
  const dateFrom = options?.dateFrom;
  const dateTo = options?.dateTo;
  const useDateFilter = dateFrom != null && dateTo != null;
  try {
    let query = supabase.from('workshop').select('status');
    if (excludeDeleted) {
      query = query.neq('status', 'deleted');
    }
    if (useDateFilter) {
      const startOfDay = new Date(dateFrom);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(dateTo);
      endOfDay.setUTCHours(23, 59, 59, 999);
      query = query
        .gte('updated_at', startOfDay.toISOString())
        .lte('updated_at', endOfDay.toISOString());
    }
    const { data, error } = await query;
    if (error) throw error;
    const counts: Record<string, number> = {};
    (data ?? []).forEach((row: { status: string | null }) => {
      const s = row.status ?? 'unknown';
      counts[s] = (counts[s] ?? 0) + 1;
    });
    return Object.entries(counts)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  } catch (error) {
    console.error('Error getting job status counts:', error);
    throw error;
  }
}

/**
 * Get status history row counts by user for a custom date range (inclusive).
 * date_from / date_to are treated as start-of-day and end-of-day UTC respectively.
 * Returns same shape as getStatusHistoryCountsByUserThisWeek for consistent UI.
 */
export async function getStatusHistoryCountsByUserDateRange(
  dateFrom: Date,
  dateTo: Date
): Promise<{ user_email: string; full_name: string | null; count: number }[]> {
  const startOfDay = new Date(dateFrom);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(dateTo);
  endOfDay.setUTCHours(23, 59, 59, 999);

  try {
    const { data, error } = await supabase.rpc('get_workshop_status_history_counts_by_date_range', {
      p_date_from: startOfDay.toISOString(),
      p_date_to: endOfDay.toISOString()
    });
    if (error) throw error;
    const rows = (data ?? []) as {
      user_email: string | null;
      full_name?: string | null;
      fullName?: string | null;
      count: number;
    }[];
    let result = rows
      .filter((r) => r.user_email != null)
      .map((r) => ({
        user_email: r.user_email!,
        full_name: r.full_name ?? r.fullName ?? null,
        count: Number(r.count)
      }));

    const needsLookup = result.some((r) => r.full_name == null);
    if (needsLookup && result.length > 0) {
      const emails = [...new Set(result.map((r) => r.user_email))];
      const { data: users } = await supabase
        .from('users')
        .select('email, full_name')
        .in('email', emails);
      const emailToName = new Map(
        (users ?? []).map((u) => [u.email as string, (u.full_name as string) ?? null])
      );
      result = result.map((r) => ({
        ...r,
        full_name: r.full_name ?? emailToName.get(r.user_email) ?? null
      }));
    }
    return result;
  } catch (error) {
    console.error('Error getting status history counts by date range:', error);
    throw error;
  }
}

/**
 * Get status history row counts by user for the current week (UTC).
 * Returns full_name from public.users when available; user_email is always present for fallback.
 * Uses RPC get_workshop_status_history_counts_this_week when it returns full_name; otherwise
 * looks up full_name from public.users by email so the UI shows names even before the migration is applied.
 */
export async function getStatusHistoryCountsByUserThisWeek(): Promise<
  { user_email: string; full_name: string | null; count: number }[]
> {
  try {
    const { data, error } = await supabase.rpc('get_workshop_status_history_counts_this_week');
    if (error) throw error;
    const rows = (data ?? []) as {
      user_email: string | null;
      full_name?: string | null;
      fullName?: string | null;
      count: number;
    }[];
    let result = rows
      .filter((r) => r.user_email != null)
      .map((r) => ({
        user_email: r.user_email!,
        full_name: r.full_name ?? r.fullName ?? null,
        count: Number(r.count)
      }));

    // If RPC didn't return full_name (e.g. old migration), look up from public.users
    const needsLookup = result.some((r) => r.full_name == null);
    if (needsLookup && result.length > 0) {
      const emails = [...new Set(result.map((r) => r.user_email))];
      const { data: users } = await supabase
        .from('users')
        .select('email, full_name')
        .in('email', emails);
      const emailToName = new Map(
        (users ?? []).map((u) => [u.email as string, (u.full_name as string) ?? null])
      );
      result = result.map((r) => ({
        ...r,
        full_name: r.full_name ?? emailToName.get(r.user_email) ?? null
      }));
    }
    return result;
  } catch (error) {
    console.error('Error getting status history counts by user this week:', error);
    throw error;
  }
}

/**
 * Get status history counts by status for a single user in a date range (inclusive).
 * dateFrom/dateTo are treated as start-of-day and end-of-day UTC.
 * Used by "Status breakdown by user" bar chart.
 */
export async function getStatusHistoryCountsByUserByStatus(
  userEmail: string,
  dateFrom: Date,
  dateTo: Date
): Promise<{ status: string; count: number }[]> {
  const startOfDay = new Date(dateFrom);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(dateTo);
  endOfDay.setUTCHours(23, 59, 59, 999);

  try {
    const { data, error } = await supabase.rpc('get_workshop_status_history_counts_by_user', {
      p_user_email: userEmail,
      p_date_from: startOfDay.toISOString(),
      p_date_to: endOfDay.toISOString()
    });
    if (error) throw error;
    const rows = (data ?? []) as { status: string | null; count: number }[];
    return rows
      .filter((r) => r.status != null)
      .map((r) => ({ status: r.status!, count: Number(r.count) }));
  } catch (error) {
    console.error('Error getting status history counts by user by status:', error);
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
