"use client";

type QAScores = {
  structure?: number;
  gameModel?: number;
  psych?: number;
  clarity?: number;
  realism?: number;
  constraints?: number;
  safety?: number;
};

type QAScoresDisplayProps = {
  scores: QAScores;
  pass?: boolean;
};

const SCORE_LABELS: Record<string, string> = {
  structure: "Structure",
  gameModel: "Game Model",
  psych: "Psychology",
  clarity: "Clarity",
  realism: "Realism",
  constraints: "Constraints",
  safety: "Safety",
};

const SCORE_COLORS: Record<string, string> = {
  structure: "#3b82f6", // blue
  gameModel: "#8b5cf6", // purple
  psych: "#ec4899", // pink
  clarity: "#10b981", // green
  realism: "#f59e0b", // amber
  constraints: "#06b6d4", // cyan
  safety: "#ef4444", // red
};

function getScoreColor(score: number): string {
  if (score >= 4.5) return "#10b981"; // green - excellent
  if (score >= 3.5) return "#3b82f6"; // blue - good
  if (score >= 2.5) return "#f59e0b"; // amber - fair
  return "#ef4444"; // red - poor
}

function getScoreLabel(score: number): string {
  if (score >= 4.5) return "Excellent";
  if (score >= 3.5) return "Good";
  if (score >= 2.5) return "Fair";
  if (score >= 1.5) return "Poor";
  return "Very Poor";
}

export default function QAScoresDisplay({ scores, pass }: QAScoresDisplayProps) {
  const scoreEntries = Object.entries(scores).filter(([_, value]) => typeof value === "number");
  
  if (scoreEntries.length === 0) {
    return null;
  }

  const averageScore = scoreEntries.reduce((sum, [_, score]) => sum + (score as number), 0) / scoreEntries.length;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Quality Scores</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Average:</span>
          <span
            className="text-sm font-bold"
            style={{ color: getScoreColor(averageScore) }}
          >
            {averageScore.toFixed(1)}
          </span>
          {pass !== undefined && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                pass
                  ? "bg-green-500/20 text-green-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              {pass ? "PASS" : "FAIL"}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {scoreEntries.map(([key, score]) => {
          const scoreNum = score as number;
          const percentage = (scoreNum / 5) * 100;
          const color = SCORE_COLORS[key] || getScoreColor(scoreNum);
          
          return (
            <div
              key={key}
              className="flex flex-col gap-1.5 rounded-lg border border-slate-700/50 bg-slate-800/30 p-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                  {SCORE_LABELS[key] || key}
                </span>
                <span
                  className="text-xs font-bold"
                  style={{ color }}
                >
                  {scoreNum.toFixed(1)}
                </span>
              </div>
              
              {/* Progress bar */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700/50">
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: color,
                    opacity: 0.8,
                  }}
                />
              </div>
              
              {/* Score label */}
              <span className="text-[9px] text-slate-500">
                {getScoreLabel(scoreNum)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

