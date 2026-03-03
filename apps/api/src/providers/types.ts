import type { GameSummary, Platform, PlayerProfile } from "@chessgg/shared";

export interface PlatformDataset {
  platform: Platform;
  username: string;
  profile: PlayerProfile;
  games: GameSummary[];
}

export interface PlatformAdapter {
  fetchProfile(username: string): Promise<PlayerProfile>;
  fetchGames(username: string): Promise<GameSummary[]>;
}
