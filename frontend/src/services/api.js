import { supabase } from '../lib/supabase.js';

const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(method, path, body) {
  const { data } = (await supabase?.auth.getSession()) ?? {};
  const token = data?.session?.access_token;
  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your connection and try again.');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = json.error ?? {};
    throw new ApiError(res.status, e.code ?? 'ERROR', e.message ?? 'Something went wrong.', e.details);
  }
  return json;
}

export const api = {
  me: () => request('GET', '/me'),
  estimateFare: (pickup, destination) => request('POST', '/fares/estimate', { pickup, destination }),
  createRide: (pickup, destination, idempotencyKey) =>
    request('POST', '/rides', { pickup, destination, idempotencyKey }),
  getRide: (id) => request('GET', `/rides/${id}`),
  activeRide: () => request('GET', '/rides/active'),
  cancelRide: (id) => request('POST', `/rides/${id}/cancel`),
  startRide: (id) => request('POST', `/rides/${id}/start`),
  completeRide: (id) => request('POST', `/rides/${id}/complete`),
  setAvailability: (is_online) => request('PATCH', '/drivers/availability', { is_online }),
  updateLocation: (latitude, longitude) => request('POST', '/drivers/location', { latitude, longitude }),
  offers: () => request('GET', '/drivers/offers'),
  acceptOffer: (id) => request('POST', `/offers/${id}/accept`),
  rejectOffer: (id) => request('POST', `/offers/${id}/reject`),
};
