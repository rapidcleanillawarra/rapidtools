import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

export type Contact = {
    name: string;
    phone: string;
    email: string;
};

export type LocationInfo = {
    information_id: string;
    sub_company_name: string;
    location: string;
    contacts: Contact[];
};

export type Note = {
    title: string;
    content: string;
};

export type Schedule = {
    id: string;
    company: string;
    start_month: number;
    occurence: number;
    color: string;
    information: LocationInfo[];
    notes: Note[];
    createdAt?: any; // Firestore timestamp
    updatedAt?: any; // Firestore timestamp
};

// Initial data
const initialSchedules: Schedule[] = [];

export const schedulesStore: Writable<Schedule[]> = writable(initialSchedules); 