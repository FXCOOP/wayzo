import { createClient } from '@supabase/supabase-js';

// Check if required environment variables are set
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

let supabaseAdmin = null;
let supabasePublic = null;

if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  // Supabase Admin Client (bypasses RLS, has full access)
  supabaseAdmin = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
  console.log('✅ Supabase admin client initialized');
} else {
  console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY not set - admin features disabled');
}

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  // Supabase Public Client (respects RLS, for validating user tokens)
  supabasePublic = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );
  console.log('✅ Supabase public client initialized');
} else {
  console.warn('⚠️ SUPABASE_ANON_KEY not set - authentication disabled');
}

export { supabaseAdmin, supabasePublic };
