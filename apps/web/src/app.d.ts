import type { SupabaseClient, Session, User } from '@supabase/supabase-js';
import type { Database } from '@workout/shared';

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient<Database>;
      getSession: () => Promise<Session | null>;
      getUser: () => Promise<User | null>;
    }

    interface Platform {
      env: Env;
      ctx: ExecutionContext;
      caches: CacheStorage;
      cf?: IncomingRequestCfProperties;
    }
  }
}

export {};
