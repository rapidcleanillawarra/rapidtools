import { db } from '$lib/firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  type DocumentData 
} from 'firebase/firestore';

export interface STTEvent {
  id?: string; // Firestore document ID
  information_id: string; // From the source JSON structure
  schedule_id: number; // From the source JSON structure
  company: string;
  sub_company_name: string;
  location: string;
  start_date: string; // ISO string
  end_date: string; // ISO string
  title: string;
  backgroundColor: string;
  created_at?: any; // serverTimestamp
  updated_at?: any; // serverTimestamp
  created_by_uid?: string;
  created_by_email?: string;
}

const COLLECTION_NAME = 'stt_events';

// Load all STT events from Firestore
export async function loadSTTEvents(): Promise<STTEvent[]> {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    const events: STTEvent[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      events.push({
        id: doc.id,
        ...data
      } as STTEvent);
    });
    
    return events;
  } catch (error) {
    console.error('Error loading STT events:', error);
    throw error;
  }
}

// Save a new STT event to Firestore
export async function saveSTTEvent(event: Omit<STTEvent, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
  try {
    const eventData = {
      ...event,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(db, COLLECTION_NAME), eventData);
    return docRef.id;
  } catch (error) {
    console.error('Error saving STT event:', error);
    throw error;
  }
}

// Update an existing STT event
export async function updateSTTEvent(eventId: string, updates: Partial<STTEvent>): Promise<void> {
  try {
    const eventRef = doc(db, COLLECTION_NAME, eventId);
    await updateDoc(eventRef, {
      ...updates,
      updated_at: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating STT event:', error);
    throw error;
  }
}

// Delete an STT event
export async function deleteSTTEvent(eventId: string): Promise<void> {
  try {
    const eventRef = doc(db, COLLECTION_NAME, eventId);
    await deleteDoc(eventRef);
  } catch (error) {
    console.error('Error deleting STT event:', error);
    throw error;
  }
}

// Find event by information_id and schedule_id
export async function findEventByInfoAndSchedule(information_id: string, schedule_id: number): Promise<STTEvent | null> {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('information_id', '==', information_id),
      where('schedule_id', '==', schedule_id)
    );
    
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      } as STTEvent;
    }
    
    return null;
  } catch (error) {
    console.error('Error finding STT event:', error);
    throw error;
  }
}

// Convert CalendarEvent to STTEvent format
export function calendarEventToSTTEvent(
  calendarEvent: any, 
  locationInfo: any, 
  schedule: any,
  userUid?: string,
  userEmail?: string
): Omit<STTEvent, 'id' | 'created_at' | 'updated_at'> {
  return {
    information_id: locationInfo.information_id,
    schedule_id: schedule.id,
    company: schedule.company,
    sub_company_name: locationInfo.sub_company_name,
    location: locationInfo.location,
    start_date: calendarEvent.start,
    end_date: calendarEvent.end || calendarEvent.start,
    title: calendarEvent.title,
    backgroundColor: calendarEvent.backgroundColor,
    created_by_uid: userUid,
    created_by_email: userEmail
  };
}

// Convert STTEvent to CalendarEvent format
export function sttEventToCalendarEvent(sttEvent: STTEvent): any {
  return {
    id: sttEvent.id,
    title: sttEvent.title,
    start: sttEvent.start_date,
    end: sttEvent.end_date,
    backgroundColor: sttEvent.backgroundColor,
    extendedProps: {
      location: sttEvent.location,
      company: sttEvent.company,
      scheduleId: sttEvent.schedule_id,
      infoIndex: 0, // This will be calculated when mapping
      occurrenceIndex: 0
    }
  };
} 