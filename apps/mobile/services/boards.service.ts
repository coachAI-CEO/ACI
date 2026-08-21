import api, { normalizeApiError } from './api';

export type BoardListItem = {
  id: string;
  title: string;
  ageGroup?: string | null;
  gameModelId?: string | null;
  shareMode?: string | null;
  updatedAt?: string;
  favorited?: boolean;
  phase?: string | null;
  zone?: string | null;
  attFormation?: string | null;
  defFormation?: string | null;
  slideCount?: number | null;
  canEdit?: boolean;
};

export type BoardDetail = {
  id: string;
  title: string;
  diagram?: any;
  ageGroup?: string | null;
  gameModelId?: string | null;
  shareMode?: string | null;
  sourceSessionId?: string | null;
  canEdit?: boolean;
  favorited?: boolean;
  updatedAt?: string;
  createdAt?: string;
};

export async function listBoards(limit = 40): Promise<{ boards: BoardListItem[]; nextCursor: string | null }> {
  try {
    const response = await api.get<{ ok: boolean; boards: BoardListItem[]; nextCursor: string | null }>('/boards', {
      params: { limit },
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

export function extractBoardFrames(diagram: any): any[] {
  const frames = diagram?.sequence?.frames;
  if (Array.isArray(frames) && frames.length) return frames;
  if (diagram && typeof diagram === 'object') return [diagram];
  return [];
}
