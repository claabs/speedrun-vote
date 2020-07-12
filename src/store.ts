/* eslint-disable no-underscore-dangle */
import fs from 'fs';
import path from 'path';
import type { Profile } from 'passport-discord';
import type { PollQuestion } from './server/types/poll/poll-data';
import type { SRCRole } from './server/speedruncom';

export interface Users {
  [discordId: string]: UserData;
}

export interface UserData {
  srcUsername?: string;
  id: string;
  username: string;
  discriminator: string;
  games: GameRole;
}

export interface GameRole {
  [gameId: string]: SRCRole;
}

export interface Guilds {
  [guildId: string]: GuildData;
}

export interface GuildData {
  id: string;
  games: string[];
  polls: PollStore[];
  runnerRoleId?: string;
  voteChannelId?: string;
}

export interface PollStore extends PollQuestion {
  completed: boolean;
}

const guildsFile = path.join('config', 'guilds.json');
const usersFile = path.join('config', 'users.json');
fs.mkdirSync('config', { recursive: true });

function getGuildsData(filename: string): Guilds {
  let data: Guilds = {};
  if (fs.existsSync(filename)) {
    const file = fs.readFileSync(filename, 'utf8');
    data = JSON.parse(file);
  }
  return data;
}

function getUsersData(filename: string): Users {
  let data: Users = {};
  if (fs.existsSync(filename)) {
    const file = fs.readFileSync(filename, 'utf8');
    data = JSON.parse(file);
  }
  return data;
}

export function setUser(user: UserData): void {
  const data = getUsersData(usersFile);
  data[user.id] = user;
  fs.writeFileSync(usersFile, JSON.stringify(data), 'utf8');
}

export function getUser(discordId: string): UserData | undefined {
  const data = getUsersData(usersFile);
  return data[discordId];
}

export function createUser(profile: Profile): UserData {
  const data = getUsersData(usersFile);
  const user: UserData = {
    id: profile.id,
    username: profile.username,
    discriminator: profile.discriminator,
    games: {},
  };
  data[profile.id] = user;
  fs.writeFileSync(usersFile, JSON.stringify(data), 'utf8');
  return user;
}

export function createGuild(guildId: string, games: string[]): GuildData {
  const data = getGuildsData(guildsFile);
  const record: GuildData = {
    id: guildId,
    games,
    polls: [],
  };
  data[guildId] = record;
  fs.writeFileSync(guildsFile, JSON.stringify(data), 'utf8');
  return record;
}

export function storeRole(guildId: string, roleId: string): void {
  const data = getGuildsData(guildsFile);
  data[guildId].runnerRoleId = roleId;
  fs.writeFileSync(guildsFile, JSON.stringify(data), 'utf8');
}

export function getRole(guildId: string): string | undefined {
  const data = getGuildsData(guildsFile);
  return data[guildId].runnerRoleId;
}

export function setGuild(record: GuildData): void {
  const data = getGuildsData(guildsFile);
  data[record.id] = record;
  fs.writeFileSync(guildsFile, JSON.stringify(data), 'utf8');
}

export function getGuild(guildId: string): GuildData | undefined {
  const data = getGuildsData(guildsFile);
  return data[guildId];
}

export function storeVoteChannel(guildId: string, channelId: string): void {
  const data = getGuildsData(guildsFile);
  data[guildId].voteChannelId = channelId;
  fs.writeFileSync(guildsFile, JSON.stringify(data), 'utf8');
}

export function getVoteChannel(guildId: string): string | undefined {
  const data = getGuildsData(guildsFile);
  return data[guildId].voteChannelId;
}
