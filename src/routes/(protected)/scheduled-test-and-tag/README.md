# Scheduled Test and Tag - Firestore Integration

This document explains the Firebase Firestore integration for the Scheduled Test and Tag (STT) events system.

## Overview

The STT events are stored in the `stt_events` collection in Firebase Firestore. Each event represents a scheduled test and tag appointment for a specific location within a company.

## Data Structure

### STTEvent Interface

```typescript
interface STTEvent {
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
```

### Key Fields

- **information_id**: Unique identifier from the source JSON structure, used to link events to specific locations
- **schedule_id**: Links the event to a specific schedule/company
- **start_date/end_date**: ISO date strings for the appointment period
- **created_by_uid/created_by_email**: Tracks who created the event

## API Functions

### Core Operations

1. **loadSTTEvents()**: Loads all events from Firestore
2. **saveSTTEvent()**: Creates a new event in Firestore
3. **updateSTTEvent()**: Updates an existing event
4. **deleteSTTEvent()**: Deletes an event from Firestore
5. **findEventByInfoAndSchedule()**: Finds events by information_id and schedule_id

### Utility Functions

1. **calendarEventToSTTEvent()**: Converts calendar event format to Firestore format
2. **sttEventToCalendarEvent()**: Converts Firestore format to calendar event format

## Usage Flow

1. **Loading Events**: On page mount, events are loaded from Firestore and converted to calendar format
2. **Adding Events**: When a user schedules an appointment, the event is saved to Firestore with user tracking
3. **Editing Events**: Existing events can be updated with new dates
4. **Deleting Events**: Events can be removed from both the calendar and Firestore

## Data Integrity

- Events are validated against the source schedule data
- Duplicate events are prevented using information_id and schedule_id
- User authentication is required for all write operations
- Timestamps are automatically managed by Firestore

## Error Handling

- Network errors are caught and displayed to users via toast notifications
- Validation errors prevent invalid data from being saved
- Loading states provide user feedback during operations

## Security

- All operations require user authentication
- Events are associated with the creating user
- Firestore security rules should be configured to restrict access to authenticated users 