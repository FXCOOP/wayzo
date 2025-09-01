import { UserModel } from './user.mjs';

export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ 
      error: 'No token provided',
      code: 'AUTH_NO_TOKEN'
    });
  }

  const decoded = UserModel.verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ 
      error: 'Invalid or expired token',
      code: 'AUTH_INVALID_TOKEN'
    });
  }

  req.userId = decoded.userId;
  req.userType = decoded.type;
  next();
}

export function optionalAuthMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (token) {
    const decoded = UserModel.verifyToken(token);
    if (decoded) {
      req.userId = decoded.userId;
      req.userType = decoded.type;
    }
  }
  
  next();
}

export function adminMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ 
      error: 'Admin access required',
      code: 'ADMIN_NO_TOKEN'
    });
  }

  const decoded = UserModel.verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ 
      error: 'Invalid admin token',
      code: 'ADMIN_INVALID_TOKEN'
    });
  }

  // Check if user is admin (you can add admin field to users table later)
  // For now, we'll use a simple check
  if (decoded.userId !== 'admin') {
    return res.status(403).json({ 
      error: 'Admin access required',
      code: 'ADMIN_ACCESS_DENIED'
    });
  }

  req.userId = decoded.userId;
  req.userType = 'admin';
  next();
}

export function rateLimitMiddleware(maxRequests = 100, windowMs = 15 * 60 * 1000) {
  const requests = new Map();
  
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean old requests
    if (requests.has(key)) {
      requests.set(key, requests.get(key).filter(timestamp => timestamp > windowStart));
    }
    
    const userRequests = requests.get(key) || [];
    
    if (userRequests.length >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    userRequests.push(now);
    requests.set(key, userRequests);
    
    next();
  };
}

export function validateUserOwnership(resourceUserId) {
  return (req, res, next) => {
    if (!req.userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    if (req.userId !== resourceUserId && req.userType !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }
    
    next();
  };
}