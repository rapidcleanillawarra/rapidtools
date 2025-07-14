import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

export type Contact = {
    phone: string;
    email: string;
};

export type LocationInfo = {
    location: string;
    contact: Contact;
};

export type Note = {
    title: string;
    content: string;
};

export type Schedule = {
    id: number;
    company: string;
    start_month: number;
    occurence: number;
    email: string;
    information: LocationInfo[];
    notes: Note[];
};

// Initial data
const initialSchedules: Schedule[] = [
    {
        id: 1,
        company: 'BHP Distribution',
        start_month: 1,
        occurence: 3,
        email: "andrew.vickers@bluescopesteel.com",
        information: [
            {
                location: "location 1",
                contact: {
                    phone: "0412345678",
                    email: "andrew.vickers@bluescopesteel.com",
                }
            },
            {
                location: "location 2",
                contact: {
                    phone: "0412345678",
                    email: "andrew.vickers@bluescopesteel.com",
                }
            }
        ],
        notes: [
            {
                title: "note 1",
                content: "content 1"
            },
            {
                title: "note 2",
                content: "content 2"
            }
        ]
    }
];

export const schedulesStore: Writable<Schedule[]> = writable(initialSchedules); 