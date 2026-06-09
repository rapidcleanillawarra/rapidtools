import type { Schedule, Contact, LocationInfo, Note } from '../stores';

export type { Schedule, Contact, LocationInfo, Note };

/** Lightweight row for the companies table (no note bodies or contact phones). */
export type CompanyListSearchContact = {
	name: string;
	email: string;
};

export type CompanyListSearchInfo = {
	sub_company_name: string;
	location: string;
	contacts: CompanyListSearchContact[];
};

export type CompanyListItem = {
	id: string;
	company: string;
	start_month: number;
	occurence: number;
	color: string;
	locationCount: number;
	contactCount: number;
	noteCount: number;
	information: CompanyListSearchInfo[];
	createdAt?: string;
	updatedAt?: string;
};

export type ScheduleFormData = Omit<Schedule, 'id'> & {
  id?: string;
};

export type ContactFormData = Contact;

export type LocationFormData = Omit<LocationInfo, 'information_id'> & {
  information_id?: string;
};

export type NoteFormData = Note;

export type ValidationErrors = {
  company?: string;
  start_month?: string;
  occurence?: string;
  color?: string;
  information?: {
    [key: string]: {
      sub_company_name?: string;
      location?: string;
      contacts?: {
        [key: string]: {
          name?: string;
          phone?: string;
          email?: string;
        };
      };
    };
  };
  information_required?: string; // For overall information validation
  notes?: {
    [key: string]: {
      title?: string;
      content?: string;
    };
  };
};

export type FormMode = 'create' | 'edit' | 'view'; 