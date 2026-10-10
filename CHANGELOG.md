# Changelog

One entry per merged PR, newest first. Plain English, written so it can be
passed on to the club. Versions are the short git commit shown in the site footer.

## 2026-10-11
- **Scoring is limited to each game's officials**: only the referee or scorer
  assigned to a game (or an administrator) can record its score and events,
  and finished games can only be changed by an administrator.
- **Less personal information on match pages**: live match pages and the
  scoring console now load only what they show (team names, scores, events,
  players' names and shirt numbers), not team contact details or players'
  dates of birth.
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
