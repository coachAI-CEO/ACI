import api, { normalizeApiError } from './api';
import type { WebDiagramSequenceFrame, WebDiagramV1 } from '@aci/shared';

export type BoardShareMode = 'PRIVATE' | 'CLUB';

export type BoardSummary = {
  phase?: string | null;
  zone?: string | null;
  channel?: string | null;
  attFormation?: string | null;
  defFormation?: string | null;
  slideCount?: number | null;
};

export type BoardListItem = {
  id: string;
  title: string;
  ageGroup?: string | null;
  gameModelId?: string | null;
  shareMode?: BoardShareMode | string | null;
  updatedAt?: string;
  favorited?: boolean;
  canEdit?: boolean;
  sourceSessionId?: string | null;
  sourceDrillKey?: string | null;
  /** Rich card metadata for the list row chips. */
  summary?: BoardSummary;
};

export type BoardDetail = {
  id: string;
  title: string;
  diagram?: WebDiagramV1 | null;
  ageGroup?: string | null;
  gameModelId?: string | null;
  shareMode?: BoardShareMode | string | null;
  sourceSessionId?: string | null;
  sourceDrillKey?: string | null;
  canEdit?: boolean;
  favorited?: boolean;
  updatedAt?: string;
  createdAt?: string;
  summary?: BoardSummary;
};

export type BoardCreatePayload =
  | { mode: 'BLANK'; title?: string; ageGroup?: string; shareMode?: BoardShareMode }
  | { mode: 'FORK_SESSION'; sessionId: string; shareMode?: BoardShareMode }
  | { mode: 'FORK_DRILL'; drillId: string; shareMode?: BoardShareMode };

export async function listBoards(
  limit = 40,
  cursor: string | null = null
): Promise<{ boards: BoardListItem[]; nextCursor: string | null }> {
  try {
    const response = await api.get<{ ok: boolean; boards: BoardListItem[]; nextCursor: string | null }>('/boards', {
      params: cursor ? { limit, cursor } : { limit },
    });
    return {
      boards: response.data.boards || [],
      nextCursor: response.data.nextCursor || null,
    };
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function getBoard(boardId: string): Promise<BoardDetail> {
  try {
    const response = await api.get<{ ok: boolean; board: BoardDetail }>(`/boards/${encodeURIComponent(boardId)}`);
    return response.data.board;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function setBoardFavorited(boardId: string, favorited: boolean): Promise<BoardDetail> {
  try {
    const response = await api.patch<{ ok: boolean; board: BoardDetail }>(`/boards/${encodeURIComponent(boardId)}`, {
      favorited,
    });
    return response.data.board;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function createBoard(payload: BoardCreatePayload): Promise<BoardDetail> {
  try {
    const response = await api.post<{ ok: boolean; board: BoardDetail }>('/boards', payload);
    return response.data.board;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function deleteBoard(boardId: string): Promise<void> {
  try {
    await api.delete<{ ok: boolean }>(`/boards/${encodeURIComponent(boardId)}`);
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function patchBoard(
  boardId: string,
  body: { title?: string; shareMode?: BoardShareMode; favorited?: boolean; diagram?: WebDiagramV1; ageGroup?: string | null }
): Promise<BoardDetail> {
  try {
    const response = await api.patch<{ ok: boolean; board: BoardDetail }>(
      `/boards/${encodeURIComponent(boardId)}`,
      body
    );
    return response.data.board;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export function extractBoardFrames(diagram: WebDiagramV1 | null | undefined): WebDiagramSequenceFrame[] {
  const frames = diagram?.sequence?.frames;
  if (Array.isArray(frames) && frames.length) return frames;
  // When the diagram has no sequence we still treat the root layers as a
  // single "frame" so the preview/pager UX is consistent.
  if (diagram) {
    return [
      {
        id: diagram.sequence?.activeFrameId || 'root',
        players: diagram.players || [],
        arrows: diagram.arrows || [],
        areas: diagram.areas || [],
        labels: diagram.labels || [],
        balls: diagram.balls,
        goals: diagram.goals,
        coach: diagram.coach,
        cones: diagram.cones,
        elements: diagram.elements,
      },
    ];
  }
  return [];
}
