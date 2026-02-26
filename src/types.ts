export interface Profile {
  id: string;
  full_name: string;
  role: 'admin' | 'user';
  email?: string;
  password_text: string;
  must_change_password: boolean;
  api_key?: string;
  created_at: string;
}

export interface GeneratedQuestion {
  id: string;
  input_hash: string;
  input_payload_json: any;
  reference_text?: string;
  result_json: any;
  model_used: string;
  created_by: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  input_hash: string;
  model_used: string;
  retry_count: number;
  cache_hit: boolean;
  status: 'success' | 'failed';
  created_at: string;
}
