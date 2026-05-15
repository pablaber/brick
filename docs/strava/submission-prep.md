# Strava Submission Prep

## Submission Copy

Brick is a personal Strava data visualizer for athletes who want to dive into their own training
metrics and activity history. The app imports the authenticated athlete's Strava activity data and
turns it into a private dashboard with summaries, charts, recent activity views, goals, and detailed
activity pages.

Brick is currently invite-only and intended for a small private beta shared among friends. There is
no broad public launch planned for the initial review period.

Brick does not currently include social features. Imported Strava data is visible only to the
authenticated Brick user who connected the Strava account. Brick does not provide public profiles,
leaderboards, activity sharing, friend feeds, or third-party disclosure features.

## Scope Rationale

Brick requests `read,activity:read_all` so athletes can choose to include their full Strava
training history, including private activities, in their personal training dashboard.

Brick is currently a private, single-user dashboard experience. Imported activities are shown only
to the authenticated athlete who connected the Strava account. There are no social, sharing,
leaderboard, public profile, or third-party disclosure features.

Athletes can decline private-activity access on Strava's consent screen, revoke Brick's Strava
access at any time, or request account deletion from Brick.

Brick uses imported activity data only to calculate personal training summaries, charts, goals, and
recent activity views. Brick does not sell Strava data, share it with other users, or use it for
advertising.

If an athlete does not grant private-activity access, Brick imports and displays only the activities
available under the granted Strava permissions.

## Public Links

- Privacy Policy: `https://getbricked.fit/privacy`
- Terms of Service: `https://getbricked.fit/terms`
- Support: `https://getbricked.fit/support`
- Account deletion: authenticated users can request account deletion from
  `https://getbricked.fit/settings`.

## API And Brand Compliance

- Brick uses Strava API data only to provide the authenticated athlete's private training dashboard.
- Brick does not sell Strava data, share it with other users, or use it for advertising.
- Brick stores Strava tokens server-side and never exposes secret credentials in the web app.
- Brick handles Strava webhook deauthorization events by removing locally stored Strava activity
  data, clearing stored tokens, and marking the connection deauthorized.
- Brick provides an authenticated account deletion flow that requests removal of the user's account,
  Strava connection, synced activities, and raw activity payloads.
- Brick prevents one active Strava athlete account from being connected to multiple Brick users.
- Brick includes Strava branding on Strava-powered surfaces and keeps outbound "View on Strava"
  links on activity detail pages rather than presenting Strava as Brick-owned content.

## Screenshot Checklist

Attach screenshots that show the full user flow and every surface where Strava data appears:

- Strava OAuth consent screen with requested scopes visible.
- Brick sign-up page with the Terms of Service and Privacy Policy consent checkbox.
- Settings page before connection, including the "Connect with Strava" button.
- Settings page after connection, including Strava athlete ID, granted scopes, sync status, and
  webhook status.
- Manual sync state on Settings, ideally showing a successful sync after Strava data is imported.
- Dashboard populated with Strava-derived charts, summaries, recent activities, and Strava branding.
- Activity detail page showing imported activity fields and the "View on Strava" button.
- Privacy Policy page.
- Terms of Service page.
- Support page.
- Account deletion request modal and pending request state from Settings.

Optional internal screenshots, if Strava asks for data deletion operations:

- Admin deletion requests tab with a pending deletion request indicator.
- Admin deletion fulfillment confirmation or fulfilled deletion request state.

## Submission Checklist

- Confirm production Strava webhook callback URL, subscription, and signature verification.
- Capture screenshots of every surface where Strava data appears.
- Include links to Brick's Privacy Policy, Terms of Service, Support page, and account deletion
  request flow.
- Include expected user scale and launch plan.
- Confirm API Agreement and Brand Guidelines compliance.
