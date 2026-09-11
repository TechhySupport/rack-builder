import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, LoaderCircle, Plus, Search, X } from 'lucide-react';
import { saveUserDeviceModel, searchDeviceCatalogModels, searchSavedDeviceModels, searchSwitchModels, submitSwitchModel } from '../lib/switchModels.js';

function ModelSubmissionDialog({ brandId, brandName, initialName, userId, onClose, onUseCustom, onSelectExisting }) {
  const [modelName, setModelName] = useState(initialName);
  const [productFamily, setProductFamily] = useState('');
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
      const response = await submitSwitchModel({ brandId, modelName, productFamily, notes, userId });
      if (response.existing) {
        setResult({ type: 'existing', model: response.existing });
      } else {
        onUseCustom(response.customName);
        setResult({ type: 'submitted', customName: response.customName });
      }
    } catch (submissionError) {
      setError(submissionError.message || 'Unable to submit this switch model.');
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div className="manufacturer-dialog-backdrop" role="presentation" onPointerDown={onClose}>
      <form className="manufacturer-dialog" aria-label="Submit new switch model" onPointerDown={(event) => event.stopPropagation()} onSubmit={submit}>
        <header><div><p>{brandName} model database</p><h3>Submit New Switch Model</h3></div><button type="button" aria-label="Close model submission" onClick={onClose}><X size={17} /></button></header>
        {result?.type === 'submitted' ? <div className="manufacturer-dialog-result"><Check size={22} /><strong>Thanks! Your switch model has been submitted for review.</strong><p>You can continue using {result.customName} as a custom model now.</p><button type="button" onClick={onClose}>Continue</button></div> : <>
          <div className="manufacturer-dialog-fields">
            <label>Manufacturer<input value={brandName} readOnly /></label>
            <label>Model name<input value={modelName} maxLength={160} required autoFocus onChange={(event) => setModelName(event.target.value)} /></label>
            <label>Product family <span>(optional)</span><input value={productFamily} maxLength={120} onChange={(event) => setProductFamily(event.target.value)} /></label>
            <label>Additional information <span>(optional)</span><textarea value={notes} maxLength={2000} onChange={(event) => setNotes(event.target.value)} /></label>
          </div>
          {result?.type === 'existing' && <div className="manufacturer-existing" role="status"><span>{result.model.name} is already available for {brandName}.</span><button type="button" onClick={() => { onSelectExisting(result.model); onClose(); }}>Use {result.model.name}</button></div>}
          {error && <p className="manufacturer-dialog-error" role="alert">{error}</p>}
          <footer><button type="button" onClick={onClose}>Cancel</button><button type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit for Review'}</button></footer>
        </>}
      </form>
    </div>,
    document.body,
  );
}

export default function SwitchModelCombobox({ deviceType = 'switch', brandId, catalogBrandId, savedBrandId, brandName, modelId, modelName, customModel, userId, onChange }) {
  const rootRef = useRef(null);
  const listboxId = useId();
  const selectedName = customModel || modelName || '';
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
  }, [modelId, selectedName, open]);

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    if (!brandId && (!userId || !brandName)) {
      setResults([]);
      setSavedResults([]);
      setLoading(false);
      setError('');
      setActiveIndex(-1);
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError('');
    setResults([]);
    const timeout = window.setTimeout(async () => {
      try {
        const isSwitch = deviceType === 'switch';
        const [models, savedModels] = await Promise.all([
          isSwitch
            ? (brandId ? searchSwitchModels(brandId, query, 12) : [])
            : searchDeviceCatalogModels({ deviceType, brandName, searchTerm: query, limit: 12 }),
          userId ? searchSavedDeviceModels({ deviceType, brandId, brandName, searchTerm: query, limit: 12 }) : [],
        ]);
        if (active) {
          setResults(models);
          setSavedResults(savedModels.filter((saved) => !models.some((model) => model.id === (isSwitch ? saved.promoted_model_id : saved.catalog_model_id))));
          setActiveIndex(-1);
        }
      } catch {
        if (active) {
          setResults([]);
          setSavedResults([]);
          setError('Unable to load switch models. Try again.');
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
  }, [brandId, brandName, deviceType, open, query, userId]);

  async function selectModel(model) {
    const isSwitch = deviceType === 'switch';
    const selectedModelName = isSwitch ? model.sku || model.name : model.model_name;
    const accepted = await onChange(isSwitch ? {
      switchModelId: model.id, model: selectedModelName, customModel: '', modelCatalogLevel: model.catalog_level,
      connectionProfileId: model.active_connection_profile_id, connectionProfileVersion: model.connection_profile_version,
    } : {
      catalogModelId: model.id, model: selectedModelName, customModel: '',
    });
    if (accepted === false) return;
    setQuery(selectedModelName);
    setOpen(false);
  }

  async function selectCustomModel(name = query) {
    const normalizedName = String(name || '').trim();
    if (!normalizedName) return;
    if (userId) {
      try {
        await saveUserDeviceModel({ deviceType, brandId, catalogBrandId, savedBrandId, brandName, modelName: normalizedName, userId });
      } catch (saveError) {
        setError(saveError.message || 'Unable to save this custom model.');
        setOpen(true);
        return;
      }
    }
    const accepted = await onChange({ switchModelId: null, catalogModelId: null, model: normalizedName, customModel: normalizedName, modelCatalogLevel: null, connectionProfileId: null, connectionProfileVersion: null });
    if (accepted === false) return;
    setQuery(normalizedName);
    setOpen(false);
  }

  async function clearSelection(event) {
    event?.stopPropagation();
    const accepted = await onChange({ switchModelId: null, catalogModelId: null, model: '', customModel: '', modelCatalogLevel: null, connectionProfileId: null, connectionProfileVersion: null });
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
      selectModel(results[activeIndex]);
    }
  }

  const canUseCustom = Boolean(brandName && query.trim().length >= 1);

  return (
    <>
      <div className="switch-brand-combobox" ref={rootRef}>
        <div className={`switch-brand-control${open ? ' is-open' : ''}${modelId || customModel ? ' has-selection' : ''}`}>
          <Search size={15} />
          <input
            value={query}
            placeholder={brandName ? `Search ${brandName} models...` : 'Enter a manufacturer first'}
            role="combobox"
            aria-label="Switch model"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={open}
            aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
            onFocus={() => setOpen(true)}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
          />
          {(modelId || customModel || query) && <button type="button" className="switch-brand-clear" title="Clear model" aria-label="Clear model" onClick={clearSelection}><X size={14} /></button>}
          <button type="button" className="switch-brand-toggle" title="Show switch models" aria-label="Show switch models" onClick={() => setOpen((value) => !value)}><ChevronDown size={15} /></button>
        </div>
        {customModel && <span className="switch-brand-custom-state">{userId ? 'Saved custom model' : 'Custom model'}</span>}
        {open && <div className="switch-brand-menu" id={listboxId} role="listbox" aria-label="Switch model search results">
          {loading && <div className="switch-brand-status"><LoaderCircle className="spin" size={16} />Loading switch models...</div>}
          {!loading && error && <div className="switch-brand-status is-error">{error}</div>}
          {!loading && !error && results.map((model, index) => <button id={`${listboxId}-${index}`} type="button" role="option" aria-selected={model.id === modelId} className={index === activeIndex ? 'is-active' : ''} key={model.id} onMouseEnter={() => setActiveIndex(index)} onClick={() => selectModel(model)}><span>{deviceType === 'switch' ? model.sku || model.name : model.model_name}<small>{deviceType === 'switch' ? [model.product_family, model.catalog_level === 'exact_sku' ? 'Exact SKU' : 'Model family', model.active_connection_profile_id ? `Verified profile v${model.connection_profile_version}` : null].filter(Boolean).join(' · ') : [model.product_family, 'Approved catalog model'].filter(Boolean).join(' · ')}</small></span>{model.id === modelId && <Check size={15} />}</button>)}
          {!loading && !error && savedResults.map((model) => <button type="button" role="option" aria-selected={model.model_name === customModel} key={`saved-${model.id}`} onClick={() => selectCustomModel(model.model_name)}><span>{model.model_name}<small>{model.review_status === 'pending' ? 'Saved by you · Pending catalog review' : 'Saved by you'}</small></span>{model.model_name === customModel && <Check size={15} />}</button>)}
          {!loading && !error && !results.length && !savedResults.length && <div className="switch-brand-empty"><strong>{brandId ? 'No switch models found.' : 'Choose an official manufacturer to search models.'}</strong><span>You can still use a custom model.</span></div>}
          {!loading && <div className="switch-brand-menu-actions">
            {canUseCustom && <button type="button" onClick={() => selectCustomModel()}><Plus size={14} />{userId ? `Save “${query.trim()}” to my models` : `Use “${query.trim()}” as custom`}</button>}
            {deviceType === 'switch' && brandId && <button type="button" onClick={() => { setOpen(false); setSubmissionOpen(true); }}><Plus size={14} />Submit a new switch model</button>}
          </div>}
        </div>}
      </div>
      {submissionOpen && <ModelSubmissionDialog brandId={brandId} brandName={brandName} initialName={query.trim()} userId={userId} onClose={() => setSubmissionOpen(false)} onUseCustom={selectCustomModel} onSelectExisting={selectModel} />}
    </>
  );
}