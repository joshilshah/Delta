// Google Maps JS API loader + Places (New) autocomplete helpers.
// The browser key must be restricted by HTTP referrer and to the Maps JavaScript + Places APIs only.

const KEY = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY;
export const mapsConfigured = Boolean(KEY);

let loader;
function loadMaps() {
  if (!KEY) return Promise.reject(new Error('Google Maps key is not configured'));
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      if (window.google?.maps?.importLibrary) return resolve();
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&loading=async&v=weekly`;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { loader = null; reject(new Error('Failed to load Google Maps')); };
      document.head.appendChild(s);
    });
  }
  return loader.then(() => window.google.maps.importLibrary('places'));
}

export async function newSessionToken() {
  const { AutocompleteSessionToken } = await loadMaps();
  return new AutocompleteSessionToken();
}

export async function suggestPlaces(input, sessionToken) {
  const { AutocompleteSuggestion } = await loadMaps();
  const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input, sessionToken, includedRegionCodes: ['in'],
  });
  return suggestions.filter((s) => s.placePrediction).map((s) => ({
    id: s.placePrediction.placeId,
    text: s.placePrediction.text.text,
    prediction: s.placePrediction,
  }));
}

/** Resolve a prediction to validated coordinates + a readable address. */
export async function resolvePlace(prediction) {
  const place = prediction.toPlace();
  await place.fetchFields({ fields: ['location', 'formattedAddress', 'displayName'] });
  if (!place.location) throw new Error('This place has no coordinates');
  return {
    address: [place.displayName, place.formattedAddress].filter(Boolean).join(', ') || prediction.text.text,
    latitude: place.location.lat(),
    longitude: place.location.lng(),
  };
}

// Offline/dev fallback so the flow is testable without a Google key. Clearly labelled in the UI.
export const DEMO_PLACES = [
  { id: 'd1', text: 'MG Road, Bengaluru', latitude: 12.9756, longitude: 77.6068 },
  { id: 'd2', text: 'Indiranagar, Bengaluru', latitude: 12.9784, longitude: 77.6408 },
  { id: 'd3', text: 'Koramangala, Bengaluru', latitude: 12.9352, longitude: 77.6245 },
  { id: 'd4', text: 'Cubbon Park, Bengaluru', latitude: 12.9763, longitude: 77.5929 },
  { id: 'd5', text: 'Bengaluru City Railway Station', latitude: 12.9784, longitude: 77.5700 },
  { id: 'd6', text: 'Whitefield, Bengaluru', latitude: 12.9698, longitude: 77.7500 },
].map((p) => ({ ...p, address: p.text }));
