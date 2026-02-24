export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'user';
  password_text: string | null; // Mirror field as requested
  must_change_password: boolean;
  created_at: string;
}

export interface GeneratedQuestion {
  id: string;
  user_id: string;
  input_hash: string;
  input_payload: any;
  result_json: any;
  model_used: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  details: any;
  created_at: string;
}

export interface QuestionFormSchema {
  topic: string;
  level: string;
  count: number;
  type: 'multiple_choice' | 'essay';
  additional_instructions?: string;
}
