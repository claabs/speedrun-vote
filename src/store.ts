/* eslint-disable no-underscore-dangle */
import fs from 'fs';
import path from 'path';
import { Profile } from 'passport-discord';
import config from './config';

export interface VoteUserData {
  srcUsername?: string;
  id: string;
  username: string;
  discriminator: string;
}

export interface UserList {
  [discordId: string]: VoteUserData;
}

export interface GameData {
  users: UserList;
  guildId?: string;
  runnerRoleId?: string;
  voteChannelId?: string;
}

const gamesPath = path.join('config', 'games');
fs.mkdirSync(gamesPath, { recursive: true });

function getData(filename: string): GameData {
  let data: GameData = { users: {} };
  if (fs.existsSync(filename)) {
    const file = fs.readFileSync(filename, 'utf8');
    data = JSON.parse(file);
  }
  return data;
}

// eslint-disable-next-line import/prefer-default-export
export function storeUser(profile: Profile, game = config.defaultSrcGame): VoteUserData {
  const filename = path.join(gamesPath, `${game}.json`);
  const data = getData(filename);
  const user: VoteUserData = {
    id: profile.id,
    username: profile.username,
    discriminator: profile.discriminator,
  };
  data.users[profile.id] = user;
  fs.writeFileSync(filename, JSON.stringify(data), 'utf8');
  return user;
}

export function storeSrcUser(
  discordId: string,
  srcUser: string,
  game = config.defaultSrcGame
): void {
  const filename = path.join(gamesPath, `${game}.json`);
  const data = getData(filename);
  data.users[discordId].srcUsername = srcUser;
  fs.writeFileSync(filename, JSON.stringify(data), 'utf8');
}

export function storeRole(roleId: string, game = config.defaultSrcGame): void {
  const filename = path.join(gamesPath, `${game}.json`);
  const data = getData(filename);
  data.runnerRoleId = roleId;
  fs.writeFileSync(filename, JSON.stringify(data), 'utf8');
}

export function getRole(game = config.defaultSrcGame): string {
  const filename = path.join(gamesPath, `${game}.json`);
  const data = getData(filename);
  return data.runnerRoleId || '';
}

export function storeGuildId(guildId: string, game = config.defaultSrcGame): void {
  const filename = path.join(gamesPath, `${game}.json`);
  const data = getData(filename);
  data.guildId = guildId;
  fs.writeFileSync(filename, JSON.stringify(data), 'utf8');
}

export function getGuild(game = config.defaultSrcGame): string {
  const filename = path.join(gamesPath, `${game}.json`);
  const data = getData(filename);
  return data.guildId || '';
}

export function storeVoteChannel(channelId: string, game = config.defaultSrcGame): void {
  const filename = path.join(gamesPath, `${game}.json`);
  const data = getData(filename);
  data.voteChannelId = channelId;
  fs.writeFileSync(filename, JSON.stringify(data), 'utf8');
}
