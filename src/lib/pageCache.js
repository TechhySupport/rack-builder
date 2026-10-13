import { supabase } from './supabase.js';

// In-memory results of each page's last load, so switching tabs paints instantly and refreshes in the background.
const store = new Map();

export const readCache = (key) => store.get(key);
export const writeCache = (key, value) => { store.set(key, value); };
export const clearCache = () => store.clear();

const EMPTY_ACCESS = { groups: [], groupSites: [], groupMembers: [], sitePermissions: [] };

export const EMPTY_DASHBOARD = {
  organisations: [], sites: [], racks: [], locations: [], members: [], invitations: [], devices: [], tasks: [], access: EMPTY_ACCESS, taskRackLink: false,
};

export async function fetchDashboardData(userId) {
  const { data: membershipData, error: membershipError } = await supabase
    .from('organisation_members')
    .select('organisation_id')
    .eq('user_id', userId)
    .eq('status', 'active');
  if (membershipError) return { error: membershipError.message };

  const organisationIds = (membershipData || []).map((membership) => membership.organisation_id);
  if (organisationIds.length === 0) return { data: EMPTY_DASHBOARD };

  const { data: orgData, error: orgError } = await supabase
    .from('organisations')
    .select('id, name, created_at')
    .in('id', organisationIds)
    .order('created_at', { ascending: true });
  if (orgError) return { error: orgError.message };

  const tasksQuery = (columns) => supabase.from('tasks').select(columns).in('organisation_id', organisationIds).order('created_at', { ascending: false });
  const [siteResponse, rackResponse, memberResponse, invitationResponse, deviceResponse, taskResponse, locationResponse, groupResponse, groupSiteResponse, groupMemberResponse, permissionResponse] = await Promise.all([
    supabase.from('sites').select('id, organisation_id, name, address, updated_at').in('organisation_id', organisationIds).order('name'),
    supabase.from('racks').select('id, organisation_id, site_id, location_id, name, identifier, ru_capacity, ru_size_unknown, doc_status, updated_at').in('organisation_id', organisationIds).order('updated_at', { ascending: false }),
    supabase.from('organisation_members').select('id, organisation_id, user_id, role, status, job_title, joined_at, profiles!organisation_members_user_id_fkey(full_name)').in('organisation_id', organisationIds).order('joined_at'),
    supabase.from('organisation_invitations').select('id, organisation_id, invited_email, invited_role, job_title, group_ids, status, created_at').in('organisation_id', organisationIds).eq('status', 'pending').order('created_at', { ascending: false }),
    supabase.from('devices').select('id, organisation_id, rack_id, name, device_type, manufacturer, custom_manufacturer, model, custom_model, hostname, serial_number, asset_tag, ip_address, mac_address, ru_height, starting_ru, face, status, updated_at, site_id, heatmap_id, heatmap_device_id, map_label, map_x, map_y').in('organisation_id', organisationIds).order('name'),
    tasksQuery('id, organisation_id, device_id, rack_id, assignee_id, created_by, title, description, status, created_at'),
    supabase.from('locations').select('id, organisation_id, site_id, name').in('organisation_id', organisationIds).order('name'),
    supabase.from('member_groups').select('id, organisation_id, name').in('organisation_id', organisationIds).order('name'),
    supabase.from('member_group_sites').select('group_id, site_id'),
    supabase.from('member_group_members').select('group_id, user_id'),
    supabase.from('member_site_permissions').select('organisation_id, user_id, site_id').in('organisation_id', organisationIds),
  ]);

  // Until the rack_id migration is applied, fall back to the original task columns.
  let taskResult = taskResponse;
  let taskRackLink = false;
  if (taskResponse.error?.code === '42703') {
    taskResult = await tasksQuery('id, organisation_id, device_id, assignee_id, created_by, title, status, created_at');
  } else if (!taskResponse.error) {
    taskRackLink = true;
  }

  const error = siteResponse.error || rackResponse.error || memberResponse.error || deviceResponse.error || taskResult.error
    ? (siteResponse.error?.message || rackResponse.error?.message || memberResponse.error?.message || deviceResponse.error?.message || taskResult.error?.message || 'Unable to load your rack inventory.')
    : '';

  return {
    error,
    data: {
      organisations: orgData,
      sites: siteResponse.data || [],
      racks: rackResponse.data || [],
      locations: locationResponse.data || [],
      members: memberResponse.data || [],
      invitations: invitationResponse.data || [],
      devices: deviceResponse.data || [],
      tasks: taskResult.data || [],
      access: {
        groups: groupResponse.data || [],
        groupSites: groupSiteResponse.data || [],
        groupMembers: groupMemberResponse.data || [],
        sitePermissions: permissionResponse.data || [],
      },
      taskRackLink,
    },
  };
}

async function firstMembership(userId) {
  const { data: members, error } = await supabase
    .from('organisation_members')
    .select('organisation_id, role, organisations(created_at)')
    .eq('user_id', userId)
    .eq('status', 'active');
  if (error) return { error: error.message };
  const first = [...(members || [])].sort((a, b) => new Date(a.organisations?.created_at) - new Date(b.organisations?.created_at))[0];
  return { membership: first ? { organisationId: first.organisation_id, role: first.role } : null };
}

export async function fetchDesignList(userId) {
  const { membership, error } = await firstMembership(userId);
  if (error) return { error };
  const [{ data, error: listError }, { data: shares }] = await Promise.all([
    supabase.from('designs').select('id, organisation_id, name, updated_at, created_by, profiles!designs_created_by_fkey(full_name)').order('updated_at', { ascending: false }),
    supabase.from('design_shares').select('design_id, permission').eq('user_id', userId),
  ]);
  if (listError) return { error: listError.message };
  const sharedAs = new Map((shares || []).map((share) => [share.design_id, share.permission]));
  return { data: { membership, designs: (data || []).map((design) => ({ ...design, share: sharedAs.get(design.id) || null })) } };
}

export async function fetchHeatmapList(userId) {
  const { membership, error } = await firstMembership(userId);
  if (error) return { error };
  if (!membership) return { data: { membership, sites: [], heatmaps: [], mySiteIds: [] } };
  const [{ data: siteRows }, { data, error: listError }, { data: shares }, { data: assigned }] = await Promise.all([
    supabase.from('sites').select('id, name').eq('organisation_id', membership.organisationId).order('name'),
    supabase.from('heatmaps').select('id, name, level, site_id, organisation_id, created_by, updated_at, sites(name), profiles!heatmaps_created_by_fkey(full_name)').eq('organisation_id', membership.organisationId).order('updated_at', { ascending: false }),
    supabase.from('heatmap_shares').select('heatmap_id, permission').eq('user_id', userId),
    supabase.from('member_site_permissions').select('site_id').eq('user_id', userId),
  ]);
  if (listError) return { error: listError.message };
  const sharedAs = new Map((shares || []).map((share) => [share.heatmap_id, share.permission]));
  return {
    data: {
      membership,
      sites: siteRows || [],
      heatmaps: (data || []).map((item) => ({ ...item, share: sharedAs.get(item.id) || null })),
      mySiteIds: (assigned || []).map((row) => row.site_id),
    },
  };
}

// Loads every tab's list in the background so the first visit to each is instant too.
export function prefetchTabs(userId) {
  if (!supabase) return;
  const jobs = [
    [`dashboard:${userId}`, fetchDashboardData],
    [`designs:${userId}`, fetchDesignList],
    [`heatmaps:${userId}`, fetchHeatmapList],
  ];
  for (const [key, fetcher] of jobs) {
    if (store.has(key)) continue;
    fetcher(userId).then(({ data }) => { if (data && !store.has(key)) store.set(key, data); }).catch(() => {});
  }
}
