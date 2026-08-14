"use client";

import * as React from "react";
import type { ReactNode } from "react";
import type { DiagramArrow, DiagramTeamCode } from "@/types/diagram";

export type BoardTool =
  | "select"
  | "add-player"
  | "line-free"
  | "line-draw"
  | "line-pass"
  | "line-run"
  | "line-curve"
  | "line-curve-rev"
  | "shape-rect"
  | "shape-circle"
  | "shape-spotlight"
  | "label"
  | "ball"
  | "eraser";

export type LineGeometry = "straight" | "curve" | "freehand";

type Props = {
  tool: BoardTool;
  onToolChange: (tool: BoardTool) => void;
  addTeam: DiagramTeamCode;
  onAddTeamChange: (team: DiagramTeamCode) => void;
  onUndo: () => void;
  disabled?: boolean;
  /** Vertical left rail (Idea A) vs legacy horizontal bar. */
  variant?: "bar" | "rail";
};

type MenuId = "select" | "lines" | "shapes" | null;

type MenuItem = {
  id: BoardTool;
  label: string;
  shortcut?: string;
  icon: ReactNode;
};

const SELECT_ITEMS: MenuItem[] = [
  {
    id: "select",
    label: "Move",
    shortcut: "V",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        <path d="M4 3l8.5 17 1.7-6.3L21 12 4 3z" />
      </svg>
    ),
  },
  {
    id: "add-player",
    label: "Player",
    shortcut: "P",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: "ball",
    label: "Ball",
    shortcut: "B",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="7" />
        <path d="M12 5v14M5.5 9.5h13M5.5 14.5h13" />
      </svg>
    ),
  },
];

const LINE_ITEMS: MenuItem[] = [
  {
    id: "line-free",
    label: "Free Draw",
    shortcut: "D",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 16l5-5 3 3 8-8" />
        <path d="M15 6l3 3" />
      </svg>
    ),
  },
  {
    id: "line-draw",
    label: "Straight Line",
    shortcut: "L",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M5 12h14" />
      </svg>
    ),
  },
  {
    id: "line-pass",
    label: "Arrow",
    shortcut: "A",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 12h14" />
        <path d="M14 7l5 5-5 5" />
      </svg>
    ),
  },
  {
    id: "line-run",
    label: "Dashed Line",
    shortcut: "S",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 12h3M10 12h3M16 12h4" strokeDasharray="3 3" />
      </svg>
    ),
  },
  {
    id: "line-curve",
    label: "Curved Arrow",
    shortcut: "C",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 16c4-10 12-10 14-2" />
        <path d="M16 10l4 4-5 1" />
      </svg>
    ),
  },
  {
    id: "line-curve-rev",
    label: "Curved other way",
    shortcut: "X",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 8c4 10 12 10 14 2" />
        <path d="M16 14l4-4-5-1" />
      </svg>
    ),
  },
];

const SHAPE_ITEMS: MenuItem[] = [
  {
    id: "shape-circle",
    label: "Circle",
    shortcut: "O",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="7" />
      </svg>
    ),
  },
  {
    id: "shape-rect",
    label: "Rectangle",
    shortcut: "U",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="5" y="6" width="14" height="12" rx="1.5" />
      </svg>
    ),
  },
  {
    id: "shape-spotlight",
    label: "Spotlight",
    shortcut: "I",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M9 18h6M10 21h4" />
        <path d="M12 3a5 5 0 015 5c0 2-1 3.5-2.2 4.5-.5.4-.8 1-.8 1.5v1H10v-1c0-.5-.3-1.1-.8-1.5C7.999 11.5 7 10 7 8a5 5 0 015-5z" />
      </svg>
    ),
  },
];

function itemForTool(tool: BoardTool, items: MenuItem[], fallback: MenuItem) {
  return items.find((i) => i.id === tool) || fallback;
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </span>
  );
}

function ToolButton({
  active,
  onClick,
  title,
  children,
  chevron,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: ReactNode;
  chevron?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`relative flex h-10 min-w-10 items-center justify-center gap-0.5 rounded-lg border px-2 transition ${
        active
          ? "border-sky-400/50 bg-sky-500/20 text-sky-100"
          : "border-white/10 bg-black/30 text-slate-300 hover:bg-white/5 hover:text-white"
      }`}
    >
      {children}
      {chevron ? (
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 opacity-70" fill="currentColor">
          <path d="M2.5 4.5L6 8l3.5-3.5" />
        </svg>
      ) : null}
    </button>
  );
}

function DropdownMenu({
  open,
  items,
  activeTool,
  onPick,
  side = "bottom",
}: {
  open: boolean;
  items: MenuItem[];
  activeTool: BoardTool;
  onPick: (id: BoardTool) => void;
  side?: "bottom" | "right";
}) {
  if (!open) return null;
  const pos =
    side === "right"
      ? "left-[calc(100%+6px)] top-0"
      : "left-0 top-[calc(100%+6px)]";
  return (
    <div
      className={`absolute ${pos} z-40 min-w-[11.5rem] overflow-hidden rounded-xl border border-white/10 bg-[#0b1220] py-1 shadow-xl shadow-black/50`}
    >
      {items.map((item) => {
        const active = activeTool === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onPick(item.id)}
            className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[12px] transition ${
              active ? "bg-sky-500/15 text-sky-100" : "text-slate-200 hover:bg-white/5"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center text-slate-300">{item.icon}</span>
            <span className="flex-1 font-medium">{item.label}</span>
            {item.shortcut ? (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {item.shortcut}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export default function BoardToolbar({
  tool,
  onToolChange,
  addTeam,
  onAddTeamChange,
  onUndo,
  disabled,
  variant = "rail",
}: Props) {
  const [openMenu, setOpenMenu] = React.useState<MenuId>(null);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  const [lastSelect, setLastSelect] = React.useState<BoardTool>("select");
  const [lastLine, setLastLine] = React.useState<BoardTool>("line-pass");
  const [lastShape, setLastShape] = React.useState<BoardTool>("shape-circle");

  React.useEffect(() => {
    if (tool === "select" || tool === "add-player" || tool === "ball") setLastSelect(tool);
    if (tool.startsWith("line-")) setLastLine(tool);
    if (tool.startsWith("shape-")) setLastShape(tool);
  }, [tool]);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  React.useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      const map: Record<string, BoardTool> = {
        v: "select",
        p: "add-player",
        b: "ball",
        d: "line-free",
        l: "line-draw",
        a: "line-pass",
        s: "line-run",
        c: "line-curve",
        x: "line-curve-rev",
        o: "shape-circle",
        u: "shape-rect",
        i: "shape-spotlight",
        t: "label",
        e: "eraser",
      };
      const next = map[key];
      if (!next) return;
      e.preventDefault();
      onToolChange(next);
      setOpenMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled, onToolChange]);

  if (disabled && variant === "bar") return null;

  const selectActive = tool === "select" || tool === "add-player" || tool === "ball";
  const lineActive = tool.startsWith("line-");
  const shapeActive = tool.startsWith("shape-");

  const selectItem = itemForTool(lastSelect, SELECT_ITEMS, SELECT_ITEMS[0]);
  const lineItem = itemForTool(lastLine, LINE_ITEMS, LINE_ITEMS[0]);
  const shapeItem = itemForTool(lastShape, SHAPE_ITEMS, SHAPE_ITEMS[0]);

  const pick = (id: BoardTool) => {
    if (disabled) return;
    onToolChange(id);
    setOpenMenu(null);
  };

  const toggle = (id: MenuId) => {
    if (disabled) return;
    setOpenMenu((cur) => (cur === id ? null : id));
  };

  const menuSide = variant === "rail" ? "right" : "bottom";

  if (variant === "rail") {
    return (
      <div
        ref={rootRef}
        className={`flex w-12 shrink-0 flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-[#07111f]/95 py-2 ${
          disabled ? "pointer-events-none opacity-40" : ""
        }`}
        title={toolHint(tool)}
      >
        <div className="relative">
          <ToolButton
            active={selectActive}
            chevron
            title={`${selectItem.label} (${selectItem.shortcut})`}
            onClick={() => {
              if (openMenu === "select") {
                setOpenMenu(null);
                return;
              }
              onToolChange(selectItem.id);
              setOpenMenu("select");
            }}
          >
            {selectItem.icon}
          </ToolButton>
          <DropdownMenu
            open={openMenu === "select"}
            items={SELECT_ITEMS}
            activeTool={tool}
            onPick={pick}
            side={menuSide}
          />
        </div>
        {tool === "add-player" ? (
          <select
            value={addTeam}
            onChange={(e) => onAddTeamChange(e.target.value as DiagramTeamCode)}
            className="h-8 w-10 rounded-md border border-white/10 bg-black/40 px-0.5 text-[9px] text-slate-200"
            title="Team for new player"
          >
            <option value="ATT">ATT</option>
            <option value="DEF">DEF</option>
            <option value="NEUTRAL">NEU</option>
          </select>
        ) : null}

        <div className="relative">
          <ToolButton
            active={lineActive}
            chevron
            title={`${lineItem.label} (${lineItem.shortcut})`}
            onClick={() => {
              onToolChange(lineItem.id);
              toggle("lines");
            }}
          >
            {lineItem.icon}
          </ToolButton>
          <DropdownMenu
            open={openMenu === "lines"}
            items={LINE_ITEMS}
            activeTool={tool}
            onPick={pick}
            side={menuSide}
          />
        </div>

        <div className="relative">
          <ToolButton
            active={shapeActive}
            chevron
            title={`${shapeItem.label} (${shapeItem.shortcut})`}
            onClick={() => {
              onToolChange(shapeItem.id);
              toggle("shapes");
            }}
          >
            {shapeItem.icon}
          </ToolButton>
          <DropdownMenu
            open={openMenu === "shapes"}
            items={SHAPE_ITEMS}
            activeTool={tool}
            onPick={pick}
            side={menuSide}
          />
        </div>

        <ToolButton active={tool === "label"} title="Text (T)" onClick={() => pick("label")}>
          <span className="text-sm font-semibold">T</span>
        </ToolButton>
        <ToolButton active={tool === "eraser"} title="Eraser (E)" onClick={() => pick("eraser")}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M7 17l-2.5-2.5a2 2 0 010-2.8L14 2.2a2 2 0 012.8 0L21 6.4a2 2 0 010 2.8L11 19H7v-2z" />
            <path d="M4 21h16" />
          </svg>
        </ToolButton>
        <ToolButton active={false} title="Undo (⌘Z)" onClick={onUndo}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M9 7H5v4" />
            <path d="M5 11a7 7 0 117 7" />
          </svg>
        </ToolButton>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="flex flex-col gap-2 rounded-xl border border-white/10 bg-[#07111f]/90 p-2 backdrop-blur"
    >
      <div className="flex flex-wrap items-end gap-4">
        <div className="relative">
          <GroupLabel>Select</GroupLabel>
          <div className="flex items-center gap-1.5">
            <ToolButton
              active={selectActive}
              chevron
              title={`${selectItem.label} (${selectItem.shortcut})`}
              onClick={() => {
                if (openMenu === "select") {
                  setOpenMenu(null);
                  return;
                }
                onToolChange(selectItem.id);
                setOpenMenu("select");
              }}
            >
              {selectItem.icon}
              {selectItem.shortcut ? (
                <span className="absolute bottom-0.5 right-1 text-[8px] font-bold text-slate-400">
                  {selectItem.shortcut}
                </span>
              ) : null}
            </ToolButton>
            {tool === "add-player" ? (
              <select
                value={addTeam}
                onChange={(e) => onAddTeamChange(e.target.value as DiagramTeamCode)}
                className="h-10 rounded-lg border border-white/10 bg-black/40 px-2 text-[11px] text-slate-200"
              >
                <option value="ATT">ATT</option>
                <option value="DEF">DEF</option>
                <option value="NEUTRAL">NEU</option>
              </select>
            ) : null}
          </div>
          <DropdownMenu
            open={openMenu === "select"}
            items={SELECT_ITEMS}
            activeTool={tool}
            onPick={pick}
          />
        </div>

        <div className="relative">
          <GroupLabel>Lines</GroupLabel>
          <ToolButton
            active={lineActive}
            chevron
            title={`${lineItem.label} (${lineItem.shortcut})`}
            onClick={() => {
              onToolChange(lineItem.id);
              toggle("lines");
            }}
          >
            {lineItem.icon}
          </ToolButton>
          <DropdownMenu
            open={openMenu === "lines"}
            items={LINE_ITEMS}
            activeTool={tool}
            onPick={pick}
          />
        </div>

        <div className="relative">
          <GroupLabel>Shapes</GroupLabel>
          <ToolButton
            active={shapeActive}
            chevron
            title={`${shapeItem.label} (${shapeItem.shortcut})`}
            onClick={() => {
              onToolChange(shapeItem.id);
              toggle("shapes");
            }}
          >
            {shapeItem.icon}
          </ToolButton>
          <DropdownMenu
            open={openMenu === "shapes"}
            items={SHAPE_ITEMS}
            activeTool={tool}
            onPick={pick}
          />
        </div>

        <div>
          <GroupLabel>Annotate</GroupLabel>
          <div className="flex items-center gap-1.5">
            <ToolButton active={tool === "label"} title="Text (T)" onClick={() => pick("label")}>
              <span className="text-sm font-semibold">T</span>
            </ToolButton>
            <ToolButton active={tool === "eraser"} title="Eraser (E)" onClick={() => pick("eraser")}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M7 17l-2.5-2.5a2 2 0 010-2.8L14 2.2a2 2 0 012.8 0L21 6.4a2 2 0 010 2.8L11 19H7v-2z" />
                <path d="M4 21h16" />
              </svg>
            </ToolButton>
            <ToolButton active={false} title="Undo (⌘Z)" onClick={onUndo}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M9 7H5v4" />
                <path d="M5 11a7 7 0 117 7" />
              </svg>
            </ToolButton>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-slate-500">{toolHint(tool)}</p>
    </div>
  );
}

function toolHint(tool: BoardTool): string {
  switch (tool) {
    case "select":
      return "Drag players/ball. Click a line to select — drag to move, handles to resize (snap to players).";
    case "add-player":
      return "Click the pitch to place a player.";
    case "ball":
      return "Click the pitch to place a ball (drag with Move).";
    case "line-free":
      return "Draw freehand on the pitch. Start/end near a player to link.";
    case "line-draw":
    case "line-pass":
    case "line-run":
      return "Drag from pitch or a player. Drop on a player to link (sticks when they move), or anywhere for a free end.";
    case "line-curve":
      return "Drag to draw a curved arrow (bends one way). Drop on a player to link.";
    case "line-curve-rev":
      return "Drag to draw a curved arrow bending the other way. Drop on a player to link.";
    case "shape-rect":
      return "Drag to draw a rectangular zone.";
    case "shape-circle":
      return "Drag to draw a circular highlight.";
    case "shape-spotlight":
      return "Drag to place a soft spotlight on an area of the pitch.";
    case "label":
      return "Click the pitch to add a text label.";
    case "eraser":
      return "Click a line, shape, label, ball, or player to remove it.";
    default:
      return "";
  }
}

export function lineToolToArrow(tool: BoardTool): {
  type: DiagramArrow["type"];
  style: DiagramArrow["style"];
  weight: DiagramArrow["weight"];
  arrowhead: boolean;
  geometry: LineGeometry;
  curveBulge?: number;
} | null {
  if (tool === "line-free") {
    return { type: "transition", style: "solid", weight: "normal", arrowhead: false, geometry: "freehand" };
  }
  if (tool === "line-draw") {
    return { type: "transition", style: "solid", weight: "normal", arrowhead: false, geometry: "straight" };
  }
  if (tool === "line-pass") {
    return { type: "pass", style: "solid", weight: "normal", arrowhead: true, geometry: "straight" };
  }
  if (tool === "line-run") {
    return { type: "run", style: "dashed", weight: "normal", arrowhead: false, geometry: "straight" };
  }
  if (tool === "line-curve") {
    return {
      type: "pass",
      style: "solid",
      weight: "normal",
      arrowhead: true,
      geometry: "curve",
      curveBulge: 0.28,
    };
  }
  if (tool === "line-curve-rev") {
    return {
      type: "pass",
      style: "solid",
      weight: "normal",
      arrowhead: true,
      geometry: "curve",
      curveBulge: -0.28,
    };
  }
  return null;
}
