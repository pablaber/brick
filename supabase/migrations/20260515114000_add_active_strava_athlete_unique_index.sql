CREATE UNIQUE INDEX IF NOT EXISTS "strava_connections_active_athlete_unique"
    ON "public"."strava_connections" ("strava_athlete_id")
    WHERE ("deauthorized_at" IS NULL);
