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
  srcId?: string;
  id: string;
  username: string;
  discriminator: string;
  games: GameRole;
  moderatedGames: SelectOptions[];
}

export interface SelectOptions {
  value: string;
  display: string;
}

export interface GameRole {
  [gameId: string]: SRCRole;
}

export interface Guilds {
  [guildId: string]: GuildData;
}

export interface GuildData {
  id: string;
  name?: string;
  games: string[];
  polls: string[];
  runnerRoleId?: string;
  voteChannelId?: string;
}

export interface Polls {
  [id: string]: PollQuestion;
}

const guildsFile = path.join('config', 'guilds.json');
const usersFile = path.join('config', 'users.json');
const pollsFile = path.join('config', 'polls.json');
fs.mkdirSync('config', { recursive: true });

export function getGuildsData(filename = guildsFile): Guilds {
  let data: Guilds = {};
  if (fs.existsSync(filename)) {
    const file = fs.readFileSync(filename, 'utf8');
    data = JSON.parse(file);
  }
  return data;
}

function getUsersData(filename = usersFile): Users {
  let data: Users = {};
  if (fs.existsSync(filename)) {
    const file = fs.readFileSync(filename, 'utf8');
    data = JSON.parse(file);
  }
  return data;
}

export function getPollsData(filename = pollsFile): Polls {
  let data: Polls = {};
  if (fs.existsSync(filename)) {
    const file = fs.readFileSync(filename, 'utf8');
    data = JSON.parse(file);
  }
  return data;
}

export function setUser(user: UserData): void {
  const data = getUsersData();
  data[user.id] = user;
  fs.writeFileSync(usersFile, JSON.stringify(data), 'utf8');
}

export function getUser(discordId: string): UserData | undefined {
  const data = getUsersData();
  return data[discordId];
}

export function createUser(profile: Profile): UserData {
  const data = getUsersData();
  const user: UserData = {
    id: profile.id,
    username: profile.username,
    discriminator: profile.discriminator,
    games: {},
    moderatedGames: [],
  };
  data[profile.id] = user;
  fs.writeFileSync(usersFile, JSON.stringify(data), 'utf8');
  return user;
}

export function createGuild(guildId: string, games: string[]): GuildData {
  const data = getGuildsData();
  const existingGuild = data[guildId] as GuildData | undefined;
  const record: GuildData = {
    polls: [],
    ...existingGuild,
    id: guildId,
    games,
  };
  data[guildId] = record;
  fs.writeFileSync(guildsFile, JSON.stringify(data), 'utf8');
  return record;
}

export function storeRole(guildId: string, roleId: string): void {
  const data = getGuildsData();
  data[guildId].runnerRoleId = roleId;
  fs.writeFileSync(guildsFile, JSON.stringify(data), 'utf8');
}

export function getRole(guildId: string): string | undefined {
  const data = getGuildsData();
  return data[guildId]?.runnerRoleId;
}

export function setGuild(record: GuildData): void {
  const data = getGuildsData();
  data[record.id] = record;
  fs.writeFileSync(guildsFile, JSON.stringify(data), 'utf8');
}

export function getGuild(guildId: string): GuildData | undefined {
  const data = getGuildsData();
  return data[guildId];
}

export function storeVoteChannel(guildId: string, channelId: string): void {
  const data = getGuildsData();
  data[guildId].voteChannelId = channelId;
  fs.writeFileSync(guildsFile, JSON.stringify(data), 'utf8');
}

export function getVoteChannel(guildId: string): string | undefined {
  const data = getGuildsData();
  return data[guildId]?.voteChannelId;
}

export function storeGuildName(guildId: string, name: string): void {
  const data = getGuildsData();
  data[guildId].name = name;
  fs.writeFileSync(guildsFile, JSON.stringify(data), 'utf8');
}

export function getGuildName(guildId: string): string | undefined {
  const data = getGuildsData();
  return data[guildId]?.name;
}

export function createPoll(poll: PollQuestion): PollQuestion {
  const data = getPollsData();
  data[poll.id] = poll;
  fs.writeFileSync(pollsFile, JSON.stringify(data), 'utf8');
  return poll;
}

export function getPoll(pollId: string): PollQuestion | undefined {
  const data = getPollsData();
  return data[pollId];
}

export function setPoll(poll: PollQuestion): void {
  const data = getPollsData();
  data[poll.id] = poll;
  fs.writeFileSync(pollsFile, JSON.stringify(data), 'utf8');
}
