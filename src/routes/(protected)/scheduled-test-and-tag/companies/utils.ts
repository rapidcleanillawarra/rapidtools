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
  serverTimestamp 
} from 'firebase/firestore';
import { get } from 'svelte/store';
import type { Schedule, ScheduleFormData, ValidationErrors } from './types';

// CRUD Operations
export async function createSchedule(scheduleData: ScheduleFormData): Promise<Schedule> {
  console.log('=== CREATING SCHEDULE IN FIREBASE ===');
  console.log('Data:', scheduleData);
  
  try {
    // Prepare data for Firestore
    const firestoreData = {
      ...scheduleData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    // Add to Firestore
    const docRef = await addDoc(collection(db, 'stt'), firestoreData);
    console.log('Document created with ID:', docRef.id);

    // Create the new schedule with Firestore document ID
    const newSchedule: Schedule = {
      ...scheduleData,
      id: parseInt(docRef.id) // Use Firestore document ID as numeric ID
    };
    
    // Update local store
    schedulesStore.update(schedules => [...schedules, newSchedule]);
    
    console.log('Schedule created successfully');
    return newSchedule;
  } catch (error) {
    console.error('Error creating schedule:', error);
    throw new Error('Failed to create schedule. Please try again.');
  }
}

export async function updateSchedule(id: number, scheduleData: ScheduleFormData): Promise<Schedule> {
  try {
    // Find the Firestore document by matching the local ID
    const querySnapshot = await getDocs(collection(db, 'stt'));
    let docId: string | null = null;
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.id === id) {
        docId = doc.id;
      }
    });

    if (!docId) {
      throw new Error('Schedule not found in Firestore');
    }

    // Update in Firestore
    const docRef = doc(db, 'stt', docId);
    await updateDoc(docRef, {
      ...scheduleData,
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

export async function deleteSchedule(id: number): Promise<void> {
  try {
    // Find the Firestore document by matching the local ID
    const querySnapshot = await getDocs(collection(db, 'stt'));
    let docId: string | null = null;
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.id === id) {
        docId = doc.id;
      }
    });

    if (!docId) {
      throw new Error('Schedule not found in Firestore');
    }

    // Delete from Firestore
    const docRef = doc(db, 'stt', docId);
    await deleteDoc(docRef);
    
    // Update local store
    schedulesStore.update(schedules => 
      schedules.filter(schedule => schedule.id !== id)
    );
    
    console.log('Schedule deleted successfully from Firestore');
  } catch (error) {
    console.error('Error deleting schedule from Firestore:', error);
    throw new Error('Failed to delete schedule. Please try again.');
  }
}

export async function getScheduleById(id: number): Promise<Schedule | undefined> {
  const schedules = get(schedulesStore);
  return schedules.find(schedule => schedule.id === id);
}

// Load schedules from Firestore
export async function loadSchedulesFromFirestore(): Promise<void> {
  try {
    const querySnapshot = await getDocs(query(collection(db, 'stt'), orderBy('createdAt', 'desc')));
    const schedules: Schedule[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      schedules.push({
        id: data.id || parseInt(doc.id),
        company: data.company,
        start_month: data.start_month,
        occurence: data.occurence,
        information: data.information || [],
        notes: data.notes || [],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
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
  
  // Information validation - only validate locations that have some data
  if (schedule.information && schedule.information.length > 0) {
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