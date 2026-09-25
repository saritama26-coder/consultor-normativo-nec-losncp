export const logger = {
  info: (message: string, ...args: any[]) => {
    console.log(`[INFO ${new Date().toISOString()}] ${message}`, ...sanitize(args));
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN ${new Date().toISOString()}] ${message}`, ...sanitize(args));
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR ${new Date().toISOString()}] ${message}`, ...sanitize(args));
  },
};

function sanitize(args: any[]): any[] {
  return args.map((arg) => {
    if (typeof arg === 'string') {
      return arg.replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]')
                .replace(/Bearer\s+[A-Za-z0-9-_.]+/gi, 'Bearer [REDACTED_TOKEN]');
    }
    if (typeof arg === 'object' && arg !== null) {
      try {
        const str = JSON.stringify(arg);
        return JSON.parse(
          str.replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]')
             .replace(/Bearer\s+[A-Za-z0-9-_.]+/gi, 'Bearer [REDACTED_TOKEN]')
        );
      } catch {
        return '[Unserializable]';
      }
    }
    return arg;
  });
}
