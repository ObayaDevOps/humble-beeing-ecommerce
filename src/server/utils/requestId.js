// src/server/utils/requestId.js

const genId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export const ensureRequestId = (req, res) => {
  const fromHeader = req.headers['x-request-id'];
  const id = (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader) || genId();
  try {
    res.setHeader('x-request-id', id);
  } catch {}
  // stash for downstream usage
  req.__requestId = id;
  return id;
};

