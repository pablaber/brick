import { createServerClient } from '@supabase/ssr';
import type { Handle } from '@sveltejs/kit';
import { getSupabasePublicConfig } from '$lib/supabase-config';

export const handle: Handle = async ({ event, resolve }) => {
  const { url, publishableKey } = getSupabasePublicConfig();

  event.locals.supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => event.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          event.cookies.set(name, value, { ...options, path: '/' });
        });
      }
    }
  });

  event.locals.getUser = async () => {
    const {
      data: { user }
    } = await event.locals.supabase.auth.getUser();
    return user;
  };

  return resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === 'content-range' || name === 'x-supabase-api-version';
    }
  });
};
