
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

async function fixProfile() {
  const email = 'alimkamcl@gmail.com';
  const password = 'YOUR_PASSWORD_HERE'; // User provided 123456

  console.log(`Logging in as ${email}...`);
  const { data: { user }, error: loginError } = await supabase.auth.signInWithPassword({
    email,
    password: 'YOUR_PASSWORD_HERE'
  });

  if (loginError || !user) {
    console.error('Login failed:', loginError);
    return;
  }

  console.log(`Logged in! User ID: ${user.id}`);

  // Check profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profile) {
    console.log('Profile exists:', profile);
    if (profile.role !== 'admin') {
      console.log('Updating role to admin...');
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', user.id);
      
      if (updateError) console.error('Update failed:', updateError);
      else console.log('Role updated to admin!');
    } else {
      console.log('User is already admin.');
    }
  } else {
    console.log('Profile missing! Creating profile...');
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        full_name: 'Admin User',
        role: 'admin',
        password_text: 'YOUR_PASSWORD_HERE'
      });

    if (insertError) console.error('Insert failed:', insertError);
    else console.log('Profile created with admin role!');
  }
}

fixProfile();
