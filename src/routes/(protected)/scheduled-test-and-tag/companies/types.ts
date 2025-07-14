import type { Schedule, Contact, LocationInfo, Note } from '../stores';

export type { Schedule, Contact, LocationInfo, Note };

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