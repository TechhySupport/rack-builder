import { supabase } from './supabase.js';

export function normalizeManufacturerName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export async function searchSwitchBrands(searchTerm, limit = 12) {
  if (!supabase) throw new Error('Manufacturer search is unavailable.');

  const { data, error } = await supabase.rpc('search_switch_brands', {
    search_term: normalizeManufacturerName(searchTerm),
    result_limit: limit,
  });

  if (error) throw error;
  return data || [];
}

export async function searchDeviceCatalogBrands(deviceType, searchTerm, limit = 12) {
  if (!supabase) throw new Error('Manufacturer search is unavailable.');

  const { data, error } = await supabase.rpc('search_device_catalog_brands', {
    catalog_device_type: deviceType,
    search_term: normalizeManufacturerName(searchTerm),
    result_limit: limit,
  });

  if (error) throw error;
  return data || [];
}

export async function searchSavedDeviceBrands(deviceType, searchTerm, limit = 12) {
  if (!supabase) throw new Error('Saved manufacturer search is unavailable.');

  let query = supabase
    .from('user_device_brands')
    .select('id, device_type, name, catalog_brand_id, review_status, use_count, last_used_at')
    .eq('device_type', deviceType)
    .order('last_used_at', { ascending: false })
    .limit(limit);

  const normalizedSearch = normalizeManufacturerName(searchTerm);
  if (normalizedSearch) query = query.ilike('name', `%${normalizedSearch}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function saveUserDeviceBrand({ deviceType, manufacturerName, userId }) {
  if (!supabase) throw new Error('Saving manufacturers is unavailable.');
  if (!userId) throw new Error('Sign in to save a manufacturer.');

  const name = normalizeManufacturerName(manufacturerName);
  if (name.length < 2 || name.length > 120) throw new Error('Enter a manufacturer name between 2 and 120 characters.');

  const { data, error } = await supabase.rpc('save_user_device_brand', {
    catalog_device_type: deviceType,
    manufacturer: name,
  });

  if (error) throw error;
  return data;
}

export async function submitSwitchBrand({ manufacturerName, website, notes, userId }) {
  if (!supabase) throw new Error('Manufacturer submissions are unavailable.');
  if (!userId) throw new Error('Sign in to submit a manufacturer for review.');

  const name = normalizeManufacturerName(manufacturerName);
  if (name.length < 2 || name.length > 120) throw new Error('Enter a manufacturer name between 2 and 120 characters.');

  const normalizedWebsite = String(website || '').trim();
  if (normalizedWebsite) {
    let parsedUrl;
    try {
      parsedUrl = new URL(normalizedWebsite);
    } catch {
      throw new Error('Enter a valid website URL, including https://.');
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Website must use http:// or https://.');
  }

  const matches = await searchSwitchBrands(name, 20);
  const existing = matches.find((brand) => brand.name.toLocaleLowerCase() === name.toLocaleLowerCase());
  if (existing) return { existing };

  const { data, error } = await supabase
    .from('switch_brand_submissions')
    .insert({
      manufacturer_name: name,
      website: normalizedWebsite || null,
      notes: String(notes || '').trim() || null,
      submitted_by: userId,
    });

  if (error?.code === '23505') throw new Error('This manufacturer is already pending review.');
  if (error) throw error;
  return { submission: data, customName: name };
}
