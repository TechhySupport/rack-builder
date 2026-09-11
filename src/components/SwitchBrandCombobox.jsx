import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, LoaderCircle, Plus, Search, X } from 'lucide-react';
import { saveUserDeviceBrand, searchDeviceCatalogBrands, searchSavedDeviceBrands, searchSwitchBrands, submitSwitchBrand } from '../lib/switchBrands.js';

function ManufacturerSubmissionDialog({ initialName, userId, onClose, onUseCustom, onSelectExisting }) {
  const [manufacturerName, setManufacturerName] = useState(initialName);
  const [website, setWebsite] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function submit(event) {
    event.preventDefault();
    event.stopPropagation();
    setSubmitting(true);
    setError('');
    try {
      const response = await submitSwitchBrand({ manufacturerName, website, notes, userId });
      if (response.existing) {
        setResult({ type: 'existing', brand: response.existing });
      } else {
        const customName = response.customName;
        onUseCustom(customName);
        setResult({ type: 'submitted', customName });
      }
    } catch (submissionError) {
      setError(submissionError.message || 'Unable to submit this manufacturer.');
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div className="manufacturer-dialog-backdrop" role="presentation" onPointerDown={onClose}>
      <form className="manufacturer-dialog" aria-label="Submit new manufacturer" onPointerDown={(event) => event.stopPropagation()} onSubmit={submit}>
        <header><div><p>Manufacturer database</p><h3>Submit New Manufacturer</h3></div><button type="button" aria-label="Close manufacturer submission" onClick={onClose}><X size={17} /></button></header>
        {result?.type === 'submitted' ? <div className="manufacturer-dialog-result"><Check size={22} /><strong>Thanks! Your manufacturer has been submitted for review.</strong><p>You can continue using {result.customName} as a custom manufacturer now.</p><button type="button" onClick={onClose}>Continue</button></div> : <>
          <div className="manufacturer-dialog-fields">
            <label>Manufacturer name<input value={manufacturerName} maxLength={120} required autoFocus onChange={(event) => setManufacturerName(event.target.value)} /></label>
            <label>Website <span>(optional)</span><input type="url" placeholder="https://example.com" value={website} maxLength={500} onChange={(event) => setWebsite(event.target.value)} /></label>
            <label>Additional information <span>(optional)</span><textarea value={notes} maxLength={2000} onChange={(event) => setNotes(event.target.value)} /></label>
          </div>
          {result?.type === 'existing' && <div className="manufacturer-existing" role="status"><span>{result.brand.name} is already available.</span><button type="button" onClick={() => { onSelectExisting(result.brand); onClose(); }}>Use {result.brand.name}</button></div>}
          {error && <p className="manufacturer-dialog-error" role="alert">{error}</p>}
          <footer><button type="button" onClick={onClose}>Cancel</button><button type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit for Review'}</button></footer>
        </>}
      </form>
    </div>,
    document.body,
  );
}

export default function SwitchBrandCombobox({ deviceType = 'switch', brandId, savedBrandId, brandName, customManufacturer, userId, onChange }) {
  const rootRef = useRef(null);
  const listboxId = useId();
  const selectedName = customManufacturer || brandName || '';
  const [query, setQuery] = useState(selectedName);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [savedResults, setSavedResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [submissionOpen, setSubmissionOpen] = useState(false);

  useEffect(() => {
    if (!open) setQuery(selectedName);
  }, [brandId, selectedName, open]);

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    setResults([]);
    const timeout = window.setTimeout(async () => {
      try {
        const isSwitch = deviceType === 'switch';
        const [brands, savedBrands] = await Promise.all([
          isSwitch ? searchSwitchBrands(query, 12) : searchDeviceCatalogBrands(deviceType, query, 12),
          !isSwitch && userId ? searchSavedDeviceBrands(deviceType, query, 12) : [],
        ]);
        if (active) {
          setResults(brands);
          setSavedResults(savedBrands.filter((saved) => !brands.some((brand) => brand.id === saved.catalog_brand_id)));
          setActiveIndex(-1);
        }
      } catch {
        if (active) {
          setResults([]);
          setSavedResults([]);
          setError('Unable to load manufacturers. Try again.');
          setActiveIndex(-1);
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [deviceType, open, query, userId]);

  async function selectBrand(brand) {
    const accepted = await onChange(deviceType === 'switch'
      ? { switchBrandId: brand.id, brand: brand.name, customManufacturer: '' }
      : { catalogBrandId: brand.id, savedBrandId: null, brand: brand.name, customManufacturer: '' });
    if (accepted === false) return;
    setQuery(brand.name);
    setOpen(false);
  }

  async function selectCustomManufacturer(name = query) {
    const customName = String(name || '').trim();
    if (!customName) return;
    let saved = null;
    if (deviceType !== 'switch' && userId) {
      try {
        saved = await saveUserDeviceBrand({ deviceType, manufacturerName: customName, userId });
      } catch (saveError) {
        setError(saveError.message || 'Unable to save this manufacturer.');
        setOpen(true);
        return;
      }
    }
    const accepted = await onChange(deviceType === 'switch'
      ? { switchBrandId: null, brand: customName, customManufacturer: customName }
      : { catalogBrandId: null, savedBrandId: saved?.id || null, brand: customName, customManufacturer: customName });
    if (accepted === false) return;
    setQuery(customName);
    setOpen(false);
  }

  async function clearSelection(event) {
    event?.stopPropagation();
    const accepted = await onChange({ switchBrandId: null, catalogBrandId: null, savedBrandId: null, brand: '', customManufacturer: '' });
    if (accepted === false) return;
    setQuery('');
    setOpen(true);
  }

  function handleInput(event) {
    setQuery(event.target.value);
    setOpen(true);
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(results.length - 1, index + 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
      return;
    }
    if (event.key === 'Enter' && open && activeIndex >= 0 && results[activeIndex]) {
      event.preventDefault();
      selectBrand(results[activeIndex]);
    }
  }

  const canUseCustom = query.trim().length >= 2;

  return (
    <>
      <div className="switch-brand-combobox" ref={rootRef}>
        <div className={`switch-brand-control${open ? ' is-open' : ''}${brandId || customManufacturer ? ' has-selection' : ''}`}>
          <Search size={15} />
          <input
            value={query}
            placeholder={`Search ${deviceType === 'switch' ? 'switch' : deviceType} manufacturer...`}
            role="combobox"
            aria-label="Brand / manufacturer"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={open}
            aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
            onFocus={() => setOpen(true)}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
          />
          {(brandId || customManufacturer || query) && <button type="button" className="switch-brand-clear" title="Clear manufacturer" aria-label="Clear manufacturer" onClick={clearSelection}><X size={14} /></button>}
          <button type="button" className="switch-brand-toggle" title="Show manufacturers" aria-label="Show manufacturers" onClick={() => setOpen((value) => !value)}><ChevronDown size={15} /></button>
        </div>
        {customManufacturer && <span className="switch-brand-custom-state">{userId && deviceType !== 'switch' ? 'Saved manufacturer' : 'Custom manufacturer'}</span>}
        {open && <div className="switch-brand-menu" id={listboxId} role="listbox" aria-label="Manufacturer search results">
          {loading && <div className="switch-brand-status"><LoaderCircle className="spin" size={16} />Loading manufacturers...</div>}
          {!loading && error && <div className="switch-brand-status is-error">{error}</div>}
          {!loading && !error && results.map((brand, index) => <button id={`${listboxId}-${index}`} type="button" role="option" aria-selected={brand.id === brandId} className={index === activeIndex ? 'is-active' : ''} key={brand.id} onMouseEnter={() => setActiveIndex(index)} onClick={() => selectBrand(brand)}><span>{brand.name}</span>{brand.id === brandId && <Check size={15} />}</button>)}
          {!loading && !error && savedResults.map((brand) => <button type="button" role="option" aria-selected={brand.id === savedBrandId} key={`saved-${brand.id}`} onClick={() => selectCustomManufacturer(brand.name)}><span>{brand.name}<small>{brand.review_status === 'pending' ? 'Saved by you · Pending catalog review' : 'Saved by you'}</small></span>{brand.id === savedBrandId && <Check size={15} />}</button>)}
          {!loading && !error && !results.length && !savedResults.length && <div className="switch-brand-empty"><strong>No manufacturers found.</strong><span>Can't find your manufacturer?</span></div>}
          {!loading && <div className="switch-brand-menu-actions">
            {canUseCustom && <button type="button" onClick={() => selectCustomManufacturer()}><Plus size={14} />{userId && deviceType !== 'switch' ? `Save “${query.trim()}” to my manufacturers` : `Use “${query.trim()}” as custom`}</button>}
            {deviceType === 'switch' && <button type="button" onClick={() => { setOpen(false); setSubmissionOpen(true); }}><Plus size={14} />Submit a new manufacturer</button>}
          </div>}
        </div>}
      </div>
      {deviceType === 'switch' && submissionOpen && <ManufacturerSubmissionDialog initialName={query.trim()} userId={userId} onClose={() => setSubmissionOpen(false)} onUseCustom={selectCustomManufacturer} onSelectExisting={selectBrand} />}
    </>
  );
}
