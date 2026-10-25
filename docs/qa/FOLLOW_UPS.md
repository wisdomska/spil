# Follow-ups

Things noticed while working through the fix handoff that are out of its scope. They are recorded
here instead of changed in code.

| Noticed in           | Item                                                                                                                                                 | Why it is out of scope                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Phase 0              | Firefox does not launch locally on this Windows machine (`spawn UNKNOWN`); Firefox runs only in the nightly CI job on Linux                          | Tooling on the dev machine, not the app                        |
| Phase 0              | `SUPABASE_ACCESS_TOKEN` is not set as a GitHub secret, so the deploy workflow cannot apply migrations; they are pushed by hand with the Supabase CLI | Needs the owner's token                                        |
| SPIL-02              | Drop `players.age_confirmed` and `packs.heat` once production has run on age bands for a while; nothing reads them now                               | Deleting columns is data deletion; kept until the owner agrees |
| Hot Takes            | The admin console cannot set a pack's format yet; new packs are yes or no, and the Hot Takes pack comes from migration 1800                          | Not needed until a second statement pack exists                |
| Hot Takes            | No report button on statements while rating (questions have one); statements are written by us, not players                                          | Worth adding with the next content pass                        |
| Hot Takes            | No share card for Hot Takes; the card is built around a Spill Score                                                                                  | Needs its own card design                                      |
| Hot Takes            | Statements are in English only, with a light Ghanaian flavour (jollof); a local pack could follow                                                    | Content, part of the local packs feature in Batch 3            |
| Most Likely To       | The pack picker still asks "How many questions?" for statement and prompt packs                                                                      | Small copy pass once all modes are in                          |
| Most Likely To       | No share card for Most Likely To ("The room says I'm most likely to…" would make a good one)                                                         | Needs its own card design                                      |
| Red Flag, Green Flag | Green uses the accent and red the inverse colour, keeping to one accent; dedicated green and red tokens would read faster                            | Design decision for the owner; needs new tokens in tokens.css  |
| Rank the Room        | Ranking 10 or more players per prompt is slow on a phone; a later version could rank only the top 3 in big rooms                                     | Product call; fine for typical rooms of 3 to 8                 |
| Who Said That?       | Written answers report live progress only on refresh (the progress broadcast covers ratings, votes and rankings)                                     | One line in save_mode_inputs with the next migration           |
| Who Said That?       | The filter lists are short and English only; a maintained word list (and Twi, Pidgin terms) would catch more                                         | Content and safety pass; reporting covers the gap for now      |
