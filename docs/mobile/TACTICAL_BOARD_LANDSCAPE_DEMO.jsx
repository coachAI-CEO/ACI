import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Plus,
  Copy,
  Trash2,
  Undo2,
  Redo2,
  Save,
  Download,
  Maximize2,
  Minimize2,
  Move,
  User,
  ArrowRight,
  Circle,
  Eraser,
  Grid,
  Sparkles,
  Layers,
  ChevronRight,
  ChevronLeft,
  Settings2,
  Info,
  Check,
  Eye
} from 'lucide-react';

// Default tactical frames data (Build-up -> Progress -> Finish)
const INITIAL_FRAMES = [
  {
    id: 'f1',
    name: 'Build-up',
    description: 'GK & CBs initiating short circulation against press',
    players: [
      // Defending Team (Red) - pressing high
      { id: 'r1', team: 'def', num: 9, x: 46, y: 50, label: 'CF' },
      { id: 'r2', team: 'def', num: 10, x: 38, y: 35, label: 'CAM' },
      { id: 'r3', team: 'def', num: 8, x: 38, y: 65, label: 'CM' },
      { id: 'r4', team: 'def', num: 7, x: 30, y: 20, label: 'RW' },
      { id: 'r5', team: 'def', num: 11, x: 30, y: 80, label: 'LW' },
      { id: 'r6', team: 'def', num: 6, x: 26, y: 50, label: 'CDM' },
      // Attacking Team (Green) - deep buildup
      { id: 'g1', team: 'att', num: 1, x: 92, y: 50, label: 'GK' },
      { id: 'g2', team: 'att', num: 4, x: 82, y: 32, label: 'RCB' },
      { id: 'g3', team: 'att', num: 5, x: 82, y: 68, label: 'LCB' },
      { id: 'g4', team: 'att', num: 2, x: 74, y: 15, label: 'RB' },
      { id: 'g5', team: 'att', num: 3, x: 74, y: 85, label: 'LB' },
      { id: 'g6', team: 'att', num: 6, x: 70, y: 50, label: 'DM' },
      { id: 'g7', team: 'att', num: 8, x: 60, y: 35, label: 'RCM' },
      { id: 'g8', team: 'att', num: 10, x: 60, y: 65, label: 'LCM' },
      { id: 'g9', team: 'att', num: 9, x: 48, y: 50, label: 'ST' },
      { id: 'g10', team: 'att', num: 7, x: 50, y: 18, label: 'RW' },
      { id: 'g11', team: 'att', num: 11, x: 50, y: 82, label: 'LW' },
    ],
    ball: { x: 90, y: 50 },
    arrows: [
      { id: 'a1', from: { x: 90, y: 50 }, to: { x: 82, y: 32 }, type: 'pass', style: 'dashed', color: '#38bdf8' },
      { id: 'a2', from: { x: 74, y: 15 }, to: { x: 62, y: 14 }, type: 'run', style: 'dotted', color: '#22c55e' }
    ]
  },
  {
    id: 'f2',
    name: 'Progress',
    description: 'Breaking the first line via central pivot rotation',
    players: [
      // Red
      { id: 'r1', team: 'def', num: 9, x: 58, y: 42, label: 'CF' },
      { id: 'r2', team: 'def', num: 10, x: 52, y: 30, label: 'CAM' },
      { id: 'r3', team: 'def', num: 8, x: 44, y: 60, label: 'CM' },
      { id: 'r4', team: 'def', num: 7, x: 42, y: 22, label: 'RW' },
      { id: 'r5', team: 'def', num: 11, x: 38, y: 78, label: 'LW' },
      { id: 'r6', team: 'def', num: 6, x: 34, y: 48, label: 'CDM' },
      // Green
      { id: 'g1', team: 'att', num: 1, x: 92, y: 50, label: 'GK' },
      { id: 'g2', team: 'att', num: 4, x: 78, y: 34, label: 'RCB' },
      { id: 'g3', team: 'att', num: 5, x: 76, y: 64, label: 'LCB' },
      { id: 'g4', team: 'att', num: 2, x: 58, y: 14, label: 'RB' },
      { id: 'g5', team: 'att', num: 3, x: 62, y: 86, label: 'LB' },
      { id: 'g6', team: 'att', num: 6, x: 62, y: 48, label: 'DM' },
      { id: 'g7', team: 'att', num: 8, x: 50, y: 38, label: 'RCM' },
      { id: 'g8', team: 'att', num: 10, x: 46, y: 68, label: 'LCM' },
      { id: 'g9', team: 'att', num: 9, x: 32, y: 50, label: 'ST' },
      { id: 'g10', team: 'att', num: 7, x: 34, y: 18, label: 'RW' },
      { id: 'g11', team: 'att', num: 11, x: 35, y: 82, label: 'LW' },
    ],
    ball: { x: 62, y: 48 },
    arrows: [
      { id: 'a3', from: { x: 62, y: 48 }, to: { x: 50, y: 38 }, type: 'pass', style: 'solid', color: '#38bdf8' },
      { id: 'a4', from: { x: 50, y: 38 }, to: { x: 34, y: 18 }, type: 'pass', style: 'dashed', color: '#a855f7' }
    ]
  },
  {
    id: 'f3',
    name: 'Finish',
    description: 'Overload in half-space & cutback cross to striker',
    players: [
      // Red
      { id: 'r1', team: 'def', num: 9, x: 50, y: 45, label: 'CF' },
      { id: 'r2', team: 'def', num: 10, x: 38, y: 38, label: 'CAM' },
      { id: 'r3', team: 'def', num: 8, x: 28, y: 52, label: 'CM' },
      { id: 'r4', team: 'def', num: 7, x: 30, y: 24, label: 'RW' },
      { id: 'r5', team: 'def', num: 11, x: 25, y: 70, label: 'LW' },
      { id: 'r6', team: 'def', num: 6, x: 18, y: 45, label: 'CDM' },
      // Green
      { id: 'g1', team: 'att', num: 1, x: 88, y: 50, label: 'GK' },
      { id: 'g2', team: 'att', num: 4, x: 60, y: 36, label: 'RCB' },
      { id: 'g3', team: 'att', num: 5, x: 58, y: 64, label: 'LCB' },
      { id: 'g4', team: 'att', num: 2, x: 36, y: 14, label: 'RB' },
      { id: 'g5', team: 'att', num: 3, x: 42, y: 84, label: 'LB' },
      { id: 'g6', team: 'att', num: 6, x: 40, y: 48, label: 'DM' },
      { id: 'g7', team: 'att', num: 8, x: 22, y: 32, label: 'RCM' },
      { id: 'g8', team: 'att', num: 10, x: 24, y: 62, label: 'LCM' },
      { id: 'g9', team: 'att', num: 9, x: 12, y: 48, label: 'ST' },
      { id: 'g10', team: 'att', num: 7, x: 16, y: 16, label: 'RW' },
      { id: 'g11', team: 'att', num: 11, x: 18, y: 78, label: 'LW' },
    ],
    ball: { x: 16, y: 16 },
    arrows: [
      { id: 'a5', from: { x: 16, y: 16 }, to: { x: 12, y: 48 }, type: 'cross', style: 'curved', color: '#eab308' },
      { id: 'a6', from: { x: 12, y: 48 }, to: { x: 4, y: 50 }, type: 'shot', style: 'solid', color: '#ef4444' }
    ]
  }
];

export default function App() {
  // State
  const [frames, setFrames] = useState(INITIAL_FRAMES);
  const [currentFrameIdx, setCurrentFrameIdx] = useState(1);
  const [activeTool, setActiveTool] = useState('move'); // 'move' | 'player' | 'arrow' | 'ball' | 'erase'
  const [selectedTeam, setSelectedTeam] = useState('att'); // 'att' (green) | 'def' (red) | 'neu' (yellow)
  const [matchFormat, setMatchFormat] = useState('11v11'); // '7v7' | '9v9' | '11v11'
  const [pitchView, setPitchView] = useState('Full'); // 'Full' | 'Attacking Half' | 'Defending Half'
  const [arrowType, setArrowType] = useState('dashed'); // 'solid' | 'dashed' | 'dotted' | 'curved'
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [arrowDraft, setArrowDraft] = useState(null);
  const [showPitchGrid, setShowPitchGrid] = useState(true);
  const [showDesignGuide, setShowDesignGuide] = useState(false);
  const [notification, setNotification] = useState(null);

  const pitchRef = useRef(null);
  const currentFrame = frames[currentFrameIdx] || frames[0];

  // Auto-play / loop animation simulation
  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentFrameIdx((prev) => (prev + 1) % frames.length);
      }, 1400);
    }
    return () => clearInterval(interval);
  }, [isPlaying, frames.length]);

  const triggerToast = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2500);
  };

  // Coordinates helper (% based 0-100)
  const getCoordinatesFromEvent = (e) => {
    if (!pitchRef.current) return { x: 50, y: 50 };
    const rect = pitchRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(3, Math.min(97, ((clientY - rect.top) / rect.height) * 100));
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  };

  // Dragging logic
  const handlePointerDown = (e, itemType, item) => {
    e.stopPropagation();
    if (activeTool === 'erase') {
      if (itemType === 'player') {
        removePlayer(item.id);
      }
      return;
    }

    if (activeTool === 'move') {
      setDraggingId({ type: itemType, id: item?.id || 'ball' });
      if (itemType === 'player') setSelectedPlayerId(item.id);
    } else if (activeTool === 'arrow') {
      const coords = item ? { x: item.x, y: item.y } : getCoordinatesFromEvent(e);
      setArrowDraft({ from: coords, to: coords });
    }
  };

  const handlePointerMove = (e) => {
    if (draggingId) {
      const coords = getCoordinatesFromEvent(e);
      setFrames((prev) =>
        prev.map((f, idx) => {
          if (idx !== currentFrameIdx) return f;
          if (draggingId.type === 'ball') {
            return { ...f, ball: coords };
          } else if (draggingId.type === 'player') {
            return {
              ...f,
              players: f.players.map((p) => (p.id === draggingId.id ? { ...p, x: coords.x, y: coords.y } : p))
            };
          }
          return f;
        })
      );
    } else if (arrowDraft) {
      const coords = getCoordinatesFromEvent(e);
      setArrowDraft((prev) => (prev ? { ...prev, to: coords } : null));
    }
  };

  const handlePointerUp = () => {
    if (arrowDraft && activeTool === 'arrow') {
      // Save new arrow
      const dist = Math.hypot(arrowDraft.to.x - arrowDraft.from.x, arrowDraft.to.y - arrowDraft.from.y);
      if (dist > 3) {
        const newArrow = {
          id: 'arr_' + Date.now(),
          from: arrowDraft.from,
          to: arrowDraft.to,
          type: arrowType === 'curved' ? 'cross' : 'run',
          style: arrowType,
          color: selectedTeam === 'att' ? '#22c55e' : selectedTeam === 'def' ? '#ef4444' : '#eab308'
        };
        setFrames((prev) =>
          prev.map((f, idx) => (idx === currentFrameIdx ? { ...f, arrows: [...f.arrows, newArrow] } : f))
        );
      }
      setArrowDraft(null);
    }
    setDraggingId(null);
  };

  const handlePitchClick = (e) => {
    const coords = getCoordinatesFromEvent(e);
    if (activeTool === 'player') {
      const newPlayer = {
        id: 'p_' + Date.now(),
        team: selectedTeam,
        num: currentFrame.players.filter((p) => p.team === selectedTeam).length + 1,
        x: coords.x,
        y: coords.y,
        label: selectedTeam === 'att' ? 'ATT' : 'DEF'
      };
      setFrames((prev) =>
        prev.map((f, idx) => (idx === currentFrameIdx ? { ...f, players: [...f.players, newPlayer] } : f))
      );
      setSelectedPlayerId(newPlayer.id);
      triggerToast(`Added #${newPlayer.num} (${selectedTeam.toUpperCase()})`);
    } else if (activeTool === 'ball') {
      setFrames((prev) =>
        prev.map((f, idx) => (idx === currentFrameIdx ? { ...f, ball: coords } : f))
      );
      triggerToast('Ball placed');
    }
  };

  const removePlayer = (id) => {
    setFrames((prev) =>
      prev.map((f, idx) => (idx === currentFrameIdx ? { ...f, players: f.players.filter((p) => p.id !== id) } : f))
    );
    if (selectedPlayerId === id) setSelectedPlayerId(null);
    triggerToast('Element erased');
  };

  const addFrame = () => {
    const newId = 'f' + (frames.length + 1);
    const lastFrame = frames[frames.length - 1];
    const newFrame = {
      ...JSON.parse(JSON.stringify(lastFrame)),
      id: newId,
      name: `Phase ${frames.length + 1}`,
      description: 'Tactical follow-through sequence',
      arrows: []
    };
    setFrames([...frames, newFrame]);
    setCurrentFrameIdx(frames.length);
    triggerToast(`Created Phase ${frames.length + 1}`);
  };

  const duplicateFrame = () => {
    const newId = 'f' + (frames.length + 1);
    const cloned = {
      ...JSON.parse(JSON.stringify(currentFrame)),
      id: newId,
      name: `${currentFrame.name} (Copy)`
    };
    const nextFrames = [...frames];
    nextFrames.splice(currentFrameIdx + 1, 0, cloned);
    setFrames(nextFrames);
    setCurrentFrameIdx(currentFrameIdx + 1);
    triggerToast('Frame duplicated');
  };

  const deleteFrame = () => {
    if (frames.length <= 1) {
      triggerToast('Cannot delete the only frame');
      return;
    }
    const nextFrames = frames.filter((_, idx) => idx !== currentFrameIdx);
    setFrames(nextFrames);
    setCurrentFrameIdx(Math.max(0, currentFrameIdx - 1));
    triggerToast('Frame deleted');
  };

  const clearArrows = () => {
    setFrames((prev) =>
      prev.map((f, idx) => (idx === currentFrameIdx ? { ...f, arrows: [] } : f))
    );
    triggerToast('Arrows cleared for this frame');
  };

  // Selected player accessor
  const selectedPlayer = currentFrame.players.find((p) => p.id === selectedPlayerId);

  return (
    <div className="w-full h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      {/* ============================================================== */}
      {/* 1. TOP MINIMAL HORIZONTAL HEADER                               */}
      {/* ============================================================== */}
      <header className="h-12 bg-slate-900/90 border-b border-slate-800/80 px-4 flex items-center justify-between z-20 backdrop-blur-md">
        {/* Left: Branding & Undo/Redo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-emerald-400 font-black text-xs">
              ⚡
            </span>
            <h1 className="text-sm font-bold tracking-wide text-slate-100 hidden sm:inline">
              TacticsLab <span className="text-emerald-400 font-mono text-xs">LANDSCAPE</span>
            </h1>
          </div>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* History Controls */}
          <div className="flex items-center gap-1 bg-slate-800/60 p-0.5 rounded-lg border border-slate-700/50">
            <button
              onClick={() => triggerToast('Undo action')}
              className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => triggerToast('Redo action')}
              className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Center: Match Format & Pitch Scope Segmented Controls */}
        <div className="flex items-center gap-2">
          {/* Format pills */}
          <div className="bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 flex items-center text-xs">
            {['7v7', '9v9', '11v11'].map((fmt) => (
              <button
                key={fmt}
                onClick={() => {
                  setMatchFormat(fmt);
                  triggerToast(`Format set to ${fmt}`);
                }}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  matchFormat === fmt
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>

          {/* Pitch Zoom/Zone pills */}
          <div className="bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 flex items-center text-xs">
            {['Full', 'Attacking Half', 'Defending Half'].map((mode) => (
              <button
                key={mode}
                onClick={() => setPitchView(mode)}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  pitchView === mode
                    ? 'bg-slate-700 text-emerald-400 border border-emerald-500/30 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {mode === 'Attacking Half' ? 'Att Half' : mode === 'Defending Half' ? 'Def Half' : 'Full'}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Pitch Overlays, UX Breakdown Modal & Export/Save */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPitchGrid(!showPitchGrid)}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition ${
              showPitchGrid
                ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300'
                : 'bg-slate-800/60 border-slate-700 text-slate-400'
            }`}
            title="Toggle Tactical Zones / Half-Spaces"
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="hidden md:inline text-[11px]">Zones</span>
          </button>

          <button
            onClick={() => setShowDesignGuide(true)}
            className="px-2.5 py-1 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30 text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">UX Rationale</span>
          </button>

          <button
            onClick={() => triggerToast('Board saved to cloud')}
            className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/10 transition"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 2. MAIN WORKSPACE: LEFT RAIL + PITCH CANVAS + RIGHT RAIL       */}
      {/* ============================================================== */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Toast alert */}
        {notification && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-emerald-500/50 text-emerald-300 px-3.5 py-1.5 rounded-full text-xs font-medium shadow-xl flex items-center gap-2 animate-bounce">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>{notification}</span>
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* 2A. LEFT TOOL RAIL (Creation Tools - Left Thumb Reach)        */}
        {/* ------------------------------------------------------------ */}
        <aside className="w-16 bg-slate-900/95 border-r border-slate-800/80 flex flex-col items-center py-3 gap-3 z-10 select-none">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 text-center">
            Tools
          </div>

          <div className="flex flex-col gap-2 w-full px-2">
            {/* Move / Selection Tool */}
            <button
              onClick={() => setActiveTool('move')}
              className={`w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition ${
                activeTool === 'move'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-bold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
              title="Drag & Move (V)"
            >
              <Move className="w-4 h-4" />
              <span>Move</span>
            </button>

            {/* Add Player Tool */}
            <button
              onClick={() => setActiveTool('player')}
              className={`w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition ${
                activeTool === 'player'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-bold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
              title="Place Player (P)"
            >
              <User className="w-4 h-4" />
              <span>Player</span>
            </button>

            {/* Tactical Arrow / Pass Line Tool */}
            <button
              onClick={() => setActiveTool('arrow')}
              className={`w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition ${
                activeTool === 'arrow'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-bold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
              title="Draw Pass/Run Arrow (A)"
            >
              <ArrowRight className="w-4 h-4" />
              <span>Arrow</span>
            </button>

            {/* Ball Tool */}
            <button
              onClick={() => setActiveTool('ball')}
              className={`w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition ${
                activeTool === 'ball'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-bold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
              title="Place / Reposition Ball (B)"
            >
              <div className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-current rounded-full" />
              </div>
              <span>Ball</span>
            </button>

            {/* Eraser Tool */}
            <button
              onClick={() => setActiveTool('erase')}
              className={`w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition ${
                activeTool === 'erase'
                  ? 'bg-red-500 text-slate-950 shadow-md shadow-red-500/20 font-bold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
              title="Erase Player or Arrow (E)"
            >
              <Eraser className="w-4 h-4" />
              <span>Erase</span>
            </button>
          </div>

          <div className="w-8 h-px bg-slate-800 my-auto" />

          {/* Quick Clear arrows */}
          <button
            onClick={clearArrows}
            className="w-10 h-10 rounded-xl bg-slate-800/40 hover:bg-red-950/40 border border-slate-800 hover:border-red-500/40 text-slate-400 hover:text-red-400 flex flex-col items-center justify-center text-[9px] transition"
            title="Clear tactical arrows in current frame"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </aside>

        {/* ------------------------------------------------------------ */}
        {/* 2B. CENTER PITCH CANVAS (Full Horizontal Pitch)              */}
        {/* ------------------------------------------------------------ */}
        <main
          className="flex-1 bg-slate-950 p-3 flex flex-col items-center justify-center relative overflow-hidden"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Active Tool Mode Badge Floating Indicator */}
          <div className="absolute top-5 left-6 z-20 flex items-center gap-2 pointer-events-none">
            <div className="bg-slate-900/90 border border-slate-700/80 text-slate-200 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md shadow-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                {activeTool === 'move' && 'MOVE: DRAG PLAYERS & BALL'}
                {activeTool === 'player' && `PLACE PLAYER (${selectedTeam.toUpperCase()})`}
                {activeTool === 'arrow' && `DRAW ARROW (${arrowType.toUpperCase()})`}
                {activeTool === 'ball' && 'CLICK PITCH TO PLACE BALL'}
                {activeTool === 'erase' && 'CLICK ELEMENT TO DELETE'}
              </span>
            </div>
          </div>

          {/* Pitch Container Box (Standard 105x68 Pitch Aspect Ratio: ~1.54) */}
          <div
            ref={pitchRef}
            onClick={handlePitchClick}
            className="w-full max-w-5xl aspect-[1.54/1] max-h-[72vh] bg-[#0c2f24] rounded-2xl border-2 border-emerald-900/60 shadow-2xl relative overflow-hidden cursor-crosshair select-none"
            style={{
              backgroundImage: 'radial-gradient(ellipse at center, #0f3d2e 0%, #08241b 100%)'
            }}
          >
            {/* Tactical 5-Channel & 18-Zone Overlay Grid */}
            {showPitchGrid && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30">
                {/* 5 Vertical Half-Space Channels */}
                <line x1="0%" y1="18%" x2="100%" y2="18%" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="0%" y1="36%" x2="100%" y2="36%" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="0%" y1="64%" x2="100%" y2="64%" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="0%" y1="82%" x2="100%" y2="82%" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 4" />
                {/* 6 Horizontal Pitch Thirds */}
                <line x1="16.5%" y1="0%" x2="16.5%" y2="100%" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="33%" y1="0%" x2="33%" y2="100%" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="67%" y1="0%" x2="67%" y2="100%" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="83.5%" y1="0%" x2="83.5%" y2="100%" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 4" />
              </svg>
            )}

            {/* Pitch Grass Stripes */}
            <div className="absolute inset-0 flex pointer-events-none opacity-15">
              {[...Array(10)].map((_, i) => (
                <div key={i} className={`flex-1 ${i % 2 === 0 ? 'bg-white' : 'bg-transparent'}`} />
              ))}
            </div>

            {/* Official Pitch SVG Markings (Horizontal Orientation) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 105 68">
              {/* Outer Boundary */}
              <rect x="2" y="2" width="101" height="64" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" />

              {/* Half-way Line */}
              <line x1="52.5" y1="2" x2="52.5" y2="66" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" />

              {/* Center Circle & Spot */}
              <circle cx="52.5" cy="34" r="9.15" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" />
              <circle cx="52.5" cy="34" r="0.8" fill="rgba(255,255,255,0.8)" />

              {/* Left Penalty Area (18-yard box) */}
              <rect x="2" y="13.84" width="16.5" height="40.32" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" />
              {/* Left Goal Area (6-yard box) */}
              <rect x="2" y="24.84" width="5.5" height="18.32" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" />
              {/* Left Penalty Spot & Arc */}
              <circle cx="13" cy="34" r="0.6" fill="rgba(255,255,255,0.8)" />
              <path d="M 18.5 27.5 A 9.15 9.15 0 0 1 18.5 40.5" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" />
              {/* Left Goal */}
              <rect x="0.2" y="29.5" width="1.8" height="9" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.8)" strokeWidth="0.7" />

              {/* Right Penalty Area */}
              <rect x="86.5" y="13.84" width="16.5" height="40.32" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" />
              {/* Right Goal Area */}
              <rect x="97.5" y="24.84" width="5.5" height="18.32" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" />
              {/* Right Penalty Spot & Arc */}
              <circle cx="92" cy="34" r="0.6" fill="rgba(255,255,255,0.8)" />
              <path d="M 86.5 27.5 A 9.15 9.15 0 0 0 86.5 40.5" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" />
              {/* Right Goal */}
              <rect x="103" y="29.5" width="1.8" height="9" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.8)" strokeWidth="0.7" />

              {/* Corner Arcs */}
              <path d="M 2 3.5 A 1.5 1.5 0 0 0 3.5 2" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" />
              <path d="M 2 64.5 A 1.5 1.5 0 0 1 3.5 66" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" />
              <path d="M 103 3.5 A 1.5 1.5 0 0 1 101.5 2" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" />
              <path d="M 103 64.5 A 1.5 1.5 0 0 0 101.5 66" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" />
            </svg>

            {/* Tactical Arrows Layer */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <defs>
                <marker id="arrow-green" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#22c55e" />
                </marker>
                <marker id="arrow-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
                </marker>
                <marker id="arrow-blue" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
                </marker>
                <marker id="arrow-purple" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#a855f7" />
                </marker>
                <marker id="arrow-yellow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#eab308" />
                </marker>
              </defs>

              {/* Render Frame's Saved Arrows */}
              {currentFrame.arrows.map((arr) => {
                const markerColor =
                  arr.color === '#22c55e'
                    ? 'url(#arrow-green)'
                    : arr.color === '#ef4444'
                    ? 'url(#arrow-red)'
                    : arr.color === '#a855f7'
                    ? 'url(#arrow-purple)'
                    : arr.color === '#eab308'
                    ? 'url(#arrow-yellow)'
                    : 'url(#arrow-blue)';

                if (arr.style === 'curved') {
                  // Quadratic curve
                  const midX = (arr.from.x + arr.to.x) / 2;
                  const midY = (arr.from.y + arr.to.y) / 2 - 10;
                  return (
                    <path
                      key={arr.id}
                      d={`M ${arr.from.x}% ${arr.from.y}% Q ${midX}% ${midY}% ${arr.to.x}% ${arr.to.y}%`}
                      fill="none"
                      stroke={arr.color}
                      strokeWidth="3.5"
                      strokeDasharray="6 4"
                      markerEnd={markerColor}
                    />
                  );
                }

                return (
                  <line
                    key={arr.id}
                    x1={`${arr.from.x}%`}
                    y1={`${arr.from.y}%`}
                    x2={`${arr.to.x}%`}
                    y2={`${arr.to.y}%`}
                    stroke={arr.color}
                    strokeWidth="3.5"
                    strokeDasharray={arr.style === 'dashed' ? '8 6' : arr.style === 'dotted' ? '3 5' : 'none'}
                    markerEnd={markerColor}
                  />
                );
              })}

              {/* Active Draft Arrow */}
              {arrowDraft && (
                <line
                  x1={`${arrowDraft.from.x}%`}
                  y1={`${arrowDraft.from.y}%`}
                  x2={`${arrowDraft.to.x}%`}
                  y2={`${arrowDraft.to.y}%`}
                  stroke={selectedTeam === 'att' ? '#22c55e' : selectedTeam === 'def' ? '#ef4444' : '#eab308'}
                  strokeWidth="3.5"
                  strokeDasharray="6 4"
                />
              )}
            </svg>

            {/* Players Layer */}
            {currentFrame.players.map((p) => {
              const isSelected = selectedPlayerId === p.id;
              const isAtt = p.team === 'att';
              const isDef = p.team === 'def';

              return (
                <div
                  key={p.id}
                  onPointerDown={(e) => handlePointerDown(e, 'player', p)}
                  style={{
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    transform: 'translate(-50%, -50%)',
                    transition: isPlaying ? 'left 1.2s ease-in-out, top 1.2s ease-in-out' : 'transform 0.1s'
                  }}
                  className={`absolute w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-xl cursor-grab active:cursor-grabbing border-2 ${
                    isAtt
                      ? 'bg-emerald-500 text-slate-950 border-emerald-200'
                      : isDef
                      ? 'bg-red-500 text-white border-red-200'
                      : 'bg-amber-400 text-slate-950 border-amber-100'
                  } ${isSelected ? 'ring-4 ring-white scale-110 z-30' : 'z-20 hover:scale-105'}`}
                >
                  <span>{p.num}</span>

                  {/* Position Tag underneath */}
                  <span className="absolute -bottom-4 text-[9px] font-semibold bg-slate-950/80 px-1 rounded text-slate-300 pointer-events-none whitespace-nowrap">
                    {p.label || p.num}
                  </span>
                </div>
              );
            })}

            {/* Soccer Ball */}
            {currentFrame.ball && (
              <div
                onPointerDown={(e) => handlePointerDown(e, 'ball', currentFrame.ball)}
                style={{
                  left: `${currentFrame.ball.x}%`,
                  top: `${currentFrame.ball.y}%`,
                  transform: 'translate(-50%, -50%)',
                  transition: isPlaying ? 'left 1.2s ease-in-out, top 1.2s ease-in-out' : 'transform 0.1s'
                }}
                className="absolute w-5 h-5 rounded-full bg-white border-2 border-slate-900 shadow-xl flex items-center justify-center cursor-grab active:cursor-grabbing z-30 hover:scale-110"
              >
                <div className="w-2 h-2 bg-slate-900 rounded-full" />
              </div>
            )}
          </div>
        </main>

        {/* ------------------------------------------------------------ */}
        {/* 2C. RIGHT RAIL (Tactical Properties HUD - Right Thumb Reach) */}
        {/* ------------------------------------------------------------ */}
        <aside className="w-56 bg-slate-900/95 border-l border-slate-800/80 p-3.5 flex flex-col gap-4 z-10 select-none overflow-y-auto">
          {/* Section: Active Team Switcher */}
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2 flex items-center justify-between">
              <span>Team Role</span>
              <span className="text-emerald-400 font-mono text-[9px]">Right HUD</span>
            </div>
            <div className="grid grid-cols-3 gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setSelectedTeam('att')}
                className={`py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                  selectedTeam === 'att' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-300" />
                ATT
              </button>
              <button
                onClick={() => setSelectedTeam('def')}
                className={`py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                  selectedTeam === 'def' ? 'bg-red-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-red-300" />
                DEF
              </button>
              <button
                onClick={() => setSelectedTeam('neu')}
                className={`py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                  selectedTeam === 'neu' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-200" />
                NEU
              </button>
            </div>
          </div>

          {/* Section: Arrow Style Picker (if arrow active) */}
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">
              Arrow / Action Type
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'dashed', label: 'Pass (Dashed)' },
                { id: 'solid', label: 'Dribble (Solid)' },
                { id: 'dotted', label: 'Run (Dotted)' },
                { id: 'curved', label: 'Cross (Curved)' }
              ].map((style) => (
                <button
                  key={style.id}
                  onClick={() => {
                    setArrowType(style.id);
                    setActiveTool('arrow');
                  }}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-medium border text-left transition ${
                    arrowType === style.id && activeTool === 'arrow'
                      ? 'bg-slate-800 border-emerald-500 text-emerald-300'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          {/* Section: Selected Player Inspector */}
          <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3 flex-1 flex flex-col">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2 flex items-center justify-between">
              <span>Player Inspector</span>
              {selectedPlayer && <span className="text-emerald-400 text-xs">#{selectedPlayer.num}</span>}
            </div>

            {selectedPlayer ? (
              <div className="space-y-3 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Squad Number</label>
                    <input
                      type="number"
                      value={selectedPlayer.num}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setFrames((prev) =>
                          prev.map((f, idx) =>
                            idx === currentFrameIdx
                              ? {
                                  ...f,
                                  players: f.players.map((p) => (p.id === selectedPlayer.id ? { ...p, num: val } : p))
                                }
                              : f
                          )
                        );
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Role / Position</label>
                    <input
                      type="text"
                      value={selectedPlayer.label || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFrames((prev) =>
                          prev.map((f, idx) =>
                            idx === currentFrameIdx
                              ? {
                                  ...f,
                                  players: f.players.map((p) => (p.id === selectedPlayer.id ? { ...p, label: val } : p))
                                }
                              : f
                          )
                        );
                      }}
                      placeholder="e.g. Inverted Winger"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-medium"
                    />
                  </div>
                </div>

                <button
                  onClick={() => removePlayer(selectedPlayer.id)}
                  className="w-full py-1.5 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 hover:bg-red-900/50 text-xs font-semibold flex items-center justify-center gap-1.5 transition mt-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove Player
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-2 text-slate-500">
                <User className="w-6 h-6 mb-1 opacity-40" />
                <span className="text-[11px]">Click or drag any player on pitch to inspect</span>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ============================================================== */}
      {/* 3. BOTTOM COMPACT TIMELINE & ANIMATION SCRUBBER                */}
      {/* ============================================================== */}
      <footer className="h-16 bg-slate-900 border-t border-slate-800/90 px-4 flex items-center justify-between z-20">
        {/* Playback Control Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition ${
              isPlaying
                ? 'bg-amber-500 text-slate-950 shadow-amber-500/20 animate-pulse'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{isPlaying ? 'Pause' : 'Play Sequence'}</span>
          </button>

          <div className="text-xs font-mono text-slate-400 px-2 hidden sm:inline">
            Frame <span className="text-white font-bold">{currentFrameIdx + 1}</span> of {frames.length}
          </div>
        </div>

        {/* Center: Frame Sequence Strip */}
        <div className="flex-1 max-w-2xl mx-4 flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
          {frames.map((frame, idx) => {
            const isActive = currentFrameIdx === idx;
            return (
              <button
                key={frame.id}
                onClick={() => {
                  setCurrentFrameIdx(idx);
                  setIsPlaying(false);
                }}
                className={`flex-1 min-w-[130px] py-1.5 px-3 rounded-xl border text-left transition relative ${
                  isActive
                    ? 'bg-slate-800/90 border-emerald-500 text-white shadow-md'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono mb-0.5">
                  <span className={isActive ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                    PHASE {idx + 1}
                  </span>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                </div>
                <div className="text-xs font-bold truncate">{frame.name}</div>
              </button>
            );
          })}
        </div>

        {/* Right: Keyframe Management Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={addFrame}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition"
            title="Add blank frame"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">+ Frame</span>
          </button>

          <button
            onClick={duplicateFrame}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition"
            title="Duplicate current frame"
          >
            <Copy className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden md:inline">Duplicate</span>
          </button>

          <button
            onClick={deleteFrame}
            disabled={frames.length <= 1}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-red-950/40 border border-slate-700 hover:border-red-500/40 text-slate-400 hover:text-red-400 text-xs disabled:opacity-30 disabled:pointer-events-none transition"
            title="Delete current frame"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </footer>

      {/* ============================================================== */}
      {/* 4. DESIGN RATIONALE MODAL OVERLAY                              */}
      {/* ============================================================== */}
      {showDesignGuide && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Sparkles className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-white">Why Horizontal Layout Wins for Tactics</h2>
                  <p className="text-xs text-slate-400">Ergonomic and spatial design principles</p>
                </div>
              </div>
              <button
                onClick={() => setShowDesignGuide(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <h3 className="font-bold text-emerald-400 mb-1">1. True Tactical Aspect Ratio ($105\text{m} \times 68\text{m}$)</h3>
                <p>
                  In vertical view, pitch width is severely compressed, making wing play, half-space rotations, and defensive channels feel claustrophobic. Horizontal orientation naturally renders standard pitch proportions with ample lateral space.
                </p>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <h3 className="font-bold text-emerald-400 mb-1">2. Two-Thumb Touch Architecture (Landscape Phone/Tablet)</h3>
                <p>
                  - <strong>Left Thumb:</strong> Creation Tools (Move, Player, Arrow, Ball, Erase).<br />
                  - <strong>Right Thumb:</strong> Tactical HUD (Team ATT/DEF, Arrow Style, Inspector).<br />
                  - This keeps thumbs out of the central tactical area where coaches draw tactics.
                </p>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <h3 className="font-bold text-emerald-400 mb-1">3. Video-Scrubber Timeline Strip</h3>
                <p>
                  Phase-based tactical animation (Build-up $\to$ Progress $\to$ Finish) is arranged horizontally across the bottom with a live sequence player, mimicking standard video editors.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowDesignGuide(false)}
              className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition"
            >
              Got it, explore prototype
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
