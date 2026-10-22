-- Row Level Security, grants, the players_public view and realtime channel
-- authorization. See docs/TECH_SPEC.md sections 10 and 11.
--
-- The browser uses the anon key. Game writes go through route handlers with
-- the service role (which bypasses RLS), so client policies are read rules,
-- plus admin writes on content and settings.

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------

alter table public.packs enable row level security;
alter table public.questions enable row level security;
alter table public.settings enable row level security;
alter table public.feature_flags enable row level security;
alter table public.rooms enable row level security;
alter table public.room_questions enable row level security;
alter table public.players enable row level security;
alter table public.answers enable row level security;
alter table public.guesses enable row level security;
alter table public.results enable row level security;
alter table public.awards enable row level security;
alter table public.reports enable row level security;
alter table public.messages enable row level security;
alter table public.admins enable row level security;
alter table public.audit_log enable row level security;
alter table public.rate_limits enable row level security;
alter table public.stats_daily enable row level security;
alter table public.pack_plays enable row level security;

-- ---------------------------------------------------------------------------
-- Grants (least privilege; RLS then filters rows)
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;

grant select on
  public.packs,
  public.questions,
  public.settings,
  public.feature_flags,
  public.rooms,
  public.room_questions,
  public.answers,
  public.guesses,
  public.results,
  public.awards,
  public.reports,
  public.messages,
  public.admins,
  public.audit_log,
  public.stats_daily,
  public.pack_plays
to anon, authenticated;

-- players: only the public columns. user_id, age_confirmed, is_bot,
-- last_seen_at and hide_name_on_card stay server side.
grant select (
  id,
  room_id,
  nickname,
  avatar,
  rotation_seed,
  status,
  joined_at,
  answers_submitted_at,
  guesses_submitted_at,
  spill_mode
) on public.players to anon, authenticated;

-- Admin writes from the console (policies below restrict them by role).
grant insert, update, delete on public.packs, public.questions to authenticated;
grant update on public.settings to authenticated;
grant insert, update, delete on public.feature_flags to authenticated;

-- rate_limits: no client access at all.

-- ---------------------------------------------------------------------------
-- packs
-- ---------------------------------------------------------------------------

create policy packs_select on public.packs
  for select to anon, authenticated
  using (status = 'live' or (select public.is_admin()));

create policy packs_insert_admin on public.packs
  for insert to authenticated
  with check ((select public.is_admin(array['owner', 'content_lead']::public.admin_role[])));

create policy packs_update_admin on public.packs
  for update to authenticated
  using ((select public.is_admin(array['owner', 'content_lead']::public.admin_role[])))
  with check ((select public.is_admin(array['owner', 'content_lead']::public.admin_role[])));

create policy packs_delete_admin on public.packs
  for delete to authenticated
  using ((select public.is_admin(array['owner', 'content_lead']::public.admin_role[])));

-- ---------------------------------------------------------------------------
-- questions
-- ---------------------------------------------------------------------------

create policy questions_select on public.questions
  for select to anon, authenticated
  using (
    (
      status = 'live'
      and exists (
        select 1 from public.packs pk
        where pk.id = questions.pack_id and pk.status = 'live'
      )
    )
    or (select public.is_admin())
  );

create policy questions_insert_admin on public.questions
  for insert to authenticated
  with check ((select public.is_admin(array['owner', 'content_lead']::public.admin_role[])));

create policy questions_update_admin on public.questions
  for update to authenticated
  using ((select public.is_admin(array['owner', 'content_lead']::public.admin_role[])))
  with check ((select public.is_admin(array['owner', 'content_lead']::public.admin_role[])));

-- Moderators may only set status to hidden (trigger questions_guard_update
-- rejects any other column change).
create policy questions_update_moderator on public.questions
  for update to authenticated
  using ((select public.is_admin(array['moderator']::public.admin_role[])))
  with check (
    (select public.is_admin(array['moderator']::public.admin_role[]))
    and status = 'hidden'
  );

create policy questions_delete_admin on public.questions
  for delete to authenticated
  using ((select public.is_admin(array['owner', 'content_lead']::public.admin_role[])));

-- ---------------------------------------------------------------------------
-- settings, feature_flags
-- ---------------------------------------------------------------------------

create policy settings_select on public.settings
  for select to anon, authenticated
  using (true);

create policy settings_update_owner on public.settings
  for update to authenticated
  using ((select public.is_admin(array['owner']::public.admin_role[])))
  with check ((select public.is_admin(array['owner']::public.admin_role[])));

create policy feature_flags_select on public.feature_flags
  for select to anon, authenticated
  using (true);

create policy feature_flags_insert_owner on public.feature_flags
  for insert to authenticated
  with check ((select public.is_admin(array['owner']::public.admin_role[])));

create policy feature_flags_update_owner on public.feature_flags
  for update to authenticated
  using ((select public.is_admin(array['owner']::public.admin_role[])))
  with check ((select public.is_admin(array['owner']::public.admin_role[])));

create policy feature_flags_delete_owner on public.feature_flags
  for delete to authenticated
  using ((select public.is_admin(array['owner']::public.admin_role[])));

-- ---------------------------------------------------------------------------
-- rooms and game data (read only for clients)
-- ---------------------------------------------------------------------------

create policy rooms_select on public.rooms
  for select to authenticated
  using (public.is_room_member(id) or (select public.is_admin()));

create policy room_questions_select on public.room_questions
  for select to authenticated
  using (public.is_room_member(room_id));

create policy players_select on public.players
  for select to authenticated
  using (public.is_room_member(room_id));

-- Own answers always; another player's answers only after the reveal and only
-- when that player turned Spill Mode on.
create policy answers_select_own on public.answers
  for select to authenticated
  using (player_id in (select public.current_player_ids()));

create policy answers_select_spilled on public.answers
  for select to authenticated
  using (
    public.is_room_revealed(room_id)
    and exists (
      select 1 from public.players p
      where p.id = answers.player_id and p.spill_mode
    )
  );

create policy guesses_select_own on public.guesses
  for select to authenticated
  using (guesser_id in (select public.current_player_ids()));

create policy guesses_select_revealed on public.guesses
  for select to authenticated
  using (public.is_room_revealed(room_id));

create policy results_select on public.results
  for select to authenticated
  using (public.is_room_revealed(room_id));

create policy awards_select on public.awards
  for select to authenticated
  using (public.is_room_revealed(room_id));

-- ---------------------------------------------------------------------------
-- ops (admins read; the API writes with the service role)
-- ---------------------------------------------------------------------------

create policy reports_select_admin on public.reports
  for select to authenticated
  using ((select public.is_admin()));

create policy messages_select_admin on public.messages
  for select to authenticated
  using ((select public.is_admin()));

create policy admins_select_admin on public.admins
  for select to authenticated
  using ((select public.is_admin()));

create policy audit_log_select_admin on public.audit_log
  for select to authenticated
  using ((select public.is_admin()));

create policy stats_daily_select_admin on public.stats_daily
  for select to authenticated
  using ((select public.is_admin()));

create policy pack_plays_select_admin on public.pack_plays
  for select to authenticated
  using ((select public.is_admin()));

-- rate_limits: RLS on, no policies.

-- ---------------------------------------------------------------------------
-- players_public view
-- ---------------------------------------------------------------------------

create view public.players_public
with (security_invoker = true)
as
select
  p.id,
  p.room_id,
  p.nickname,
  p.avatar,
  p.rotation_seed,
  p.status,
  p.answers_submitted_at is not null as answers_submitted,
  p.guesses_submitted_at is not null as guesses_submitted,
  p.spill_mode,
  coalesce(r.host_player_id = p.id, false) as is_host,
  p.joined_at
from public.players p
join public.rooms r on r.id = p.room_id;

revoke all on public.players_public from anon, authenticated;
grant select on public.players_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: private channel room:{id}
-- ---------------------------------------------------------------------------

create policy room_members_receive_broadcasts on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.can_access_room_topic((select realtime.topic()))
  );

-- Presence (online dot) needs members to track themselves on the channel.
create policy room_members_track_presence on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'presence'
    and public.can_access_room_topic((select realtime.topic()))
  );
