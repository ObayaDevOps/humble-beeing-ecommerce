// src/server/utils/logger.js
// Minimal structured logger with requestId support.

const ts = () => new Date().toISOString();

export const createLogger = (context = {}) => {
  const base = { ...context };
  const fmt = (level, msg, extra) => ({
    level,
    time: ts(),
    msg,
    ...base,
    ...(extra || {}),
  });
  return {
    debug: (msg, extra) => console.debug(fmt('debug', msg, extra)),
    info: (msg, extra) => console.info(fmt('info', msg, extra)),
    warn: (msg, extra) => console.warn(fmt('warn', msg, extra)),
    error: (msg, extra) => console.error(fmt('error', msg, extra)),
  };
};

