
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
  const email = 'alimkamcl@gmail.com';
  console.log(`Checking profile for email: ${email}`);
  
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email);

  if (error) {
    console.error('Error fetching profile:', error);
    return;
  }

  if (profiles && profiles.length > 0) {
    console.log('Profile found:', profiles[0]);
  } else {
    console.log('No profile found for this email in public.profiles table.');
    console.log('This explains why role is undefined.');
  }
}

checkUser();
