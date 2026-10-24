# Follow-ups

Things noticed while working through the fix handoff that are out of its scope. They are recorded
here instead of changed in code.

| Noticed in | Item                                                                                                                                                 | Why it is out of scope                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Phase 0    | Firefox does not launch locally on this Windows machine (`spawn UNKNOWN`); Firefox runs only in the nightly CI job on Linux                          | Tooling on the dev machine, not the app                        |
| Phase 0    | `SUPABASE_ACCESS_TOKEN` is not set as a GitHub secret, so the deploy workflow cannot apply migrations; they are pushed by hand with the Supabase CLI | Needs the owner's token                                        |
| SPIL-02    | Drop `players.age_confirmed` and `packs.heat` once production has run on age bands for a while; nothing reads them now                               | Deleting columns is data deletion; kept until the owner agrees |
