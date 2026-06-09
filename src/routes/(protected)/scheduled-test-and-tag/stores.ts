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

/** Company profile for scheduled test and tag */
export type Company = {
    id: string;
    company: string;
    start_month: number;
    occurence: number;
    color: string;
    information: LocationInfo[];
    notes: Note[];
    createdAt?: string;
    updatedAt?: string;
    deletedAt?: string;
    isDeleted?: boolean; // Soft delete flag
};

/** @deprecated Use Company */
export type Schedule = Company;

// Initial data
const initialCompanies: Company[] = [];

/** @deprecated Use companiesStore */
export const schedulesStore: Writable<Company[]> = writable(initialCompanies);

export const companiesStore = schedulesStore; 