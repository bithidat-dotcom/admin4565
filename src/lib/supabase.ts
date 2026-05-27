import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/['"]/g, '').trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.replace(/['"]/g, '').trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials missing. Please check your environment variables in the Settings menu.');
} else {
  // Safe logging of basic info to help debug
  console.log('Supabase initialized with URL:', supabaseUrl);
  console.log('Supabase Key detected (length):', supabaseAnonKey.length);
  if (supabaseAnonKey.startsWith('ey')) {
    console.log('Key format looks valid (starts with ey...)');
  } else {
    console.warn('Warning: Key does not start with "ey", check if it is the correct Anon Key.');
  }
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
