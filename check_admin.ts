
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

async function checkAdmins() {
  console.log('Checking profiles...');
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('email, full_name, role');

  if (error) {
    console.error('Error fetching profiles:', error);
    return;
  }

  console.log('All Users:');
  profiles.forEach(p => {
    console.log(`- ${p.email} (${p.full_name}): [${p.role}]`);
  });

  const admins = profiles.filter(p => p.role === 'admin');
  console.log('\nAdmins:', admins.length);
  admins.forEach(a => {
    console.log(`- ${a.email}`);
  });
}

checkAdmins();
