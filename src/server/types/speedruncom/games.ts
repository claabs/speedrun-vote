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

export interface Moderators {
  [userId: string]: string;
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

export interface Link {
  rel: string;
  uri: string;
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

export interface Pagination {
  offset: number;
  max: number;
  size: number;
  links: Link[];
}

export interface GameResponse {
  data: GameData;
}

export interface GamesResponse {
  data: GameData[];
  pagination: Pagination;
}
