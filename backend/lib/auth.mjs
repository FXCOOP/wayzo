import { supabasePublic } from './supabase.mjs';

/**
 * Express middleware to require authenticated user
 * Validates JWT token from Authorization header
 * Attaches user info to req.user
 */
export async function requireUser(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

    if (!token) {
      console.log('❌ Auth: No bearer token provided');
      return res.status(401).json({ error: 'Missing bearer token' });
    }

    // Validate token with Supabase
    const { data, error } = await supabasePublic.auth.getUser(token);

    if (error || !data?.user) {
      console.log('❌ Auth: Invalid token', error?.message);
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Attach user to request
    req.user = {
      id: data.user.id,
      email: data.user.email
    };

    console.log('✅ Auth: User authenticated', req.user.email);
    next();
  } catch (e) {
    console.error('❌ Auth middleware error:', e);
    res.status(401).json({ error: 'Unauthorized' });
  }
}

/**
 * Optional authentication middleware for staging/development
 * Allows requests without auth in non-production environments
 * Still validates and attaches user if token is provided
 */
export async function optionalUser(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

    // If no token provided in staging, allow the request to continue
    if (!token) {
      console.log('⚠️ Auth: No token provided (staging mode - allowing)');
      req.user = null;
      return next();
    }

    // If token provided, validate it
    const { data, error } = await supabasePublic.auth.getUser(token);

    if (error || !data?.user) {
      console.log('⚠️ Auth: Invalid token provided (staging mode - allowing anyway)');
      req.user = null;
      return next();
    }

    // Attach user to request if valid token
    req.user = {
      id: data.user.id,
      email: data.user.email
    };

    console.log('✅ Auth: User authenticated', req.user.email);
    next();
  } catch (e) {
    console.error('⚠️ Auth middleware error (staging mode - allowing):', e);
    req.user = null;
    next();
  }
}
