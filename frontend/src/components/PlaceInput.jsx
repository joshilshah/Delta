import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, MapPin } from 'lucide-react';
import { DEMO_PLACES, mapsConfigured, newSessionToken, resolvePlace, suggestPlaces } from '../lib/maps.js';

/**
 * Location input. `value` is only ever a *validated* place ({address, latitude, longitude}),
 * set after the user picks a suggestion; typing again clears it so a half-typed string can't be booked.
 */
export default function PlaceInput({ label, value, onChange, placeholder, icon: Icon = MapPin }) {
  const [text, setText] = useState(value?.address ?? '');
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const token = useRef(null);
  const seq = useRef(0);
  const box = useRef(null);

  useEffect(() => {
    const close = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    if (value === null) setText(''); // eslint-disable-line react-hooks/set-state-in-effect -- reset when parent clears
  }, [value]);

  async function search(q) {
    setText(q);
    onChange(null);
    setProblem(null);
    if (q.trim().length < 2) { setOptions([]); return; }
    if (!mapsConfigured) {
      setOptions(DEMO_PLACES.filter((p) => p.text.toLowerCase().includes(q.toLowerCase())));
      setOpen(true);
      return;
    }
    const mine = ++seq.current;
    setBusy(true);
    try {
      token.current ??= await newSessionToken();
      const found = await suggestPlaces(q, token.current);
      if (mine === seq.current) { setOptions(found); setOpen(true); }
    } catch {
      if (mine === seq.current) setProblem('Location search is unavailable right now.');
    } finally {
      if (mine === seq.current) setBusy(false);
    }
  }

  async function choose(option) {
    setOpen(false);
    setProblem(null);
    if (!mapsConfigured) {
      setText(option.address);
      onChange({ address: option.address, latitude: option.latitude, longitude: option.longitude });
      return;
    }
    setBusy(true);
    try {
      const place = await resolvePlace(option.prediction);
      token.current = null; // a session ends when a place is selected
      setText(place.address);
      onChange(place);
    } catch {
      setProblem('Could not read that place. Please pick another.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={box} className="relative">
      <label className="label" htmlFor={`place-${label}`}>{label}</label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          id={`place-${label}`} className="input pl-11 pr-10" value={text} placeholder={placeholder}
          autoComplete="off" onChange={(e) => search(e.target.value)} onFocus={() => options.length && setOpen(true)}
          aria-invalid={Boolean(problem)}
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted" aria-hidden />
            : value ? <Check className="h-4 w-4 text-success" aria-label="Location confirmed" /> : null}
        </span>
      </div>
      {problem && <p className="mt-1.5 text-xs text-danger">{problem}</p>}
      {!problem && text.length > 1 && !value && !busy && !open && (
        <p className="mt-1.5 text-xs text-muted">Select a suggestion to confirm this location.</p>
      )}
      {open && options.length > 0 && (
        <ul className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-line bg-white py-1 shadow-lg" role="listbox">
          {options.map((o) => (
            <li key={o.id}>
              <button type="button" role="option" className="flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm hover:bg-canvas" onClick={() => choose(o)}>
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden /> <span>{o.text}</span>
              </button>
            </li>
          ))}
          {!mapsConfigured && <li className="border-t border-line px-4 py-2 text-xs text-amber-700">Demo locations (Google Maps key not configured)</li>}
        </ul>
      )}
    </div>
  );
}
