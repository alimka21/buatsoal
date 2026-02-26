-- Run this in Supabase SQL Editor to create the settings table
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read settings
CREATE POLICY "Public settings are viewable by everyone." ON public.app_settings
  FOR SELECT USING (true);

-- Allow admins to update settings
CREATE POLICY "Admins can insert settings" ON public.app_settings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update settings" ON public.app_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Insert default subscription link
INSERT INTO public.app_settings (key, value) 
VALUES ('subscription_link', 'https://s.id/alimkadigital')
ON CONFLICT (key) DO NOTHING;
