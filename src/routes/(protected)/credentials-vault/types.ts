export interface Credential {
  id: string;
  website: string;
  username: string | null;
  email: string | null;
  password: string | null;
  mfa_phone: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CredentialFormData {
  website: string;
  username: string;
  email: string;
  password: string;
  mfa_phone: string;
  description: string;
}

export const emptyCredentialForm: CredentialFormData = {
  website: '',
  username: '',
  email: '',
  password: '',
  mfa_phone: '',
  description: ''
};

