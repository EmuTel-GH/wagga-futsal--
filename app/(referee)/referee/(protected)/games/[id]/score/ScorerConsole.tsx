"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Player = { id: string; jerseyNumber: number | null; player: { id: string; firstName: string; lastName: string } };
type Team = { id: string; name: string; players: Player[] };
type Event = { id: string; type: string; minute: number; half: number; playerName: string | null; jerseyNumber: number | null; team: { name: string } };

type Fixture = {
  id: string;
  homeScore: number;
  awayScore: number;
  homeFoulsH1: number;
  awayFoulsH1: number;
  homeFoulsH2: number;
  awayFoulsH2: number;
  status: string;
  homeTeam: Team;
  awayTeam: Team;
  competition: { name: string };
  events: Event[];
};

const EVENT_ICONS: Record<string, string> = {
  GOAL: "⚽",
  YELLOW_CARD: "🟨",
  RED_CARD: "🟥",
  FOUL: "🚫",
};

const EVENT_TYPES = [
  { type: "GOAL", label: "Goal", icon: "⚽", color: "bg-green-500" },
  { type: "YELLOW_CARD", label: "Yellow Card", icon: "🟨", color: "bg-yellow-400" },
  { type: "RED_CARD", label: "Red Card", icon: "🟥", color: "bg-red-500" },
  { type: "FOUL", label: "Foul", icon: "🚫", color: "bg-orange-400" },
];

export default function ScorerConsole({ fixture: initial }: { fixture: Fixture }) {
  const router = useRouter();
  const [fixture, setFixture] = useState(initial);
  const [half, setHalf] = useState(1);
  const [minute, setMinute] = useState(1);
  const [selectedTeam, setSelectedTeam] = useState<"home" | "away">("home");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [endingGame, setEndingGame] = useState(false);

  const team = selectedTeam === "home" ? fixture.homeTeam : fixture.awayTeam;

  const submitEvent = async (type: string) => {
    if (submitting) return;
    setSubmitting(true);

    const res = await fetch(`/api/fixtures/${fixture.id}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId: team.id,
        type,
        minute,
        half,
        playerName: selectedPlayer
          ? `${selectedPlayer.player.firstName} ${selectedPlayer.player.lastName}`
          : null,
        jerseyNumber: selectedPlayer?.jerseyNumber ?? null,
        playerId: selectedPlayer?.player.id ?? null,
      }),
    });

    if (res.ok) {
      const updated = await fetch(`/api/fixtures/${fixture.id}`);
      if (updated.ok) setFixture(await updated.json());
      setLastEvent(`${EVENT_ICONS[type]} ${type.replace("_", " ")} recorded`);
      setSelectedPlayer(null);
      if (type === "GOAL" || type === "FOUL") setMinute((m) => m + 1);
    }

    setSubmitting(false);
  };

  const endGame = async () => {
    if (!confirm("End this game and mark it as completed?")) return;
    setEndingGame(true);
    await fetch(`/api/fixtures/${fixture.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    router.push("/referee/games");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/referee/games" className="text-sm text-muted">← Back</Link>
        <span className="text-xs text-muted">{fixture.competition.name}</span>
      </div>

      {/* Scoreboard */}
      <div className="bg-navy text-white rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 text-center">
            <p className="font-black text-lg">{fixture.homeTeam.name}</p>
            <p className="text-5xl font-black text-brand mt-1">{fixture.homeScore}</p>
            <p className="text-xs text-white/40 mt-1">Fouls H1:{fixture.homeFoulsH1} H2:{fixture.homeFoulsH2}</p>
          </div>
          <div className="text-white/30 font-black text-2xl">–</div>
          <div className="flex-1 text-center">
            <p className="font-black text-lg">{fixture.awayTeam.name}</p>
            <p className="text-5xl font-black text-brand mt-1">{fixture.awayScore}</p>
            <p className="text-xs text-white/40 mt-1">Fouls H1:{fixture.awayFoulsH1} H2:{fixture.awayFoulsH2}</p>
          </div>
        </div>
      </div>

      {lastEvent && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2 rounded-lg text-center font-semibold">
          {lastEvent}
        </div>
      )}

      {/* Half & Minute */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted uppercase mb-1 block">Half</label>
          <div className="flex rounded-lg overflow-hidden border border-border">
            {[1, 2].map((h) => (
              <button
                key={h}
                onClick={() => setHalf(h)}
                className={`flex-1 py-2 text-sm font-bold transition-colors ${
                  half === h ? "bg-navy text-white" : "bg-white text-navy"
                }`}
              >
                H{h}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted uppercase mb-1 block">Minute</label>
          <input
            type="number"
            min={1}
            max={45}
            value={minute}
            onChange={(e) => setMinute(Number(e.target.value))}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm font-bold text-center"
          />
        </div>
      </div>

      {/* Team selector */}
      <div>
        <label className="text-xs font-semibold text-muted uppercase mb-1 block">Team</label>
        <div className="flex rounded-lg overflow-hidden border border-border">
          {(["home", "away"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setSelectedTeam(t); setSelectedPlayer(null); }}
              className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
                selectedTeam === t ? "bg-brand text-white" : "bg-white text-navy"
              }`}
            >
              {t === "home" ? fixture.homeTeam.name : fixture.awayTeam.name}
            </button>
          ))}
        </div>
      </div>

      {/* Player selector */}
      <div>
        <label className="text-xs font-semibold text-muted uppercase mb-1 block">
          Player (optional)
        </label>
        <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
          {team.players
            .sort((a, b) => (a.jerseyNumber ?? 99) - (b.jerseyNumber ?? 99))
            .map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPlayer(selectedPlayer?.id === p.id ? null : p)}
                className={`text-xs py-2 px-1 rounded-lg border font-semibold transition-colors ${
                  selectedPlayer?.id === p.id
                    ? "bg-brand text-white border-brand"
                    : "bg-white text-navy border-border"
                }`}
              >
                {p.jerseyNumber ? `#${p.jerseyNumber} ` : ""}
                {p.player.firstName} {p.player.lastName[0]}.
              </button>
            ))}
        </div>
      </div>

      {/* Event buttons */}
      <div>
        <label className="text-xs font-semibold text-muted uppercase mb-1 block">Record Event</label>
        <div className="grid grid-cols-2 gap-3">
          {EVENT_TYPES.map((e) => (
            <button
              key={e.type}
              onClick={() => submitEvent(e.type)}
              disabled={submitting}
              className={`${e.color} text-white font-bold py-4 rounded-xl text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60`}
            >
              <span>{e.icon}</span>
              <span className="text-sm">{e.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent events */}
      {fixture.events.length > 0 && (
        <div>
          <label className="text-xs font-semibold text-muted uppercase mb-1 block">Recent Events</label>
          <div className="space-y-1.5">
            {fixture.events.slice(0, 6).map((e) => (
              <div key={e.id} className="flex items-center gap-2 text-sm bg-white border border-border rounded-lg px-3 py-2">
                <span>{EVENT_ICONS[e.type]}</span>
                <span className="font-semibold text-navy">{e.playerName ?? "—"}</span>
                <span className="text-muted text-xs">{e.team.name}</span>
                <span className="ml-auto text-muted text-xs">{e.minute}&apos; H{e.half}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* End game */}
      <button
        onClick={endGame}
        disabled={endingGame}
        className="w-full border-2 border-navy text-navy font-bold py-3 rounded-xl hover:bg-navy hover:text-white transition-colors mt-4"
      >
        End Game (Full Time)
      </button>
    </div>
  );
}
