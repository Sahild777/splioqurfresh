import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nsimaellgaargjljpimc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zaW1hZWxsZ2FhcmdqbGpwaW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI0MDIwMTcsImV4cCI6MjA1Nzk3ODAxN30.e_U--aTpfaNXEjBJ2Nifr0n0Dypvy9qNcWzRzJJiKVs';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Prefer': 'return=minimal'
    }
  },
  db: {
    schema: 'public'
  }
}); 