import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '../lib/supabase.js';

const LIST_LIMIT = 40;

function timeAgo(value) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(value));
}

const TYPE_LABELS = { site: 'site', rack: 'rack', design: 'design', heatmap: 'heat map' };

function describe(item) {
  const name = item.entity_name || 'Untitled';
  const label = TYPE_LABELS[item.entity_type] || 'item';
  switch (item.action) {
    case 'created': return `${item.actor_name} added the ${label} ${name}`;
    case 'updated': return `${item.actor_name} updated the ${label} ${name}`;
    case 'deleted': return `${item.actor_name} deleted the ${label} ${name}`;
    case 'devices_changed':
      return item.event_count === 1 && item.detail
        ? `${item.actor_name} changed ${item.detail} in rack ${name}`
        : `${item.actor_name} changed devices in rack ${name}`;
    case 'shared': return `${item.actor_name} shared the ${label} ${name} with you${item.detail === 'edit' ? ' (can edit)' : ' (view only)'}`;
    case 'task_assigned': return item.event_count > 1 ? `${item.actor_name} assigned you ${item.event_count} tasks` : `${item.actor_name} assigned you a task: ${name}`;
    case 'task_completed': return item.event_count > 1 ? `${item.actor_name} completed ${item.event_count} tasks you created` : `${item.actor_name} completed your task: ${name}`;
    case 'member_joined': return `${name} joined the workspace`;
    default: return `${item.actor_name} made a change`;
  }
}

// `nav` maps an entity to a page: builder(rackId), design(id), heatmap(id), site(id), tasks(), members().
export default function NotificationBell({ session, nav }) {
  const me = session.user.id;
  const [items, setItems] = useState([]);
  const [lastSeen, setLastSeen] = useState(null);
  const [open, setOpen] = useState(false);
  const [highlightFrom, setHighlightFrom] = useState(null);
  const wrapRef = useRef(null);
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const [{ data: log }, { data: state }] = await Promise.all([
      supabase.from('activity_log').select('*').or(`actor_id.is.null,actor_id.neq.${me}`).order('created_at', { ascending: false }).limit(LIST_LIMIT),
      supabase.from('notification_state').select('last_seen_at').eq('user_id', me).maybeSingle(),
    ]);
    if (log) setItems(log);
    if (state) {
      setLastSeen(state.last_seen_at);
    } else {
      // First use: start from now so old history is not shown as unread.
      const now = new Date().toISOString();
      await supabase.from('notification_state').upsert({ user_id: me, last_seen_at: now }, { onConflict: 'user_id', ignoreDuplicates: true });
      setLastSeen(now);
    }
  }, [me]);

  const scheduleLoad = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(load, 400);
  }, [load]);

  useEffect(() => {
    load();
    if (!supabase) return undefined;
    const channel = supabase
      .channel(`activity-${me}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, scheduleLoad)
      .subscribe();
    const onVisible = () => { if (document.visibilityState === 'visible') scheduleLoad(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [me, load, scheduleLoad]);

  useEffect(() => {
    if (!open) return undefined;
    function close(event) {
      if (event.key === 'Escape' || (event.type === 'pointerdown' && !wrapRef.current?.contains(event.target))) setOpen(false);
    }
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const isUnread = (item) => lastSeen && new Date(item.created_at) > new Date(lastSeen);
  const unread = items.filter(isUnread).length;

  async function toggle() {
    if (open) { setOpen(false); return; }
    setHighlightFrom(lastSeen);
    setOpen(true);
    if (unread > 0 && supabase) {
      const now = new Date().toISOString();
      setLastSeen(now);
      await supabase.from('notification_state').upsert({ user_id: me, last_seen_at: now });
    }
  }

  function openItem(item) {
    setOpen(false);
    const go = {
      site: () => nav?.site?.(item.entity_id),
      rack: () => nav?.builder?.(item.entity_id),
      design: () => nav?.design?.(item.entity_id),
      heatmap: () => nav?.heatmap?.(item.entity_id),
      task: () => nav?.tasks?.(),
      member: () => nav?.members?.(),
    }[item.entity_type];
    // Deleted things have nowhere to go.
    if (item.action !== 'deleted') go?.();
  }

  const isNew = (item) => highlightFrom && new Date(item.created_at) > new Date(highlightFrom);

  return (
    <div className="notify" ref={wrapRef}>
      <button className="notify-button" onClick={toggle} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} aria-expanded={open} title="Notifications">
        <Bell size={18} />
        {unread > 0 && <span className="notify-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="notify-menu" role="dialog" aria-label="Notifications">
          <div className="notify-title">Activity</div>
          {items.length === 0 ? (
            <p className="notify-empty">Nothing yet. Changes made by your team show up here.</p>
          ) : (
            <ul className="notify-list">
              {items.map((item) => (
                <li key={item.id}>
                  <button className={`notify-item${isNew(item) ? ' is-new' : ''}`} onClick={() => openItem(item)} disabled={item.action === 'deleted'}>
                    <span className="notify-text">{describe(item)}</span>
                    <span className="notify-time">{timeAgo(item.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
