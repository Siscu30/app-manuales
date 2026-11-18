import { createClient } from '@supabase/supabase-js';

// Mismo proyecto y clave pública (anon) que la app actual. Al servirse en el mismo dominio,
// comparte la sesión guardada por la app actual. La seguridad real la ponen las políticas RLS.
export const SUPABASE_URL = 'https://tbeqkabdkqffdcufvfof.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiZXFrYWJka3FmZmRjdWZ2Zm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NzA3NjYsImV4cCI6MjA5NzM0Njc2Nn0.bPywboiecnWj7XHhWoM1ACG26mId4Naa5CYFSPAwzYg';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
});
