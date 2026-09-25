import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { UserSession } from '../types';

export interface AuthenticatedRequest extends Request {
  user?: UserSession;
}

/**
 * Rate limiter básico en memoria para mitigar saturación y abusos.
 * Cada instancia lleva su propio registro por IP: el límite global, el de rutas de IA
 * y el de login se cuentan por separado (un registro compartido hacía que las cargas
 * normales de la app bloquearan el login y las consultas).
 */
export function rateLimiter(limit = 120, windowMs = 60000) {
  const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetTime) {
      rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (entry.count >= limit) {
      res.status(429).json({
        error: 'Límite de solicitudes alcanzado. Por favor espera un momento antes de enviar otra consulta.',
      });
      return;
    }

    entry.count++;
    next();
  };
}

/**
 * Middleware que identifica si la solicitud proviene de un Administrador con token válido.
 * Si no viene token, asigna automáticamente rol público de 'usuario' (acceso libre).
 */
export function authenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const session = authService.validateToken(authHeader);

  if (session) {
    req.user = session;
  } else {
    // Sesión de usuario público (acceso libre a consultas)
    req.user = {
      id: 'guest',
      name: 'Usuario Consultor',
      role: 'usuario',
      token: '',
      expiresAt: '',
    };
  }
  next();
}

/**
 * Requiere rol 'administrador' (autenticado con ADMIN_PASSWORD).
 * Bloquea cualquier intento de carga, edición o eliminación sin credenciales de admin.
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'administrador') {
    res.status(403).json({
      error: 'Acceso administrativo protegido. Se requiere iniciar sesión con la clave ADMIN_PASSWORD configurada en los Secrets del servidor.',
      requiresAdminAuth: true,
    });
    return;
  }
  next();
}
