import { useRef, useState } from 'react';
import { Search } from 'lucide-react';

export default function AddressAutocomplete({ value, onChange }) {
  const searchTimerRef = useRef(null);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  function formatPlace(feature) {
    const place = feature.properties;
    const text = (value) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
    const street = [place.housenumber, place.street].map(text).filter(Boolean).join(' ');
    return [place.name, street, place.city || place.town || place.village, place.state, place.country].map(text).filter(Boolean).join(', ');
  }

  async function searchPlaces(queryValue = value) {
    const query = queryValue.trim();
    if (query.length < 5) {
      setSearchError('Enter at least five characters to search.');
      return;
    }

    setSearching(true);
    setSearchError('');
    setResults([]);
    try {
      const response = await fetch(`https://photon.komoot.io/api/?limit=5&lang=en&q=${encodeURIComponent(query)}`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('Address search is unavailable.');
      const payload = await response.json();
      const places = payload.features.map((feature, index) => ({ id: `${feature.properties.osm_type || 'place'}-${feature.properties.osm_id || index}-${formatPlace(feature)}`, address: formatPlace(feature) })).filter((place) => place.address);
      setResults(places);
      if (places.length === 0) setSearchError('No matching places found. Try a fuller company name or address.');
    } catch (error) {
      setSearchError(error.message);
    } finally {
      setSearching(false);
    }
  }

  function selectPlace(place) {
    onChange(place.address);
    setResults([]);
    setSearchError('');
  }

  function handleAddressChange(nextValue) {
    onChange(nextValue);
    setResults([]);
    setSearchError('');
    if (nextValue.trim().length < 5) return;
    window.clearTimeout(searchTimerRef.current);
    searchTimerRef.current = window.setTimeout(() => searchPlaces(nextValue), 550);
  }

  return <div className="address-search"><div className="address-search-input"><input value={value} onChange={(event) => handleAddressChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); searchPlaces(); } }} placeholder="Company or address" autoComplete="street-address" /><button type="button" className="address-search-button" onClick={searchPlaces} disabled={searching} aria-label="Search address" title="Search address"><Search size={17} /></button></div>{searching && <span className="address-search-status">Searching places...</span>}{searchError && <span className="address-lookup-error">{searchError}</span>}{results.length > 0 && <div className="address-search-results">{results.map((place) => <button type="button" key={place.id} onClick={() => selectPlace(place)}>{place.address}</button>)}</div>}</div>;
}