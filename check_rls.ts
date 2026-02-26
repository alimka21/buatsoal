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

async function checkRLS() {
  console.log('Logging in...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'alimkamcl@gmail.com',
    password: '123456'
  });

  if (authError) {
    console.error('Login error:', authError.message);
    return;
  }

  const uid = authData.user.id;
  console.log('Logged in user ID:', uid);

  // 1. Try to fetch the profile directly
  console.log('\n--- Test 1: Fetching profile directly ---');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .single();

  console.log('Profile result:', profile);
  if (profileError) console.log('Profile error:', profileError.message);

  // 2. Check if we can see ANY profiles
  console.log('\n--- Test 2: Fetching all profiles ---');
  const { data: allProfiles, error: allProfilesError } = await supabase
    .from('profiles')
    .select('id, email, role');
    
  console.log(`Found ${allProfiles?.length || 0} profiles`);
  if (allProfilesError) console.log('All profiles error:', allProfilesError.message);
}

checkRLS();
