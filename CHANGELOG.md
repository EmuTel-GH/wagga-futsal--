# Changelog

One entry per merged PR, newest first. Plain English, written so it can be
passed on to the club. Versions are the short git commit shown in the site footer.

## 2026-10-11
- **Tidy-ups**: the bank payment (ABA) file's header is laid out to the
  banking standard and names are cleaned to characters banks accept; calendar
  feeds handle punctuation properly; standard browser security protections
  are on; online session booking stays switched off until Stripe is set up;
  administrators change their own password from My account; bank details
  are tied to the referee they belong to.
- **Scoring is limited to each game's officials**: only the referee or scorer
  assigned to a game (or an administrator) can record its score and events,
  and finished games can only be changed by an administrator.
- **Less personal information on match pages**: live match pages and the
  scoring console now load only what they show (team names, scores, events,
  players' names and shirt numbers), not team contact details or players'
  dates of birth.
- **Security updates**: the web framework and its image tools updated to the
  latest secure versions; two unused components removed.
- **Safer account set-up**: new accounts and password resets now use a
  one-time set-up link that an administrator creates on the Users page and
  sends to the person (valid 7 days, works once). Referees still waiting to
  set a password need a link from an administrator.
- **Payroll permission**: pay rates, the ABA pay file and referees' bank
  details now need a new "Manage payroll" permission. Administrators who
  already manage users have it; give it to others from the Users page.
  Pay rates must be whole-cent amounts between $0 and $1,000. Every bank
  detail change is recorded in the audit log.
- **Tighter admin checks**: every admin page checks sign-in itself; referee
  logins can only be created or removed by administrators who manage users,
  and referees with games are kept (deactivated) rather than deleted;
  sign-in sessions use stronger random keys; fixture screens no longer load
  referees' private details.
- **Team nominations**: the online form checks every field properly, and a
  nominated team only appears on the website once it's approved.

## 2026-10-10
- Developer notes: the staging gate is the only lock on the test site, so it must stay in every version (PR #13).
- **Staging site locked to administrators** (PR #11): the test site needs an
  administrator sign-in for every page, and search engines are told not to
  index it. The real site is unchanged.
- **Safer releases** (PR #10): changes now go to a staging site first and
  reach the real site automatically when approved, with automatic database
  backups, upgrades and rollback. The site footer shows which version is live.
- **Referees' bank details are encrypted** (PR #9): stored encrypted and only
  ever shown partly hidden (e.g. ••••5678); full details are used only to make
  the bank payment file.
- **Draw requests** (PR #8): fix a particular match to a week, or choose which
  week a team has its bye; the draw re-arranges whole rounds around them.

## 2026-10-09
- **Team calendars** (PR #7): save your teams and add their games (and bye
  weeks) to your phone's calendar; it updates itself if the draw changes.
  "All my fixtures" shows every saved team in one list.
- **Shirt numbers, byes, grand finals** (PR #6): shirt number boxes in each
  team list; each round shows who has the bye; the grand final is created
  automatically once both semi-finals are decided; registration status is read
  correctly from the PlayFootball export.
- **Draw options and team admin** (PR #5): choose how many times teams play
  each other, an end date, or "keep playing until"; split a competition into
  divisions part-way; move a team to another division, rename teams, delete
  teams properly; coaches can coach several teams; unpaid or awaiting-approval
  registrations are flagged.

## 2026-10-07
- **Draft draws, breaks and holidays** (PR #4): new draws stay hidden until
  you publish them; add holidays and breaks and the draw skips them; the admin
  menu stays in place and highlights where you are.
- **Authorise all / Reject all** (PR #3) for ineligible nominated players.
- **Users, permissions and audit log** (PR #2): administrator accounts with
  permissions, a full activity log, and approving players outside their age
  group with a recorded reason.
- **Moved to EmuTel hosting** (PR #1).
