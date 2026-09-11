import { supabase } from './supabase.js';

export function normalizeModelName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export async function searchSwitchModels(brandId, searchTerm, limit = 12) {
  if (!supabase) throw new Error('Switch model search is unavailable.');
  if (!brandId) return [];

  const { data, error } = await supabase.rpc('search_switch_models', {
    brand_id: brandId,
    search_term: normalizeModelName(searchTerm),
    result_limit: limit,
  });

  if (error) throw error;
  return data || [];
}

export async function searchDeviceCatalogModels({ deviceType, brandName, searchTerm, limit = 12 }) {
  if (!supabase) throw new Error('Device model search is unavailable.');

  const { data, error } = await supabase.rpc('search_device_catalog_models', {
    catalog_device_type: deviceType,
    manufacturer: String(brandName || '').trim(),
    search_term: normalizeModelName(searchTerm),
    result_limit: limit,
  });

  if (error) throw error;
  return data || [];
}

export async function searchSavedDeviceModels({ deviceType, brandId, brandName, searchTerm, limit = 12 }) {
  if (!supabase) throw new Error('Saved device model search is unavailable.');

  let query = supabase
    .from('user_device_models')
    .select('id, device_type, switch_brand_id, manufacturer_name, model_name, promoted_model_id, catalog_model_id, review_status, use_count, last_used_at')
    .eq('device_type', deviceType)
    .order('last_used_at', { ascending: false })
    .limit(limit);

  if (brandId) query = query.eq('switch_brand_id', brandId);
  else if (brandName) query = query.ilike('manufacturer_name', brandName.trim());

  const normalizedSearch = normalizeModelName(searchTerm);
  if (normalizedSearch) query = query.ilike('model_name', `%${normalizedSearch}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function saveUserDeviceModel({ deviceType, brandId, catalogBrandId, savedBrandId, brandName, modelName, userId }) {
  if (!supabase) throw new Error('Saving custom device models is unavailable.');
  if (!userId) throw new Error('Sign in to save a custom device model.');

  const name = normalizeModelName(modelName);
  const manufacturer = String(brandName || '').trim().replace(/\s+/g, ' ');
  if (!manufacturer) throw new Error('Enter or select a manufacturer first.');
  if (!name) throw new Error('Enter a model name first.');

  const { data, error } = await supabase.rpc('save_user_device_model', {
    catalog_device_type: deviceType,
    switch_brand_id: brandId || null,
    catalog_brand_id: catalogBrandId || null,
    saved_brand_id: savedBrandId || null,
    manufacturer,
    model: name,
  });

  if (error) throw error;
  return data;
}

export async function getSwitchModelConnectionProfile(modelId) {
  if (!supabase) throw new Error('Switch connection profiles are unavailable.');
  if (!modelId) return null;

  const { data, error } = await supabase.rpc('get_switch_model_connection_profile', { model_id: modelId });
  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    modelId: data.model_id,
    version: data.version,
    sourceUrl: data.source_url,
    verifiedAt: data.verified_at,
    groups: (data.groups || []).map((group) => ({
      id: group.id,
      templateKey: group.template_key,
      name: group.name_pattern,
      category: group.category,
      medium: group.medium,
      direction: group.direction,
      count: group.quantity,
      startIndex: group.start_index,
      appendIndex: group.append_index,
      speedMbps: group.speed_mbps,
      poeCapability: group.poe,
      connectorType: group.connector_type,
      sortOrder: group.sort_order,
    })),
  };
}

export async function submitSwitchModel({ brandId, modelName, productFamily, notes, userId }) {
  if (!supabase) throw new Error('Switch model submissions are unavailable.');
  if (!userId) throw new Error('Sign in to submit a switch model for review.');
  if (!brandId) throw new Error('Select an official manufacturer before submitting a model.');

  const name = normalizeModelName(modelName);
  if (name.length < 1 || name.length > 160) throw new Error('Enter a model name between 1 and 160 characters.');

  const matches = await searchSwitchModels(brandId, name, 20);
  const existing = matches.find((model) => model.name.toLocaleLowerCase() === name.toLocaleLowerCase());
  if (existing) return { existing };

  const { data, error } = await supabase
    .from('switch_model_submissions')
    .insert({
      switch_brand_id: brandId,
      model_name: name,
      product_family: String(productFamily || '').trim() || null,
      notes: String(notes || '').trim() || null,
      submitted_by: userId,
    });

  if (error?.code === '23505') throw new Error('This model is already pending review for this manufacturer.');
  if (error) throw error;
  return { submission: data, customName: name };
}