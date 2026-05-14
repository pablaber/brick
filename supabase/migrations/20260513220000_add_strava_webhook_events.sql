CREATE TABLE IF NOT EXISTS "public"."strava_webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_key" "text" NOT NULL,
    "user_id" "uuid",
    "object_type" "text" NOT NULL,
    "object_id" bigint NOT NULL,
    "aspect_type" "text" NOT NULL,
    "owner_id" bigint NOT NULL,
    "subscription_id" bigint,
    "event_time" timestamp with time zone,
    "updates" "jsonb",
    "raw_json" "jsonb" NOT NULL,
    "signature_header" "text" NOT NULL,
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    "processing_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "processing_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "strava_webhook_events_aspect_type_check" CHECK (("aspect_type" = ANY (ARRAY['create'::"text", 'update'::"text", 'delete'::"text"]))),
    CONSTRAINT "strava_webhook_events_object_type_check" CHECK (("object_type" = ANY (ARRAY['activity'::"text", 'athlete'::"text"]))),
    CONSTRAINT "strava_webhook_events_processing_status_check" CHECK (("processing_status" = ANY (ARRAY['pending'::"text", 'processed'::"text", 'ignored'::"text", 'failed'::"text"])))
);

ALTER TABLE ONLY "public"."strava_webhook_events"
    ADD CONSTRAINT "strava_webhook_events_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."strava_webhook_events"
    ADD CONSTRAINT "strava_webhook_events_event_key_key" UNIQUE ("event_key");

ALTER TABLE ONLY "public"."strava_webhook_events"
    ADD CONSTRAINT "strava_webhook_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

CREATE INDEX "strava_webhook_events_user_received_idx" ON "public"."strava_webhook_events" USING "btree" ("user_id", "received_at" DESC);
CREATE INDEX "strava_webhook_events_owner_id_idx" ON "public"."strava_webhook_events" USING "btree" ("owner_id");
CREATE INDEX "strava_webhook_events_object_idx" ON "public"."strava_webhook_events" USING "btree" ("object_type", "object_id");
CREATE INDEX "strava_webhook_events_status_idx" ON "public"."strava_webhook_events" USING "btree" ("processing_status");
CREATE INDEX "strava_webhook_events_event_time_idx" ON "public"."strava_webhook_events" USING "btree" ("event_time" DESC);

ALTER TABLE "public"."strava_webhook_events" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."strava_webhook_events" FROM PUBLIC;
REVOKE ALL ON TABLE "public"."strava_webhook_events" FROM "anon";
REVOKE ALL ON TABLE "public"."strava_webhook_events" FROM "authenticated";
GRANT ALL ON TABLE "public"."strava_webhook_events" TO "service_role";

ALTER TABLE "public"."strava_connections"
    ALTER COLUMN "access_token" DROP NOT NULL,
    ALTER COLUMN "refresh_token" DROP NOT NULL,
    ALTER COLUMN "expires_at" DROP NOT NULL;

ALTER TABLE "public"."strava_connections"
    ADD COLUMN IF NOT EXISTS "webhook_events_received_at" timestamp with time zone,
    ADD COLUMN IF NOT EXISTS "last_webhook_event_at" timestamp with time zone,
    ADD COLUMN IF NOT EXISTS "deauthorized_at" timestamp with time zone;

GRANT SELECT("webhook_events_received_at") ON TABLE "public"."strava_connections" TO "authenticated";
GRANT SELECT("last_webhook_event_at") ON TABLE "public"."strava_connections" TO "authenticated";
GRANT SELECT("deauthorized_at") ON TABLE "public"."strava_connections" TO "authenticated";
