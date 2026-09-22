"use client";

import { useState, useCallback } from "react";

type RateRow = {
  fieldRefCents: number;
  scorerCents: number;
  fieldRefSeniorCents: number;
  scorerSeniorCents: number;
  orgBsb: string | null;
  orgAccount: string | null;
  orgName: string | null;
  orgBank: string | null;
  orgApcaId: string | null;
};

type Summary = {
  refereeId: string;
  name: string;
  email: string;
  bsb: string | null;
  accountNumber: string | null;
  accountName: string | null;
  fieldRefGames: number;
  scorerGames: number;
  seniorGames: number;
  juniorGames: number;
  totalCents: number;
  hasBankDetails: boolean;
};

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function mondayStr() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export default function PayrollClient({ initialRate }: { initialRate: RateRow | null }) {
  const [rate, setRate] = useState<RateRow>(initialRate ?? {
    fieldRefCents: 5000,
    scorerCents: 2500,
    fieldRefSeniorCents: 5000,
    scorerSeniorCents: 2500,
    orgBsb: "",
    orgAccount: "",
    orgName: "Wagga Futsal",
    orgBank: "WBC",
    orgApcaId: "",
  });

  const [from, setFrom] = useState(mondayStr());
  const [to, setTo] = useState(todayStr());
  const [summary, setSummary] = useState<Summary[] | null>(null);
  const [fixtureCount, setFixtureCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [savingRate, setSavingRate] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const [fieldRefDollars, setFieldRefDollars] = useState(
    String((initialRate?.fieldRefCents ?? 5000) / 100)
  );
  const [scorerDollars, setScorerDollars] = useState(
    String((initialRate?.scorerCents ?? 2500) / 100)
  );
  const [fieldRefSrDollars, setFieldRefSrDollars] = useState(
    String((initialRate?.fieldRefSeniorCents ?? 5000) / 100)
  );
  const [scorerSrDollars, setScorerSrDollars] = useState(
    String((initialRate?.scorerSeniorCents ?? 2500) / 100)
  );

  const saveRate = async () => {
    setSavingRate(true);
    const res = await fetch("/api/admin/payroll", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fieldRefCents: Math.round(parseFloat(fieldRefDollars) * 100),
        scorerCents: Math.round(parseFloat(scorerDollars) * 100),
        fieldRefSeniorCents: Math.round(parseFloat(fieldRefSrDollars) * 100),
        scorerSeniorCents: Math.round(parseFloat(scorerSrDollars) * 100),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setRate((r) => ({ ...r, ...data }));
    }
    setSavingRate(false);
  };

  const preview = useCallback(async () => {
    setLoading(true);
    setError("");
    setSummary(null);
    const res = await fetch(`/api/admin/payroll?from=${from}&to=${to}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Failed"); return; }
    setSummary(data.summary);
    setFixtureCount(data.fixtureCount);
    if (data.rate) {
      setRate((r) => ({ ...r, ...data.rate }));
      setFieldRefDollars(String((data.rate.fieldRefCents ?? rate.fieldRefCents) / 100));
      setScorerDollars(String((data.rate.scorerCents ?? rate.scorerCents) / 100));
      setFieldRefSrDollars(String((data.rate.fieldRefSeniorCents ?? rate.fieldRefSeniorCents) / 100));
      setScorerSrDollars(String((data.rate.scorerSeniorCents ?? rate.scorerSeniorCents) / 100));
    }
  }, [from, to, rate.fieldRefCents, rate.scorerCents, rate.fieldRefSeniorCents, rate.scorerSeniorCents]);

  const downloadABA = async () => {
    if (!rate.orgBsb || !rate.orgAccount || !rate.orgName || !rate.orgBank || !rate.orgApcaId) {
      setError("Fill in all organisation bank details before downloading.");
      return;
    }
    setDownloading(true);
    setError("");
    const res = await fetch("/api/admin/payroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from, to,
        orgBsb: rate.orgBsb,
        orgAccount: rate.orgAccount,
        orgName: rate.orgName,
        orgBank: rate.orgBank,
        orgApcaId: rate.orgApcaId,
      }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to generate ABA");
      setDownloading(false);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `referee-pay-${from}-to-${to}.aba`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloading(false);
  };

  const missingBank = summary?.filter((r) => r.totalCents > 0 && !r.hasBankDetails) ?? [];
  const payable = summary?.filter((r) => r.hasBankDetails) ?? [];
  const totalPayable = payable.reduce((s, r) => s + r.totalCents, 0);

  return (
    <div className="space-y-8">

      {/* Rate Card */}
      <div className="bg-white border border-border rounded-xl p-6">
        <h2 className="text-lg font-black text-navy mb-1">Rate Card</h2>
        <p className="text-xs text-muted mb-4">
          Two tiers: junior games (U10–U14) and senior games (U16 &amp; Opens).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="border border-border rounded-lg p-4">
            <p className="text-xs font-bold text-navy uppercase tracking-wide mb-3">Junior games · U10–U14</p>
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Field Referee</label>
                <div className="flex items-center gap-2">
                  <span className="text-navy font-semibold">$</span>
                  <input
                    type="number" min="0" step="0.50"
                    value={fieldRefDollars}
                    onChange={(e) => setFieldRefDollars(e.target.value)}
                    className="border border-border rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Scorer</label>
                <div className="flex items-center gap-2">
                  <span className="text-navy font-semibold">$</span>
                  <input
                    type="number" min="0" step="0.50"
                    value={scorerDollars}
                    onChange={(e) => setScorerDollars(e.target.value)}
                    className="border border-border rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="border border-border rounded-lg p-4">
            <p className="text-xs font-bold text-navy uppercase tracking-wide mb-3">Senior games · U16 &amp; Opens</p>
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Field Referee</label>
                <div className="flex items-center gap-2">
                  <span className="text-navy font-semibold">$</span>
                  <input
                    type="number" min="0" step="0.50"
                    value={fieldRefSrDollars}
                    onChange={(e) => setFieldRefSrDollars(e.target.value)}
                    className="border border-border rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Scorer</label>
                <div className="flex items-center gap-2">
                  <span className="text-navy font-semibold">$</span>
                  <input
                    type="number" min="0" step="0.50"
                    value={scorerSrDollars}
                    onChange={(e) => setScorerSrDollars(e.target.value)}
                    className="border border-border rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={saveRate}
          disabled={savingRate}
          className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark disabled:opacity-60"
        >
          {savingRate ? "Saving…" : "Save Rates"}
        </button>
      </div>

      {/* Organisation Bank Details */}
      <div className="bg-white border border-border rounded-xl p-6">
        <h2 className="text-lg font-black text-navy mb-1">Organisation Bank Details</h2>
        <p className="text-xs text-muted mb-4">Your Wagga Futsal account — the account payments are sent from.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Account Name</label>
            <input
              value={rate.orgName ?? ""}
              onChange={(e) => setRate((r) => ({ ...r, orgName: e.target.value }))}
              placeholder="Wagga Futsal Pty Ltd"
              className="border border-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">BSB</label>
            <input
              value={rate.orgBsb ?? ""}
              onChange={(e) => setRate((r) => ({ ...r, orgBsb: e.target.value }))}
              placeholder="032-769"
              className="border border-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Account Number</label>
            <input
              value={rate.orgAccount ?? ""}
              onChange={(e) => setRate((r) => ({ ...r, orgAccount: e.target.value }))}
              placeholder="123456789"
              className="border border-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Bank Mnemonic</label>
            <select
              value={rate.orgBank ?? "WBC"}
              onChange={(e) => setRate((r) => ({ ...r, orgBank: e.target.value }))}
              className="border border-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="WBC">WBC — Westpac</option>
              <option value="CBA">CBA — Commonwealth</option>
              <option value="ANZ">ANZ — ANZ Bank</option>
              <option value="NAB">NAB — NAB</option>
              <option value="BQL">BQL — Bank of Queensland</option>
              <option value="SUN">SUN — Suncorp</option>
              <option value="BEN">BEN — Bendigo Bank</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">APCA User ID</label>
            <input
              value={rate.orgApcaId ?? ""}
              onChange={(e) => setRate((r) => ({ ...r, orgApcaId: e.target.value }))}
              placeholder="000001"
              maxLength={6}
              className="border border-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <p className="text-xs text-muted mt-1">6-digit ID from your bank. Use 000001 if unsure.</p>
          </div>
        </div>
      </div>

      {/* Period + Preview */}
      <div className="bg-white border border-border rounded-xl p-6">
        <h2 className="text-lg font-black text-navy mb-4">Generate Payment Run</h2>
        <div className="flex flex-wrap gap-4 items-end mb-4">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">From</label>
            <input
              type="date" value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">To</label>
            <input
              type="date" value={to}
              onChange={(e) => setTo(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <button
            onClick={preview}
            disabled={loading}
            className="bg-navy text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-navy/90 disabled:opacity-60"
          >
            {loading ? "Loading…" : "Preview"}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {summary !== null && (
          <>
            <p className="text-xs text-muted mb-3">{fixtureCount} completed fixture{fixtureCount !== 1 ? "s" : ""} in period</p>

            {summary.length === 0 ? (
              <p className="text-muted text-sm">No referees with completed games in this period.</p>
            ) : (
              <>
                <div className="border border-border rounded-xl overflow-hidden mb-4">
                  <table className="w-full text-sm">
                    <thead className="bg-navy text-white">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-semibold">Referee</th>
                        <th className="px-3 py-2.5 text-center font-semibold">Field Ref</th>
                        <th className="px-3 py-2.5 text-center font-semibold">Scorer</th>
                        <th className="px-3 py-2.5 text-center font-semibold">Sr / Jr</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
                        <th className="px-3 py-2.5 text-left font-semibold">Bank</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {summary.map((r) => (
                        <tr key={r.refereeId} className={!r.hasBankDetails ? "bg-yellow-50" : ""}>
                          <td className="px-4 py-2.5">
                            <p className="font-semibold text-navy">{r.name}</p>
                            <p className="text-xs text-muted">{r.email}</p>
                          </td>
                          <td className="px-3 py-2.5 text-center text-muted">{r.fieldRefGames || "—"}</td>
                          <td className="px-3 py-2.5 text-center text-muted">{r.scorerGames || "—"}</td>
                          <td className="px-3 py-2.5 text-center text-muted text-xs">{r.seniorGames} / {r.juniorGames}</td>
                          <td className="px-3 py-2.5 text-right font-black text-brand">{fmt(r.totalCents)}</td>
                          <td className="px-3 py-2.5">
                            {r.hasBankDetails ? (
                              <span className="text-xs text-muted">
                                {r.bsb} · {r.accountNumber}
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-yellow-700">⚠ Missing — go to Referees</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-border bg-gray-50">
                      <tr>
                        <td colSpan={4} className="px-4 py-2.5 text-sm font-semibold text-navy">
                          Total payable ({payable.length} referee{payable.length !== 1 ? "s" : ""})
                        </td>
                        <td className="px-3 py-2.5 text-right font-black text-navy text-base">
                          {fmt(totalPayable)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {missingBank.length > 0 && (
                  <p className="text-xs text-yellow-700 mb-4">
                    ⚠ {missingBank.length} referee{missingBank.length !== 1 ? "s" : ""} ({missingBank.map((r) => r.name).join(", ")}) will be excluded from the ABA file — add their bank details in the Referees section first.
                  </p>
                )}

                <button
                  onClick={downloadABA}
                  disabled={downloading || payable.length === 0}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {downloading ? "Generating…" : `Download ABA — ${fmt(totalPayable)}`}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
