


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


DROP EXTENSION IF EXISTS "pg_graphql";



CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "strava_activity_id" bigint NOT NULL,
    "name" "text",
    "sport_type" "text",
    "start_date" timestamp with time zone,
    "moving_time_seconds" integer,
    "elapsed_time_seconds" integer,
    "distance_meters" numeric,
    "total_elevation_gain_meters" numeric,
    "average_speed_mps" numeric,
    "max_speed_mps" numeric,
    "average_heartrate" numeric,
    "max_heartrate" numeric,
    "raw_json" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activities" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."monthly_distance_by_sport" WITH ("security_invoker"='true') AS
 SELECT "user_id",
    ("date_trunc"('month'::"text", "start_date"))::"date" AS "month_start",
    "sport_type",
    "sum"("distance_meters") AS "total_distance_meters",
    "sum"(("distance_meters" / 1609.344)) AS "total_distance_miles",
    "count"(*) AS "activity_count"
   FROM "public"."activities"
  WHERE ("start_date" IS NOT NULL)
  GROUP BY "user_id", ("date_trunc"('month'::"text", "start_date")), "sport_type";


ALTER VIEW "public"."monthly_distance_by_sport" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."oauth_states" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "state" "text" NOT NULL,
    "redirect_to" "text",
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "oauth_states_provider_check" CHECK (("provider" = 'strava'::"text"))
);


ALTER TABLE "public"."oauth_states" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."strava_connections" (
    "user_id" "uuid" NOT NULL,
    "strava_athlete_id" bigint NOT NULL,
    "access_token" "text" NOT NULL,
    "refresh_token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "scope" "text",
    "last_synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."strava_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sync_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "activities_fetched" integer,
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sync_runs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'success'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."sync_runs" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."weekly_activity_minutes" WITH ("security_invoker"='true') AS
 SELECT "user_id",
    ("date_trunc"('week'::"text", "start_date"))::"date" AS "week_start",
    "sport_type",
    (("sum"("moving_time_seconds"))::numeric / 60.0) AS "total_moving_minutes",
    "count"(*) AS "activity_count"
   FROM "public"."activities"
  WHERE ("start_date" IS NOT NULL)
  GROUP BY "user_id", ("date_trunc"('week'::"text", "start_date")), "sport_type";


ALTER VIEW "public"."weekly_activity_minutes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."weekly_sport_breakdown" WITH ("security_invoker"='true') AS
 SELECT "user_id",
    ("date_trunc"('week'::"text", "start_date"))::"date" AS "week_start",
    "sport_type",
    "sum"("moving_time_seconds") AS "total_moving_seconds",
    (("sum"("moving_time_seconds"))::numeric / 60.0) AS "total_moving_minutes",
    "sum"("distance_meters") AS "total_distance_meters",
    "count"(*) AS "activity_count"
   FROM "public"."activities"
  WHERE ("start_date" IS NOT NULL)
  GROUP BY "user_id", ("date_trunc"('week'::"text", "start_date")), "sport_type";


ALTER VIEW "public"."weekly_sport_breakdown" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."yearly_running_distance" WITH ("security_invoker"='true') AS
 SELECT "user_id",
    ("date_trunc"('year'::"text", "start_date"))::"date" AS "year_start",
    "sum"("distance_meters") AS "total_distance_meters",
    "sum"(("distance_meters" / 1609.344)) AS "total_distance_miles",
    "count"(*) AS "activity_count"
   FROM "public"."activities"
  WHERE (("start_date" IS NOT NULL) AND ("sport_type" = ANY (ARRAY['Run'::"text", 'TrailRun'::"text", 'VirtualRun'::"text"])))
  GROUP BY "user_id", ("date_trunc"('year'::"text", "start_date"));


ALTER VIEW "public"."yearly_running_distance" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_user_strava_activity_unique" UNIQUE ("user_id", "strava_activity_id");



ALTER TABLE ONLY "public"."oauth_states"
    ADD CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oauth_states"
    ADD CONSTRAINT "oauth_states_state_key" UNIQUE ("state");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."strava_connections"
    ADD CONSTRAINT "strava_connections_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."sync_runs"
    ADD CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id");



CREATE INDEX "activities_user_sport_type_start_date_idx" ON "public"."activities" USING "btree" ("user_id", "sport_type", "start_date" DESC);



CREATE INDEX "activities_user_start_date_idx" ON "public"."activities" USING "btree" ("user_id", "start_date" DESC);



CREATE INDEX "oauth_states_expires_at_idx" ON "public"."oauth_states" USING "btree" ("expires_at");



CREATE INDEX "oauth_states_state_idx" ON "public"."oauth_states" USING "btree" ("state");



CREATE INDEX "oauth_states_user_provider_idx" ON "public"."oauth_states" USING "btree" ("user_id", "provider");



CREATE INDEX "strava_connections_athlete_id_idx" ON "public"."strava_connections" USING "btree" ("strava_athlete_id");



CREATE INDEX "sync_runs_user_started_at_idx" ON "public"."sync_runs" USING "btree" ("user_id", "started_at" DESC);



CREATE OR REPLACE TRIGGER "activities_set_updated_at" BEFORE UPDATE ON "public"."activities" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "profiles_set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "strava_connections_set_updated_at" BEFORE UPDATE ON "public"."strava_connections" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."oauth_states"
    ADD CONSTRAINT "oauth_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."strava_connections"
    ADD CONSTRAINT "strava_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sync_runs"
    ADD CONSTRAINT "sync_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (((SELECT "auth"."uid"()) = "id"));



CREATE POLICY "Users can select their own Strava connection" ON "public"."strava_connections" FOR SELECT TO "authenticated" USING (((SELECT "auth"."uid"()) = "user_id"));



CREATE POLICY "Users can select their own activities" ON "public"."activities" FOR SELECT TO "authenticated" USING (((SELECT "auth"."uid"()) = "user_id"));



CREATE POLICY "Users can select their own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (((SELECT "auth"."uid"()) = "id"));



CREATE POLICY "Users can select their own sync runs" ON "public"."sync_runs" FOR SELECT TO "authenticated" USING (((SELECT "auth"."uid"()) = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (((SELECT "auth"."uid"()) = "id")) WITH CHECK (((SELECT "auth"."uid"()) = "id"));



ALTER TABLE "public"."activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."oauth_states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."strava_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sync_runs" ENABLE ROW LEVEL SECURITY;


REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";





REVOKE ALL ON ALL TABLES IN SCHEMA "public" FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA "public" FROM "anon";
REVOKE ALL ON ALL TABLES IN SCHEMA "public" FROM "authenticated";
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA "public" FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA "public" FROM "anon";
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA "public" FROM "authenticated";

GRANT ALL ON TABLE "public"."activities" TO "service_role";
GRANT SELECT ON TABLE "public"."activities" TO "authenticated";



GRANT ALL ON TABLE "public"."monthly_distance_by_sport" TO "service_role";
GRANT SELECT ON TABLE "public"."monthly_distance_by_sport" TO "authenticated";



GRANT ALL ON TABLE "public"."oauth_states" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."profiles" TO "authenticated";



GRANT ALL ON TABLE "public"."strava_connections" TO "service_role";



GRANT SELECT("user_id") ON TABLE "public"."strava_connections" TO "authenticated";



GRANT SELECT("strava_athlete_id") ON TABLE "public"."strava_connections" TO "authenticated";



GRANT SELECT("scope") ON TABLE "public"."strava_connections" TO "authenticated";



GRANT SELECT("last_synced_at") ON TABLE "public"."strava_connections" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."strava_connections" TO "authenticated";



GRANT SELECT("updated_at") ON TABLE "public"."strava_connections" TO "authenticated";



GRANT ALL ON TABLE "public"."sync_runs" TO "service_role";
GRANT SELECT ON TABLE "public"."sync_runs" TO "authenticated";



GRANT ALL ON TABLE "public"."weekly_activity_minutes" TO "service_role";
GRANT SELECT ON TABLE "public"."weekly_activity_minutes" TO "authenticated";



GRANT ALL ON TABLE "public"."weekly_sport_breakdown" TO "service_role";
GRANT SELECT ON TABLE "public"."weekly_sport_breakdown" TO "authenticated";



GRANT ALL ON TABLE "public"."yearly_running_distance" TO "service_role";
GRANT SELECT ON TABLE "public"."yearly_running_distance" TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






