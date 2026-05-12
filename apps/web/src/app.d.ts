/// <reference path="../worker-configuration.d.ts" />

import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '@workout/shared';

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient<Database>;
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
