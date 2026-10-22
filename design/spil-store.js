(function () {
  if (window.SpilStore) return;
  const KEY = 'spil-db-v1';
  const ch = 'BroadcastChannel' in window ? new BroadcastChannel('spil') : null;
  const subs = new Set();
  const uid = () => Math.random().toString(36).slice(2, 10);
  const now = () => Date.now();
  const Q = {
    classic: ['lied that you were "on your way" while still in bed?', "checked an ex's new partner's profile at 2am?", "gone to a party you weren't invited to?", 'pretended your data finished to dodge a call?', "eaten someone else's food from the shared fridge?", 'sent a voice note you instantly regretted?', 'borrowed money and "forgot" to pay it back?', "sneaked out of your parents' house at night?", "read someone's messages over their shoulder?", 'faked being sick to skip an event?', 'regifted a present?', "laughed at a joke you didn't understand?"],
    afterdark: ['sent a risky text to the wrong person?', "kissed someone whose name you didn't know?", 'gone on a date just for the free food?', 'stayed in a situationship way too long?', 'slid into a DM at 3am?', 'ghosted someone after a great date?', 'lied about your body count?', "hooked up with a friend's ex?", 'been caught sneaking someone in?', "had a crush on a friend's partner?", 'drunk-texted an ex?', 'pretended to be single?'],
    campus: ['copied an assignment the night before?', 'slept through an exam?', 'had a situationship with a coursemate?', 'signed attendance for a friend?', 'cried in the library?', 'lied to your parents about your grades?', 'eaten instant noodles three meals in a row?', 'borrowed notes and never returned them?', 'joined a club just for the free food?', 'gone to class still in pyjamas?', 'written a whole essay in one night?', 'fallen asleep in a lecture?'],
    work: ['replied all by accident?', 'faked a sick day?', 'muted a call to complain about the person talking?', 'pretended to be busy when your boss walked by?', "taken credit for someone else's idea?", 'slept on a video call with the camera off?', 'applied for a job while at work?', 'cried in the office bathroom?', 'taken office supplies home?', 'written "per my last email" angrily?', 'job-hunted on company time?', 'dated a coworker?']
  };
  const ADULT = [
    { id: 'purity', name: 'The Purity 100', heat: 'intense', blurb: 'All 100 classic purity questions. Your Spill Score is the flip side.', icon: 'ph ph-list-checks', tone: 'accent', q: ["held hands with someone romantically?","been on a date?","been in a relationship that lasted more than a month?","slow danced with someone you fancied?","kissed someone on the lips?","used tongue while kissing?","made out with someone for more than ten minutes?","made out lying down?","given or received a hickey?","kissed a stranger?","made out with more than one person in the same night?","kissed someone of the same gender?","been in love?","said \"I love you\" without meaning it?","been dumped by text?","been touched under your clothes by someone?","touched someone under their clothes?","been fully naked in front of a partner?","showered with a partner?","given someone a lap dance?","sexted someone?","sent a nude photo?","received a nude you did not ask for?","watched porn?","masturbated?","masturbated with someone else in the room?","used a sex toy?","given oral sex?","received oral sex?","had someone finish in your mouth, or finished in theirs?","had sex?","had sex without protection?","had a pregnancy scare?","been tested for an STI?","had sex in a car?","had sex outdoors?","had sex somewhere public?","had sex with someone the same day you met them?","had a one-night stand?","had sex with someone ten or more years older or younger than you?","paid for, or been paid for, anything sexual?","had a threesome?","had anal sex?","had sex during a period?","had sex with someone who was in a relationship?","cheated on a partner?","had sex with two different people in 24 hours?","had sex with more than ten people?","been caught having sex?","filmed yourself having sex?","had sex with someone of the same gender?","faked an orgasm?","had sex at a party?","had sex in your parents' bed?","joined the mile-high club?","drunk alcohol?","been drunk?","blacked out from drinking?","thrown up from drinking?","played a drinking game?","drunk before noon?","used a fake ID?","smoked a cigarette?","vaped?","smoked weed?","eaten an edible?","been high in public?","tried shrooms or acid?","tried cocaine?","tried MDMA?","mixed alcohol with other drugs?","sold drugs?","driven after drinking?","hooked up with someone while drunk?","woken up somewhere with no idea how you got there?","gone to work or class still drunk?","snuck out of the house at night?","lied to your parents about where you were?","stolen from a shop?","vandalised property?","trespassed somewhere off limits?","been in a physical fight?","been chased by security or police?","been arrested?","spent a night in a cell?","cheated on an exam?","been suspended or expelled?","gate-crashed a party?","skinny dipped?","flashed someone?","had a crush on a teacher, lecturer or boss?","hooked up with a coworker?","hooked up with a friend's ex?","dated two people at once without either knowing?","ghosted someone after sleeping with them?","been to a strip club?","been to a sex party?","lied about your age to get in somewhere?","got a tattoo or piercing your parents don't know about?","cried during or after sex?"] },
    { id: 'sheets', heat: 'explicit', name: 'Between the Sheets', blurb: 'Bedroom confessions. 18+ only.', icon: 'ph ph-bed', tone: 'inverse', q: ['had sex in a public place?', 'sent nudes to someone you had just met?', 'faked an orgasm?', 'had a one-night stand?', 'slept with someone whose name you never learned?', 'hooked up with a coworker?', "had sex in your parents' house while they were home?", 'watched porn with a partner?', 'been walked in on during sex?', 'had a friends-with-benefits arrangement?', 'had sex on a first date?', 'filmed yourself during sex?'] },
    { id: 'nolimits', heat: 'intense', name: 'No Limits', blurb: 'The most intense pack we have. Proceed carefully.', icon: 'ph ph-fire', tone: 'accent', q: ['had a threesome?', 'slept with two different people in the same day?', "hooked up with a friend's partner?", 'joined the mile-high club?', 'been to a sex party?', 'slept with someone more than 15 years older than you?', 'cheated on a partner?', 'slept with an ex while dating someone new?', 'hooked up with a match the same night you matched?', 'sent explicit photos to the wrong person?', 'had sex somewhere you could have been arrested for it?', 'slept with more than one person from the same friend group?'] },
    { id: 'kink', heat: 'explicit', name: 'Kink Curious', blurb: 'Toys, roles and safe words. 18+ only.', icon: 'ph ph-key', tone: 'raised', q: ['used handcuffs or restraints in bed?', 'been blindfolded during sex?', 'tried role-play in the bedroom?', "owned a sex toy you'd be embarrassed to explain?", 'used a sex toy with a partner?', 'tried spanking in bed?', 'agreed on a safe word with a partner?', 'tried dirty talk and instantly regretted it?', 'acted out a fantasy you would never admit to your friends?', 'tried a kink you first found online?', 'taken the dominant role in bed?', 'taken the submissive role in bed?'] }
  ];
  const EXTRA = [
    { id: 'roadtrip', name: 'Passport Stamps', blurb: 'Holidays, airports and bad decisions abroad.', icon: 'ph ph-airplane-tilt', q: ['missed a flight?', 'lied at customs?', 'had a holiday romance?', 'got lost in a city with a dead phone?', 'slept in an airport?', 'faked an accent abroad?', 'blown your whole budget in the first two days?', 'cried on a plane?', 'snuck into a hotel pool you were not staying at?', 'pretended not to speak English to avoid someone?', 'changed your flight to stay with someone you just met?', 'come home with a tattoo from a trip?'] },
    { id: 'groupchat', name: 'Group Chat', blurb: 'Screenshots, close friends and left on read.', icon: 'ph ph-chat-circle-dots', q: ['screenshotted a chat to send to someone else?', 'sent a message about someone to that same person?', 'left a group chat dramatically?', 'muted your family group chat?', 'stalked an ex on a second account?', 'posted something just so one person would see it?', 'deleted a post because it got no likes?', 'pretended you did not see a message for days?', 'had a secret group chat without one friend?', 'typed a long reply and deleted it all?', 'liked an old photo by accident while stalking?', 'blocked someone and then unblocked them to check their page?'] }
  ];
  const migrate = db => {
    let changed = false;
    EXTRA.forEach(p => {
      if (db.packs.some(x => x.id === p.id) || (db.removedSeeds || []).includes(p.id)) return;
      db.packs.push({ id: p.id, name: p.name, blurb: p.blurb, icon: p.icon, tone: 'raised', adult: false, heat: '', status: 'live', updated: now() });
      p.q.forEach(text => db.questions.push({ id: uid(), pack: p.id, text, status: 'live', yes: 0, answered: 0, updated: now() }));
      changed = true;
    });
    ADULT.forEach(p => {
      if (db.packs.some(x => x.id === p.id) || (db.removedSeeds || []).includes(p.id)) return;
      db.packs.push({ id: p.id, name: p.name, blurb: p.blurb, icon: p.icon, tone: p.tone, adult: true, heat: p.heat, status: 'live', updated: now() });
      p.q.forEach(text => db.questions.push({ id: uid(), pack: p.id, text, status: 'live', yes: 0, answered: 0, updated: now() }));
      changed = true;
    });
    const HEAT = { afterdark: 'spicy', sheets: 'explicit', kink: 'explicit', nolimits: 'intense', purity: 'intense' };
    db.packs.forEach(p => { const want = p.adult ? (p.heat || HEAT[p.id] || 'spicy') : ''; if ((p.heat || '') !== want) { p.heat = want; changed = true; } });
    const def = db.admins.find(a => a.email === 'admin@spil.party');
    if (def) { def.email = 'wisdomska@gmail.com'; def.name = 'Wisdom Senya'; def.role = 'Owner'; changed = true; }
    if (!db.admins.every(a => a.id)) { db.admins.forEach(a => { a.id = a.id || uid(); }); changed = true; }
    return changed;
  };
  const seed = () => {
    const t = now();
    const packs = [
      { id: 'classic', name: 'Classic', blurb: 'The starter pack. Mild to medium.', icon: 'ph ph-cards', tone: 'accent', adult: false, status: 'live', updated: t },
      { id: 'afterdark', name: 'After Dark', blurb: 'For grown folks. Spicy, never cruel.', icon: 'ph ph-moon-stars', tone: 'inverse', adult: true, heat: 'spicy', status: 'live', updated: t },
      { id: 'campus', name: 'Campus Life', blurb: 'Hostel nights and borrowed notes.', icon: 'ph ph-student', tone: 'raised', adult: false, status: 'live', updated: t },
      { id: 'work', name: '9 to 5', blurb: 'Reply-all disasters and fake sick days.', icon: 'ph ph-briefcase', tone: 'accent', adult: false, status: 'live', updated: t }
    ];
    const questions = [];
    Object.entries(Q).forEach(([pack, list]) => list.forEach(text => questions.push({ id: uid(), pack, text, status: 'live', yes: 0, answered: 0, updated: t })));
    return {
      v: 1, packs, questions, reports: [], messages: [], rooms: {},
      audit: [{ at: t, who: 'System', action: 'Seeded content', target: '4 packs, 48 questions' }],
      settings: { questionsPerGame: 12, maxPlayers: 12, minPlayers: 3 },
      admins: [{ email: 'wisdomska@gmail.com', password: 'spil-admin', name: 'Wisdom Senya', role: 'Owner' }],
      plays: {}, games: { started: 0, finished: 0 }, joins: []
    };
  };
  let cache = null;
  const read = () => {
    if (cache) return cache;
    try { cache = JSON.parse(localStorage.getItem(KEY)); } catch (e) { cache = null; }
    if (!cache || cache.v !== 1) { cache = seed(); write(cache); }
    if (migrate(cache)) write(cache);
    return cache;
  };
  const write = db => { cache = db; try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };
  const emit = () => subs.forEach(f => { try { f(cache); } catch (e) { console.error(e); } });
  const refresh = () => { cache = null; read(); emit(); };
  ch && (ch.onmessage = refresh);
  window.addEventListener('storage', e => { if (e.key === KEY) refresh(); });

  const S = {
    uid, get: read,
    on(f) { subs.add(f); return () => subs.delete(f); },
    update(fn) { const db = JSON.parse(JSON.stringify(read())); const r = fn(db); write(db); emit(); ch && ch.postMessage(1); return r; },
    reset() { const db = seed(); migrate(db); write(db); emit(); ch && ch.postMessage(1); },
    log(db, who, action, target) { db.audit.unshift({ at: now(), who, action, target }); db.audit = db.audit.slice(0, 300); },
    newCode(db) { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c; do { c = Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join(''); } while (db.rooms[c]); return c; },
    livePacks(db) { return db.packs.filter(p => p.status === 'live' && db.questions.some(q => q.pack === p.id && q.status === 'live')); },
    countFor(db, pack) { return db.questions.filter(q => q.pack === pack && q.status === 'live').length; },
    pickQs(db, pack, n) {
      const pool = db.questions.filter(q => q.pack === pack && q.status === 'live').map(q => q.id);
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      return pool.slice(0, n > 0 ? n : db.settings.questionsPerGame);
    },
    active(room) { return room.order.map(id => room.players[id]).filter(p => p && !p.kicked); },
    answeredN(room, p) { return room.qids.filter(q => q in (p.answers || {})).length; },
    answersDone(room, p) { return S.answeredN(room, p) >= room.qids.length; },
    guessesDone(room, p) { return S.active(room).every(o => o.id === p.id || (p.guesses || {})[o.id] != null); },
    score(room, p) { const a = room.qids.map(q => (p.answers || {})[q]).filter(v => v === true || v === false); return a.length ? Math.round(a.filter(Boolean).length / a.length * 100) : 0; },
    joinCheck(db, code) {
      const r = db.rooms[code];
      if (!r) return 'invalid';
      if (r.status === 'closed' || now() - r.created > 86400000) return 'expired';
      if (r.status !== 'lobby') return 'started';
      if (S.active(r).length >= db.settings.maxPlayers) return 'full';
      return '';
    },
    results(db, room) {
      const ps = S.active(room);
      const rows = ps.map(p => {
        const score = S.score(room, p);
        const gs = ps.filter(o => o.id !== p.id).map(o => (o.guesses || {})[p.id]).filter(v => v != null);
        const guess = gs.length ? Math.round(gs.reduce((a, b) => a + b, 0) / gs.length) : score;
        return { id: p.id, name: p.name, av: p.av, bot: !!p.bot, spill: !!p.spill, score, guess };
      });
      rows.forEach(r => { const me = room.players[r.id]; r.mr = rows.filter(o => o.id !== r.id).reduce((a, o) => { const g = (me.guesses || {})[o.id]; return a + (g == null ? 0 : Math.max(0, 50 - Math.abs(g - o.score))); }, 0); });
      const by = (f, dir) => [...rows].sort((a, b) => dir * (f(a) - f(b)))[0];
      const top = by(r => r.score, -1), saint = by(r => r.score, 1), mind = by(r => r.mr, -1), dark = by(r => r.score - r.guess, -1), open = by(r => Math.abs(r.score - r.guess), 1), clue = by(r => r.mr, 1);
      const awards = rows.length ? [
        { name: 'Top Spiller', icon: 'ph ph-drop', tone: 'accent', shape: '50%', who: top.id, why: `Highest score in the room. ${top.score} out of 100.` },
        { name: 'Saint of the Room', icon: 'ph ph-hands-praying', tone: 'inverse', shape: '40px', who: saint.id, why: `Scored ${saint.score}. Either a saint or a very good liar.` },
        { name: 'Mind Reader', icon: 'ph ph-eye', tone: 'raised', shape: '50%', who: mind.id, why: `Closest guesses in the room. ${mind.mr} points.` },
        { name: 'Dark Horse', icon: 'ph ph-horse', tone: 'inverse', shape: '50%', who: dark.id, why: `The room guessed ${dark.guess}. ${dark.name} scored ${dark.score}.` },
        { name: 'Open Book', icon: 'ph ph-book-open', tone: 'accent', shape: '40px', who: open.id, why: `The room guessed ${open.guess}. ${open.name} scored ${open.score}. Close enough.` },
        { name: 'Clueless', icon: 'ph ph-question', tone: 'raised', shape: '50%', who: clue.id, why: `Furthest guesses in the room. ${clue.name}, really?` }
      ] : [];
      const qstats = room.qids.map(id => {
        const q = db.questions.find(x => x.id === id);
        const ans = ps.map(p => ({ p, v: (p.answers || {})[id] })).filter(a => a.v === true || a.v === false);
        const yes = ans.filter(a => a.v);
        return { id, text: q ? q.text : 'Removed question', yes: yes.length, n: ans.length, spill: yes.filter(a => a.p.spill).map(a => a.p.name) };
      }).sort((a, b) => (b.n ? b.yes / b.n : 0) - (a.n ? a.yes / a.n : 0));
      return { rows, awards, qstats };
    },
    finalize(db, room) {
      if (room.final === room.round) return;
      room.final = room.round;
      const ps = S.active(room);
      room.qids.forEach(id => { const q = db.questions.find(x => x.id === id); if (!q) return; ps.forEach(p => { const v = (p.answers || {})[id]; if (v === true || v === false) { q.answered++; if (v) q.yes++; } }); });
      db.games.finished++;
    },
    tick(code) {
      const BOT_YES = [.15, .35, .5, .65, .85];
      S.update(db => {
        const r = db.rooms[code]; if (!r) return;
        const ps = S.active(r);
        if (r.status === 'answering') {
          ps.filter(p => p.bot).forEach(p => {
            if (Math.random() < .55) { const q = r.qids.find(id => !(id in p.answers)); if (q) p.answers[q] = Math.random() < BOT_YES[p.av % 5]; }
          });
          if (ps.every(p => S.answersDone(r, p))) r.status = 'guessing';
        } else if (r.status === 'guessing') {
          ps.filter(p => p.bot && !S.guessesDone(r, p) && Math.random() < .35).forEach(p => {
            ps.forEach(o => { if (o.id !== p.id) p.guesses[o.id] = Math.max(0, Math.min(100, S.score(r, o) + Math.round((Math.random() - .5) * 50))); });
          });
          if (ps.every(p => S.guessesDone(r, p))) r.status = 'ready';
        }
        r.updated = now();
      });
    }
  };
  window.SpilStore = S;
})();
