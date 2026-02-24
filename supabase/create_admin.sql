-- =================================================================
-- SCRIPT: CREATE ADMIN USER
-- Email: alimkamcl@gmail.com
-- Password: 123456
-- =================================================================

-- 1. Enable pgcrypto for password hashing (required for manual insert)
create extension if not exists "pgcrypto";

-- 2. Insert or Update User
DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
  user_email text := 'alimkamcl@gmail.com';
  user_password text := '123456';
  encrypted_pw text;
BEGIN
  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = user_email) THEN
    -- Generate hashed password
    encrypted_pw := crypt(user_password, gen_salt('bf'));
    
    -- Insert into auth.users
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_user_id,
      'authenticated',
      'authenticated',
      user_email,
      encrypted_pw,
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Super Admin","role":"admin"}', -- Metadata triggers profile creation with role='admin'
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
    
    RAISE NOTICE 'User % created successfully with Admin role.', user_email;
  ELSE
    -- If user exists, force update their profile to admin
    RAISE NOTICE 'User % already exists. Updating role to Admin...', user_email;
    
    UPDATE public.profiles
    SET role = 'admin'
    WHERE id = (SELECT id FROM auth.users WHERE email = user_email);
    
    -- Optional: Update password if needed (uncomment to force reset)
    -- UPDATE auth.users 
    -- SET encrypted_password = crypt(user_password, gen_salt('bf')) 
    -- WHERE email = user_email;
  END IF;
END $$;
