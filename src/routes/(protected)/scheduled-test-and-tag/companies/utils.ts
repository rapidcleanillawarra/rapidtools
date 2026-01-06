import { schedulesStore } from '../stores';
import { db } from '$lib/firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  where,
  serverTimestamp
} from 'firebase/firestore';
import { get } from 'svelte/store';
import type { Schedule, ScheduleFormData, ValidationErrors } from './types';

// Constants
export const DEFAULT_COLOR = '#3b82f6';

// CRUD Operations
export async function createSchedule(scheduleData: ScheduleFormData): Promise<Schedule> {
  console.log('=== CREATING SCHEDULE IN FIREBASE ===');
  console.log('Data:', scheduleData);

  try {
    // Add to Firestore first to get the document ID
    const docRef = await addDoc(collection(db, 'stt'), {
      ...scheduleData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log('Document created with ID:', docRef.id);

    // Create the new schedule with Firestore document ID
    const newSchedule: Schedule = {
      ...scheduleData,
      id: docRef.id // Use Firestore document ID directly as string
    };

    // Update the Firestore document to include the ID
    await updateDoc(docRef, { id: docRef.id });

    // Update local store
    schedulesStore.update(schedules => [...schedules, newSchedule]);

    console.log('Schedule created successfully');
    return newSchedule;
  } catch (error) {
    console.error('Error creating schedule:', error);
    throw new Error('Failed to create schedule. Please try again.');
  }
}

export async function updateSchedule(id: string, scheduleData: ScheduleFormData): Promise<Schedule> {
  try {
    // Use the ID directly as the Firestore document ID
    const docRef = doc(db, 'stt', id);

    // Update in Firestore
    await updateDoc(docRef, {
      ...scheduleData,
      id, // Keep the ID in Firestore
      updatedAt: serverTimestamp()
    });

    // Create updated schedule
    const updatedSchedule: Schedule = {
      ...scheduleData,
      id
    };

    // Update local store
    schedulesStore.update(schedules =>
      schedules.map(schedule =>
        schedule.id === id ? updatedSchedule : schedule
      )
    );

    console.log('Schedule updated successfully in Firestore');
    return updatedSchedule;
  } catch (error) {
    console.error('Error updating schedule in Firestore:', error);
    throw new Error('Failed to update schedule. Please try again.');
  }
}

export async function deleteSchedule(id: string): Promise<void> {
  try {
    // Use the ID directly as the Firestore document ID
    const docRef = doc(db, 'stt', id);

    // First, soft delete all associated STT events
    const sttEventsQuery = query(
      collection(db, 'stt_events'),
      where('schedule_id', '==', parseInt(id))
      // where('is_deleted', '!=', true) // Removed to include docs without field
    );

    const sttEventsSnapshot = await getDocs(sttEventsQuery);
    const softDeletePromises = sttEventsSnapshot.docs
      .filter(doc => doc.data().is_deleted !== true) // Only update if not already deleted
      .map(doc =>
        updateDoc(doc.ref, {
          is_deleted: true,
          deleted_at: serverTimestamp()
        })
      );

    if (softDeletePromises.length > 0) {
      await Promise.all(softDeletePromises);
      console.log(`Soft deleted ${softDeletePromises.length} associated STT events`);
    }

    // Soft delete the schedule from Firestore
    await updateDoc(docRef, {
      isDeleted: true,
      deletedAt: serverTimestamp()
    });

    // Update local store
    schedulesStore.update(schedules =>
      schedules.filter(schedule => schedule.id !== id)
    );

    console.log('Schedule and associated events soft deleted successfully from Firestore');
  } catch (error) {
    console.error('Error soft deleting schedule from Firestore:', error);
    throw new Error('Failed to delete schedule. Please try again.');
  }
}

export async function getScheduleById(id: string): Promise<Schedule | undefined> {
  const schedules = get(schedulesStore);
  return schedules.find(schedule => schedule.id === id);
}

// Load schedules from Firestore
export async function loadSchedulesFromFirestore(): Promise<void> {
  try {
    const querySnapshot = await getDocs(
      query(
        collection(db, 'stt'),
        // where('isDeleted', '!=', true), // REMOVED: potentially filters out docs without field
        orderBy('createdAt', 'desc')
      )
    );
    const schedules: Schedule[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Filter out soft-deleted schedules manually since valid docs might miss the field
      if (data.isDeleted === true) return;

      schedules.push({
        id: data.id || doc.id, // Use existing ID or Firestore document ID as string
        company: data.company,
        start_month: data.start_month,
        occurence: data.occurence,
        color: data.color || DEFAULT_COLOR, // Default to blue if no color is set
        information: data.information || [],
        notes: data.notes || [],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        deletedAt: data.deletedAt,
        isDeleted: data.isDeleted
      });
    });

    // Update local store with Firestore data
    schedulesStore.set(schedules);
    console.log('Schedules loaded from Firestore:', schedules.length);
  } catch (error) {
    console.error('Error loading schedules from Firestore:', error);
    throw new Error('Failed to load schedules from database.');
  }
}

// Validation
export function validateSchedule(schedule: ScheduleFormData): ValidationErrors {
  console.log('=== VALIDATION START ===');
  console.log('Input schedule:', schedule);

  const errors: ValidationErrors = {};

  // Company validation
  if (!schedule.company?.trim()) {
    errors.company = 'Company name is required';
    console.log('Company validation failed');
  }

  // Start month validation
  if (schedule.start_month < 1 || schedule.start_month > 12) {
    errors.start_month = 'Start month must be between 1 and 12';
    console.log('Start month validation failed:', schedule.start_month);
  }

  // Occurrence validation
  if (schedule.occurence < 1 || schedule.occurence > 12) {
    errors.occurence = 'Occurrence must be between 1 and 12';
    console.log('Occurrence validation failed:', schedule.occurence);
  }

  // Color validation
  if (!schedule.color?.trim()) {
    errors.color = 'Color is required';
    console.log('Color validation failed');
  }

  // Information validation - require at least one location with at least one contact
  if (!schedule.information || schedule.information.length === 0) {
    errors.information_required = 'At least one location is required';
    console.log('No locations provided');
  } else {
    console.log('Processing information array with', schedule.information.length, 'items');
    errors.information = {};
    schedule.information.forEach((info, index) => {
      const infoKey = index.toString();
      errors.information![infoKey] = {};

      // Only validate if at least one field has data
      const hasLocationData = info.sub_company_name?.trim() || info.location?.trim() ||
        (info.contacts && info.contacts.some(contact =>
          contact.name?.trim() || contact.phone?.trim() || contact.email?.trim()
        ));

      console.log(`Location ${index} has data:`, hasLocationData);
      console.log(`Location ${index} data:`, info);

      if (hasLocationData) {
        // If location has any data, validate required fields
        if (!info.sub_company_name?.trim()) {
          errors.information![infoKey].sub_company_name = 'Sub-company name is required';
          console.log(`Location ${index} sub_company_name validation failed`);
        }

        if (!info.location?.trim()) {
          errors.information![infoKey].location = 'Location is required';
          console.log(`Location ${index} location validation failed`);
        }

        // Contact validation - only validate contacts that have some data
        if (info.contacts && info.contacts.length > 0) {
          console.log(`Processing ${info.contacts.length} contacts for location ${index}`);
          errors.information![infoKey].contacts = {};
          info.contacts.forEach((contact, contactIndex) => {
            const contactKey = contactIndex.toString();
            errors.information![infoKey].contacts![contactKey] = {};

            // Only validate if contact has any data
            const hasContactData = contact.name?.trim() || contact.phone?.trim() || contact.email?.trim();

            console.log(`Contact ${contactIndex} has data:`, hasContactData);
            console.log(`Contact ${contactIndex} data:`, contact);

            if (hasContactData) {
              if (!contact.name?.trim()) {
                errors.information![infoKey].contacts![contactKey].name = 'Contact name is required';
                console.log(`Contact ${contactIndex} name validation failed`);
              }

              if (contact.email && !isValidEmail(contact.email)) {
                errors.information![infoKey].contacts![contactKey].email = 'Invalid email format';
                console.log(`Contact ${contactIndex} email validation failed`);
              }
            }

            // Remove empty contact error objects immediately
            if (Object.keys(errors.information![infoKey].contacts![contactKey]).length === 0) {
              console.log(`Removing empty contact errors for contact ${contactIndex}`);
              delete errors.information![infoKey].contacts![contactKey];
            }
          });

          // Remove empty contacts error object if no contact errors remain
          if (Object.keys(errors.information![infoKey].contacts!).length === 0) {
            console.log(`Removing empty contacts errors for location ${index}`);
            delete errors.information![infoKey].contacts;
          }
        }
      }

      // Remove empty location error objects
      if (Object.keys(errors.information![infoKey]).length === 0) {
        console.log(`Removing empty location errors for location ${index}`);
        delete errors.information![infoKey];
      }
    });

    // Remove empty information error object
    if (Object.keys(errors.information!).length === 0) {
      console.log('Removing empty information errors');
      delete errors.information;
    }

    // Check if at least one location has at least one contact
    const hasLocationWithContact = schedule.information.some(info =>
      info.contacts && info.contacts.length > 0 &&
      info.contacts.some(contact => contact.name && contact.name.trim().length > 0)
    );

    if (!hasLocationWithContact) {
      errors.information_required = 'At least one location must have at least one contact with a name';
      console.log('No location has a valid contact');
    }
  }

  // Notes validation - only validate notes that have some data
  if (schedule.notes && schedule.notes.length > 0) {
    console.log('Processing notes array with', schedule.notes.length, 'items');
    errors.notes = {};
    schedule.notes.forEach((note, index) => {
      const noteKey = index.toString();
      errors.notes![noteKey] = {};

      // Only validate if note has any data
      const hasNoteData = note.title?.trim() || note.content?.trim();

      console.log(`Note ${index} has data:`, hasNoteData);
      console.log(`Note ${index} data:`, note);

      if (hasNoteData) {
        if (!note.title?.trim()) {
          errors.notes![noteKey].title = 'Note title is required';
          console.log(`Note ${index} title validation failed`);
        }

        if (!note.content?.trim()) {
          errors.notes![noteKey].content = 'Note content is required';
          console.log(`Note ${index} content validation failed`);
        }
      }

      // Remove empty note error objects
      if (Object.keys(errors.notes![noteKey]).length === 0) {
        console.log(`Removing empty note errors for note ${index}`);
        delete errors.notes![noteKey];
      }
    });

    // Remove empty notes error object
    if (Object.keys(errors.notes!).length === 0) {
      console.log('Removing empty notes errors');
      delete errors.notes;
    }
  }

  console.log('=== VALIDATION END ===');
  console.log('Final errors object:', errors);
  console.log('Final errors keys:', Object.keys(errors));

  if (Object.keys(errors).length > 0) {
    console.log('=== VALIDATION FAILED ===');
    console.log('Errors:', errors);
  } else {
    console.log('=== VALIDATION PASSED ===');
  }

  return errors;
}

// Helper functions
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || 'Unknown';
}

export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // Format as Australian phone number
  if (digits.length === 10) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
  }

  return phone; // Return original if can't format
}

// Color utilities
function hsvToHex(h: number, s: number, v: number): string {
  let r: number = 0, g: number = 0, b: number = 0;

  let i = Math.floor(h * 6);
  let f = h * 6 - i;
  let p = v * (1 - s);
  let q = v * (1 - f * s);
  let t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }

  const toHex = (x: number): string => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function getDistinctColors(n = 25, excludeColors: string[] = []): string[] {
  const colors: string[] = [];
  for (let i = 0; i < n; i++) {
    const h = i / n;      // hue: 0.0 to 1.0
    const s = 0.75;       // saturation
    const v = 0.9;        // brightness
    const color = hsvToHex(h, s, v);

    // Only add color if it's not in the exclude list
    if (!excludeColors.includes(color)) {
      colors.push(color);
    }
  }
  return colors;
}

// Helper function to get available colors (excluding already used ones)
export function getAvailableColors(schedules: any[], currentColor?: string, isCreateMode: boolean = false): string[] {
  // Get all currently used colors
  const usedColors = schedules
    .map(schedule => schedule.color)
    .filter(color => color && color !== currentColor); // Exclude current color if editing

  // If in create mode and there's a current color (default), also exclude it
  if (isCreateMode && currentColor) {
    usedColors.push(currentColor);
  }

  // Get distinct colors excluding used ones
  return getDistinctColors(25, usedColors);
} 