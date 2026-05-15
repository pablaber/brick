# Strava Submission Prep

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

## Submission Checklist

- Confirm production Strava webhook callback URL, subscription, and signature verification.
- Capture screenshots of every surface where Strava data appears.
- Include links to Brick's Privacy Policy, Terms of Service, Support page, and account deletion
  request flow.
- Include expected user scale and launch plan.
- Confirm API Agreement and Brand Guidelines compliance.
