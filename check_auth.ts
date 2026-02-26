import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('Logging in...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'alimkamcl@gmail.com',
    password: '123456'
  });

  if (error) {
    console.error('Login error:', error.message);
    return;
  }

  console.log('Logged in user ID:', data.user.id);

  console.log('Fetching profile for this ID...');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  console.log('Profile:', profile);
  if (profileError) console.log('Profile error:', profileError.message);

  console.log('Fetching all profiles...');
  const { data: allProfiles } = await supabase.from('profiles').select('*');
  console.log('All profiles:', allProfiles);
}

check();
