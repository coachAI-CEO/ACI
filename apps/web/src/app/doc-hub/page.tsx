"use client";

const summaryStats = [
  { label: "Coaches Managed", value: "20", detail: "2 inactive this week" },
  { label: "Weekly AI Sessions", value: "146", detail: "+18% vs last week" },
  { label: "Topics Created", value: "38", detail: "12 active threads" },
  { label: "Active Coaches", value: "18/20", detail: "90% adoption" },
];

const coachUsage = [
  { coach: "Coach A", role: "U10 Lead", runs: 22, lastActive: "Today, 9:42 AM", status: "heavy" },
  { coach: "Coach B", role: "U12 Lead", runs: 19, lastActive: "Today, 8:10 AM", status: "heavy" },
  { coach: "Coach C", role: "U14 Lead", runs: 14, lastActive: "Yesterday", status: "active" },
  { coach: "Coach D", role: "U11 Assistant", runs: 2, lastActive: "4 days ago", status: "low" },
  { coach: "Coach E", role: "U16 Lead", runs: 0, lastActive: "No activity", status: "inactive" },
  { coach: "Coach F", role: "GK Coach", runs: 0, lastActive: "No activity", status: "inactive" },
];

const topicBoard = [
  { topic: "Defensive Transition Press", owner: "Coach A", participants: 7, updates: 16, lastUpdate: "2h ago" },
  { topic: "U10 Build-Out Shape", owner: "Coach B", participants: 9, updates: 21, lastUpdate: "4h ago" },
  { topic: "Set-Piece Organization", owner: "Coach C", participants: 5, updates: 8, lastUpdate: "Yesterday" },
  { topic: "Player Decision Speed", owner: "Coach D", participants: 6, updates: 11, lastUpdate: "Yesterday" },
];

const alerts = [
  "2 coaches have not opened Session Builder this week.",
  "Video Analysis usage up 31% among U10-U12 staff.",
  "Most discussed topic: U10 Build-Out Shape.",
];

const aiAgentFindings = [
  {
    coach: "Coach D",
    issue: "No practices scheduled",
    severity: "high",
    details: "No sessions assigned for the next 10 days.",
    recommendation: "Auto-populate 2 foundational sessions and notify coach.",
  },
  {
    coach: "Coach E",
    issue: "No calendar activity",
    severity: "high",
    details: "No additions or edits in weekly calendar this month.",
    recommendation: "Trigger DOC check-in and assign minimum weekly plan.",
  },
  {
    coach: "Coach B",
    issue: "Repetitive topic trend",
    severity: "medium",
    details: "7 of last 9 sessions focus on pressing triggers.",
    recommendation: "Balance with build-up and transition modules.",
  },
  {
    coach: "Coach A",
    issue: "Low variation in age focus",
    severity: "low",
    details: "U10 content repeated with minimal tactical progression.",
    recommendation: "Inject one progression layer this week.",
  },
];

const coachCalendar = [
  {
    day: "Mon",
    coachA: { title: "Build Out Under Pressure", code: "S-E5RW", time: "5:30p" },
    coachB: { title: "Pressing Triggers", code: "S-K2FM", time: "6:15p" },
    coachC: null,
  },
  {
    day: "Tue",
    coachA: null,
    coachB: { title: "Defensive Compactness", code: "S-Q7LD", time: "5:00p" },
    coachC: { title: "Transition to Attack", code: "S-T4PA", time: "6:00p" },
  },
  {
    day: "Wed",
    coachA: { title: "Finishing From Wide", code: "S-V9NC", time: "5:45p" },
    coachB: null,
    coachC: { title: "Set Piece Roles", code: "S-D3XZ", time: "6:10p" },
  },
  {
    day: "Thu",
    coachA: null,
    coachB: { title: "Possession Rondo Layers", code: "S-M8JT", time: "5:20p" },
    coachC: null,
  },
  {
    day: "Fri",
    coachA: { title: "Pre Match Structure", code: "S-L1QB", time: "5:30p" },
    coachB: null,
    coachC: { title: "Match Prep Principles", code: "S-N6WR", time: "6:00p" },
  },
];

function statusPill(status: string) {
  if (status === "heavy") return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
  if (status === "active") return "bg-cyan-500/15 text-cyan-300 border-cyan-400/30";
  if (status === "low") return "bg-amber-500/15 text-amber-300 border-amber-400/30";
  return "bg-rose-500/15 text-rose-300 border-rose-400/30";
}

function severityPill(severity: string) {
  if (severity === "high") return "bg-rose-500/15 text-rose-300 border-rose-400/30";
  if (severity === "medium") return "bg-amber-500/15 text-amber-300 border-amber-400/30";
  return "bg-cyan-500/15 text-cyan-300 border-cyan-400/30";
}

export default function DocHubPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#060a13] text-slate-50">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-cyan-600/[0.08] blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-[420px] w-[420px] rounded-full bg-blue-600/[0.06] blur-[120px]" />
      </div>

      <div className="relative mx-auto w-full max-w-7xl p-4 md:p-6">
        <section className="rounded-2xl border border-cyan-500/[0.12] bg-gradient-to-b from-[#08131a]/85 to-[#090f1a]/70 shadow-[0_0_30px_-12px_rgba(6,182,212,0.12)]">
          <div className="border-b border-cyan-500/[0.08] bg-gradient-to-r from-cyan-950/25 to-transparent px-5 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-base font-semibold text-white/90">DOC Hub</h1>
              <span className="rounded-full border border-cyan-400/35 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-cyan-300">
                Beta
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Mockup view for Director of Coaching oversight, coach adoption, and tactical discussion flow.</p>
          </div>

          <div className="grid gap-3 border-b border-cyan-500/[0.08] p-5 md:grid-cols-2 xl:grid-cols-4">
            {summaryStats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-cyan-500/20 bg-[#071121]/70 p-4">
                <div className="text-[11px] uppercase tracking-wide text-slate-400">{stat.label}</div>
                <div className="mt-1 text-2xl font-semibold text-white">{stat.value}</div>
                <div className="mt-1 text-xs text-slate-400">{stat.detail}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 p-5 xl:grid-cols-[1.2fr_1fr]">
            <section className="rounded-xl border border-cyan-500/20 bg-[#071121]/65 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-cyan-200">Coach Usage Snapshot</h2>
                <span className="text-xs text-slate-400">Heavy users and adoption gaps</span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="text-slate-400">
                    <tr className="border-b border-slate-800">
                      <th className="py-2 pr-3 font-medium">Coach</th>
                      <th className="py-2 pr-3 font-medium">Role</th>
                      <th className="py-2 pr-3 font-medium">Runs (7d)</th>
                      <th className="py-2 pr-3 font-medium">Last Active</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coachUsage.map((row) => (
                      <tr key={row.coach} className="border-b border-slate-900/80">
                        <td className="py-2 pr-3 text-slate-200">{row.coach}</td>
                        <td className="py-2 pr-3 text-slate-300">{row.role}</td>
                        <td className="py-2 pr-3 text-slate-200">{row.runs}</td>
                        <td className="py-2 pr-3 text-slate-400">{row.lastActive}</td>
                        <td className="py-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${statusPill(row.status)}`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-cyan-500/20 bg-[#071121]/65 p-4">
              <h2 className="text-sm font-semibold text-cyan-200">Director Alerts</h2>
              <ul className="mt-3 space-y-2 text-xs text-slate-300">
                {alerts.map((a) => (
                  <li key={a} className="rounded-lg border border-cyan-500/20 bg-[#0a1628]/70 px-3 py-2">
                    {a}
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-lg border border-slate-700/80 bg-[#081221] p-3">
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Broadcast to Coaches</div>
                <p className="mt-2 text-xs text-slate-300">"Prioritize build-out support angles this week. Share one clip in DOC Hub by Friday."</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-1.5 text-xs text-cyan-200">
                    Schedule Message
                  </button>
                  <button className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-200">
                    Send Now
                  </button>
                </div>
              </div>
            </section>
          </div>

          <div className="border-t border-cyan-500/[0.08] p-5">
            <section className="rounded-xl border border-cyan-500/20 bg-[#071121]/65 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-cyan-200">Game Model Direction</h2>
                <span className="text-[11px] text-slate-400">Club skeleton across 4 stages</span>
              </div>
              <div className="grid gap-3">
                <label className="text-xs text-slate-300">
                  Stage 1: Attacking Organization (in possession)
                  <textarea
                    rows={3}
                    defaultValue="Create support triangles around the ball, prioritize third-player runs, and maintain width with one weak-side runner."
                    className="mt-1 w-full rounded-md border border-slate-700 bg-[#081221] px-2 py-2 text-sm text-slate-200"
                  />
                </label>
                <label className="text-xs text-slate-300">
                  Stage 2: Defensive Transition (on ball loss)
                  <textarea
                    rows={3}
                    defaultValue="Immediate 5-second counter-press around the loss zone; nearest 3 players lock central lanes while back line protects depth."
                    className="mt-1 w-full rounded-md border border-slate-700 bg-[#081221] px-2 py-2 text-sm text-slate-200"
                  />
                </label>
                <label className="text-xs text-slate-300">
                  Stage 3: Defensive Organization (out of possession)
                  <textarea
                    rows={3}
                    defaultValue="Maintain compact line spacing, force play wide, and keep midfield and back line connected within 10-12 yards."
                    className="mt-1 w-full rounded-md border border-slate-700 bg-[#081221] px-2 py-2 text-sm text-slate-200"
                  />
                </label>
                <label className="text-xs text-slate-300">
                  Stage 4: Attacking Transition (on ball regain)
                  <textarea
                    rows={3}
                    defaultValue="First look forward if advantage exists; if not, secure possession with one reset pass and rebuild through central support."
                    className="mt-1 w-full rounded-md border border-slate-700 bg-[#081221] px-2 py-2 text-sm text-slate-200"
                  />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1.5 text-xs text-cyan-200">
                  Save Game Model
                </button>
                <button className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-200">
                  Push to All Coaches
                </button>
              </div>
            </section>
          </div>

          <div className="border-t border-cyan-500/[0.08] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-cyan-200">Topic Discussion Board</h2>
              <button className="rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1.5 text-xs text-cyan-200">
                Create Topic
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="text-slate-400">
                  <tr className="border-b border-slate-800">
                    <th className="py-2 pr-3 font-medium">Topic</th>
                    <th className="py-2 pr-3 font-medium">Owner</th>
                    <th className="py-2 pr-3 font-medium">Participants</th>
                    <th className="py-2 pr-3 font-medium">Updates</th>
                    <th className="py-2 pr-3 font-medium">Last Update</th>
                    <th className="py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {topicBoard.map((topic) => (
                    <tr key={topic.topic} className="border-b border-slate-900/80">
                      <td className="py-2 pr-3 text-slate-200">{topic.topic}</td>
                      <td className="py-2 pr-3 text-slate-300">{topic.owner}</td>
                      <td className="py-2 pr-3 text-slate-200">{topic.participants}</td>
                      <td className="py-2 pr-3 text-slate-200">{topic.updates}</td>
                      <td className="py-2 pr-3 text-slate-400">{topic.lastUpdate}</td>
                      <td className="py-2">
                        <button className="rounded-md border border-slate-600/80 bg-slate-700/20 px-2 py-1 text-[11px] text-slate-200">
                          Open Thread
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t border-cyan-500/[0.08] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-cyan-200">AI Agent Monitoring</h2>
              <span className="text-[11px] text-slate-400">Detects planning gaps and repetitive coaching patterns</span>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <button className="rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1.5 text-xs text-cyan-200">
                Run Agent Scan
              </button>
              <button className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-200">
                Auto Resolve Suggestions
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-cyan-500/20 bg-[#071121]/65 p-4">
              <table className="min-w-full text-left text-xs">
                <thead className="text-slate-400">
                  <tr className="border-b border-slate-800">
                    <th className="py-2 pr-3 font-medium">Coach</th>
                    <th className="py-2 pr-3 font-medium">Issue</th>
                    <th className="py-2 pr-3 font-medium">Severity</th>
                    <th className="py-2 pr-3 font-medium">Details</th>
                    <th className="py-2 pr-3 font-medium">Recommendation</th>
                    <th className="py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {aiAgentFindings.map((row) => (
                    <tr key={`${row.coach}-${row.issue}`} className="border-b border-slate-900/80 align-top">
                      <td className="py-2 pr-3 text-slate-200">{row.coach}</td>
                      <td className="py-2 pr-3 text-slate-300">{row.issue}</td>
                      <td className="py-2 pr-3">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${severityPill(row.severity)}`}>
                          {row.severity}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-300">{row.details}</td>
                      <td className="py-2 pr-3 text-slate-300">{row.recommendation}</td>
                      <td className="py-2">
                        <button className="rounded-md border border-slate-600/80 bg-slate-700/20 px-2 py-1 text-[11px] text-slate-200">
                          Create Task
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t border-cyan-500/[0.08] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-cyan-200">Coaches Weekly Calendar</h2>
              <span className="text-[11px] text-slate-400">Session titles from Vault with reference codes</span>
            </div>
            <div className="mb-3 grid gap-2 md:grid-cols-5">
              <select className="rounded-md border border-slate-700 bg-[#081221] px-2 py-2 text-xs text-slate-200">
                <option>Select coach</option>
                <option>Coach A</option>
                <option>Coach B</option>
                <option>Coach C</option>
              </select>
              <select className="rounded-md border border-slate-700 bg-[#081221] px-2 py-2 text-xs text-slate-200">
                <option>Select day</option>
                <option>Monday</option>
                <option>Tuesday</option>
                <option>Wednesday</option>
              </select>
              <select className="rounded-md border border-slate-700 bg-[#081221] px-2 py-2 text-xs text-slate-200">
                <option>Select Vault session</option>
                <option>Build Out Under Pressure (S-E5RW)</option>
                <option>Pressing Triggers (S-K2FM)</option>
                <option>Transition to Attack (S-T4PA)</option>
              </select>
              <button className="rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-2 text-xs text-cyan-200">
                Add to Coach
              </button>
              <button className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-2 text-xs text-emerald-200">
                Auto Populate Week
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-cyan-500/20 bg-[#071121]/65 p-4">
              <table className="min-w-full text-left text-xs">
                <thead className="text-slate-400">
                  <tr className="border-b border-slate-800">
                    <th className="py-2 pr-3 font-medium">Day</th>
                    <th className="py-2 pr-3 font-medium">Coach A (U10)</th>
                    <th className="py-2 pr-3 font-medium">Coach B (U12)</th>
                    <th className="py-2 font-medium">Coach C (U14)</th>
                  </tr>
                </thead>
                <tbody>
                  {coachCalendar.map((row) => (
                    <tr key={row.day} className="border-b border-slate-900/80 align-top">
                      <td className="py-2 pr-3 text-slate-200">{row.day}</td>
                      <td className="py-2 pr-3 text-slate-300">
                        {row.coachA ? (
                          <div className="space-y-1">
                            <div>{row.coachA.title}</div>
                            <div className="text-[11px] text-cyan-300">{row.coachA.code} • {row.coachA.time}</div>
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-slate-300">
                        {row.coachB ? (
                          <div className="space-y-1">
                            <div>{row.coachB.title}</div>
                            <div className="text-[11px] text-cyan-300">{row.coachB.code} • {row.coachB.time}</div>
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="py-2 text-slate-300">
                        {row.coachC ? (
                          <div className="space-y-1">
                            <div>{row.coachC.title}</div>
                            <div className="text-[11px] text-cyan-300">{row.coachC.code} • {row.coachC.time}</div>
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
