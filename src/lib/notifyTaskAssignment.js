import { supabase } from './supabase.js';

// Emails the assignees of freshly created tasks. Never throws: task creation must not depend on email.
export async function notifyTaskAssignment(taskIds) {
  if (!supabase || !taskIds?.length) return { sent: 0, failed: 0 };
  const { data, error } = await supabase.functions.invoke('notify-task-assignment', { body: { taskIds } });
  if (error) {
    let message = error.message;
    try {
      const body = await error.context?.json?.();
      if (body?.error) message = body.error;
    } catch {
      // keep the generic message
    }
    return { sent: 0, failed: 0, error: message };
  }
  return { sent: data?.sent ?? 0, failed: data?.failed ?? 0 };
}
