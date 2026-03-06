import type { GameSummary, Platform, PlayerProfile } from "@chessgg/shared";

export interface FetchGamesOptions {
  maxGames?: number;
  since?: string;
}

export interface PlatformDataset {
  platform: Platform;
  username: string;
  profile: PlayerProfile;
  games: GameSummary[];
}

export interface PlatformAdapter {
  fetchProfile(username: string): Promise<PlayerProfile>;
  fetchGames(username: string, options?: FetchGamesOptions): Promise<GameSummary[]>;
}
