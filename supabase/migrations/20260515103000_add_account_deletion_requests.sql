CREATE TABLE IF NOT EXISTS "public"."account_deletion_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "status" "text" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by_admin_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "account_deletion_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "account_deletion_requests_status_check" CHECK (("status" = ANY (ARRAY['requested'::"text", 'deleted'::"text"])))
);

CREATE UNIQUE INDEX "account_deletion_requests_user_pending_unique_idx"
    ON "public"."account_deletion_requests" USING "btree" ("user_id")
    WHERE ("status" = 'requested'::"text");

CREATE INDEX "account_deletion_requests_status_requested_at_idx"
    ON "public"."account_deletion_requests" USING "btree" ("status", "requested_at" DESC);

ALTER TABLE "public"."account_deletion_requests" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their own deletion requests"
    ON "public"."account_deletion_requests"
    FOR SELECT
    TO "authenticated"
    USING (((SELECT "auth"."uid"()) = "user_id"));

CREATE POLICY "Users can insert their own deletion requests"
    ON "public"."account_deletion_requests"
    FOR INSERT
    TO "authenticated"
    WITH CHECK (((SELECT "auth"."uid"()) = "user_id"));

REVOKE ALL ON TABLE "public"."account_deletion_requests" FROM PUBLIC;
REVOKE ALL ON TABLE "public"."account_deletion_requests" FROM "anon";
REVOKE ALL ON TABLE "public"."account_deletion_requests" FROM "authenticated";

GRANT ALL ON TABLE "public"."account_deletion_requests" TO "service_role";
GRANT SELECT, INSERT ON TABLE "public"."account_deletion_requests" TO "authenticated";
