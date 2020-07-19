import { SingleResponse, PagedResponse, Link } from './common';

export interface Names {
  international: string;
  japanese: string;
  twitch: string;
}

export interface Ruleset {
  'show-milliseconds': boolean;
  'require-verification': boolean;
  'require-video': boolean;
  'run-times': string[];
  'default-time': string;
  'emulators-allowed': boolean;
}

export type ModLevel = 'moderator' | 'super-moderator';

export const modLevelOrder: ModLevel[] = ['moderator', 'super-moderator'];

export interface Moderators {
  [userId: string]: ModLevel;
}

export interface AssetData {
  uri: string;
  width: number;
  height: number;
}

export type AssetDataNull = AssetData | null;

export interface Assets {
  logo: AssetDataNull;
  'cover-tiny': AssetDataNull;
  'cover-small': AssetDataNull;
  'cover-medium': AssetDataNull;
  'cover-large': AssetDataNull;
  icon: AssetDataNull;
  'trophy-1st': AssetDataNull;
  'trophy-2nd': AssetDataNull;
  'trophy-3rd': AssetDataNull;
  'trophy-4th': AssetDataNull;
  background: AssetDataNull;
  foreground: AssetDataNull;
}

export interface GameData {
  id: string;
  names: Names;
  abbreviation: string;
  weblink: string;
  released: number;
  'release-date': string;
  ruleset: Ruleset;
  romhack: boolean;
  gametypes: string[];
  platforms: string[];
  regions: string[];
  genres: string[];
  engines: string[];
  developers: string[];
  publishers: string[];
  moderators: Moderators;
  created: Date | null;
  assets: Assets;
  links: Link[];
}

export type GameResponse = SingleResponse<GameData>;
export type GamesResponse = PagedResponse<GameData>;
