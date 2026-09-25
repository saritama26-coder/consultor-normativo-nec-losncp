import crypto from 'crypto';
import { UserSession } from '../types';
import { logger } from '../utils/logger';

const sessions = new Map<string, UserSession>();

// Secret key for cryptographic signing/tokens
const SESSION_SECRET = process.env.SESSION_SECRET?.trim() || crypto.randomBytes(32).toString('hex');

// Las sesiones viven en memoria (Map): cualquier reinicio del servidor las cierra, exista o no SESSION_SECRET.
if (!process.env.SESSION_SECRET) {
  logger.warn('SESSION_SECRET no configurado: se generó uno aleatorio para este arranque. Las sesiones de administrador se cierran en cada reinicio.');
}

export const authService = {
  /**
   * Indica si la variable ADMIN_PASSWORD ha sido configurada en el entorno (Secrets).
   */
  isAdminPasswordConfigured(): boolean {
    const pwd = process.env.ADMIN_PASSWORD;
    return typeof pwd === 'string' && pwd.trim().length > 0;
  },

  /**
   * Inicia sesión como administrador usando exclusivamente ADMIN_PASSWORD.
   * Sin contraseñas por defecto ni claves hardcodeadas.
   */
  loginAdmin(passwordAttempt: string, name = 'Administrador Técnico'): { session: UserSession | null; error?: string } {
    const configuredPassword = process.env.ADMIN_PASSWORD;

    if (!configuredPassword || !configuredPassword.trim()) {
      logger.warn('Intento de login administrativo denegado: ADMIN_PASSWORD no está configurado en los Secrets del servidor.');
      return {
        session: null,
        error: 'ADMIN_PASSWORD no está configurado en los Secrets del servidor. Configúralo en el panel Secrets de AI Studio para habilitar la administración.',
      };
    }

    if (!passwordAttempt || typeof passwordAttempt !== 'string') {
      return { session: null, error: 'Debe ingresar la contraseña de administración.' };
    }

    // Timing-safe comparison to prevent timing attacks
    const attemptHash = crypto.createHash('sha256').update(passwordAttempt.trim()).digest();
    const targetHash = crypto.createHash('sha256').update(configuredPassword.trim()).digest();

    const isMatch = crypto.timingSafeEqual(attemptHash, targetHash);
    if (!isMatch) {
      logger.warn('Intento de login de administrador con contraseña incorrecta.');
      return { session: null, error: 'Contraseña de administrador incorrecta.' };
    }

    // Limpieza de sesiones expiradas para evitar crecimiento indefinido del Map.
    const now = Date.now();
    for (const [storedToken, storedSession] of sessions) {
      if (new Date(storedSession.expiresAt).getTime() <= now) {
        sessions.delete(storedToken);
      }
    }

    // Generate cryptographically random secure token
    const token = crypto.randomBytes(32).toString('hex');
    const signature = crypto.createHmac('sha256', SESSION_SECRET).update(token).digest('hex');
    const fullToken = `${token}.${signature}`;

    const session: UserSession = {
      id: 'admin_' + Date.now(),
      name,
      role: 'administrador',
      token: fullToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    };

    sessions.set(fullToken, session);
    logger.info(`Sesión de administrador iniciada exitosamente para: ${name}`);
    return { session };
  },

  /**
   * Valida un token de sesión de administrador.
   */
  validateToken(authHeader?: string): UserSession | null {
    if (!authHeader) return null;
    const parts = authHeader.split(' ');
    const token = parts.length === 2 && parts[0].toLowerCase() === 'bearer' ? parts[1] : parts[0];
    if (!token) return null;

    const session = sessions.get(token);
    if (!session) return null;

    // Check expiration
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      sessions.delete(token);
      return null;
    }

    return session;
  },

  /**
   * Cierra la sesión activa.
   */
  logout(token: string): boolean {
    return sessions.delete(token);
  },
};
