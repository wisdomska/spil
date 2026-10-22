# Security

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's private vulnerability reporting on this repository (Security tab, "Report a vulnerability"). You will get a reply within 5 working days.

## What we protect

- Players' answers are private. Others can read them only after the reveal and only for players who turned on Spill Mode.
- Row Level Security is enabled on every table; writes go through server route handlers.
- The Supabase service-role key exists only in server code and CI secrets. CI fails the build if it appears in the client bundle.
- Room data is deleted 7 days after the room was created.
