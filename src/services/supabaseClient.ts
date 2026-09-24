import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL: string = 
  (import.meta.env.VITE_SUPABASE_URL as string) || 
  'https://rpwtzksyslincqowxclm.supabase.co';

const SUPABASE_PUBLISHABLE_KEY: string = 
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) || 
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 
  'sb_publishable_9-58KYagF5hk1y3gMa4q-g_ARh9SwLE';

export function isSupabaseConfigured(): boolean {
  return Boolean(
    SUPABASE_URL && 
    SUPABASE_PUBLISHABLE_KEY && 
    SUPABASE_URL.startsWith('http') &&
    SUPABASE_PUBLISHABLE_KEY.length > 10
  );
}

// Create a single Supabase client for client-side interactions
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    headers: {
      'x-application-name': 'SyntheticLab-Studio',
    },
  },
});
