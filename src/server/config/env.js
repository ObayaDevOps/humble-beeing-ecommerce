// src/server/config/env.js
// Centralized, minimal runtime validation for required server env variables.

const required = (key) => {
  const val = process.env[key];
  if (!val || String(val).trim() === '') {
    throw new Error(`[ENV] Missing required environment variable: ${key}`);
  }
  return val;
};

// Payment provider (Pesapal)
export const PESAPAL_API_BASE_URL = required('PESAPAL_API_BASE_URL');
export const PESAPAL_CONSUMER_KEY = required('PESAPAL_CONSUMER_KEY');
export const PESAPAL_CONSUMER_SECRET = required('PESAPAL_CONSUMER_SECRET');

// Supabase (server)
export const SUPABASE_URL = required('NEXT_PUBLIC_SUPABASE_URL');
export const SUPABASE_SERVICE_ROLE_KEY = required('SUPABASE_SERVICE_ROLE_KEY');

// Application
export const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL || '';
export const PESAPAL_IPN_IDS = process.env.PESAPAL_IPN_IDS || '';

// Optional integrations (do not throw here; routes can validate when needed)
export const SMTP_USER = process.env.SMTP_USER || '';
export const SMTP_PASSWORD = process.env.SMTP_PASSWORD || '';
export const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || '';
export const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
export const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';

export const getEnv = () => ({
  PESAPAL_API_BASE_URL,
  PESAPAL_CONSUMER_KEY,
  PESAPAL_CONSUMER_SECRET,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  APP_BASE_URL,
  PESAPAL_IPN_IDS,
  SMTP_USER,
  SMTP_PASSWORD,
  WHATSAPP_API_VERSION,
  WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_ACCESS_TOKEN,
});

