import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api.js';

const REFRESH_MS = 30_000;

/**
 * Permission-based location sharing for drivers. One reading per call to share(); optional foreground
 * refresh every 30 s ONLY while this page is open and the driver is online. No background tracking.
 */
export function useDriverLocation({ online, onUpdated }) {
  const [status, setStatus] = useState('idle'); // idle | asking | ok | denied | unsupported | error
  const [message, setMessage] = useState(null);
  const [auto, setAuto] = useState(true);
  const busy = useRef(false);
  const onUpdatedRef = useRef(onUpdated);
  useEffect(() => { onUpdatedRef.current = onUpdated; });

  const share = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported');
      setMessage('This browser does not support location sharing.');
      return Promise.resolve();
    }
    if (busy.current) return Promise.resolve();
    busy.current = true;
    setStatus('asking');
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          try {
            await api.updateLocation(coords.latitude, coords.longitude);
            setStatus('ok');
            setMessage(null);
            onUpdatedRef.current?.();
          } catch (e) {
            setStatus('error');
            setMessage(e.message);
          }
          busy.current = false;
          resolve();
        },
        (err) => {
          setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error');
          setMessage(err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied. Allow location access in your browser settings, then try again. Without it you cannot receive ride requests.'
            : 'Could not read your location. Check that location services are on and try again.');
          busy.current = false;
          resolve();
        },
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5_000 },
      );
    });
  }, []);

  useEffect(() => {
    if (!online || !auto) return undefined;
    const first = setTimeout(share, 0);
    const timer = setInterval(share, REFRESH_MS);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [online, auto, share]);

  return { status, message, share, auto, setAuto };
}
