/* eslint-disable import/prefer-default-export */
import { JSDOM } from 'jsdom';
import got from 'got';
import L from '../logger';
import config from '../config';
import { GameResponse, ModLevel, GameData, modLevelOrder } from './types/speedruncom/games';
import { UserResponse } from './types/speedruncom/user';
import { PersonalBestResponse } from './types/speedruncom/personal-bests';
import { RunnerProof } from './types/poll/poll-data';
import { PagedResponse } from './types/speedruncom/common';
import { SelectOptions } from '../store';

async function paginateData<Data>(url: string): Promise<Data[]> {
  const limit = 200;
  const existingParams = Object.fromEntries(new URL(url).searchParams);
  const items = await got.paginate.all<Data, PagedResponse<Data>>(url, {
    responseType: 'json',
    searchParams: {
      ...existingParams,
      max: limit,
      offset: 0,
    },
    pagination: {
      transform: (response) => {
        return response.body.data;
      },
      paginate: (response, allItems, currentItems) => {
        const previousSearchParams = response.request.options.searchParams;
        const previousOffset = previousSearchParams?.get('offset') || new URLSearchParams();

        if (currentItems.length < limit) {
          return false;
        }

        return {
          searchParams: {
            ...previousSearchParams,
            offset: Number(previousOffset) + limit,
          },
        };
      },
    },
  });
  return items;
}

async function getDiscordNameFromProfile(srcUsername: string): Promise<string | null> {
  L.info(`Getting Discord display name for SRC user: ${srcUsername}`);
  const profileResp = await got.get(`https://speedrun.com/user/${srcUsername}`, {
    responseType: 'text',
  });
  const profileDocument = new JSDOM(profileResp.body).window.document;
  const discordImg = profileDocument.querySelector('img[src*=discord') as HTMLImageElement | null;
  if (!discordImg) return null;
  let displayName = discordImg.getAttribute('data-id');
  if (!displayName) return null;
  displayName = displayName.trim();
  L.info(`Got displayName: ${displayName}`);
  return displayName;
}

export async function checkDiscordUser(
  discordDisplayName: string,
  srcUser: string
): Promise<boolean> {
  L.info(`Verifying that srcUser ${srcUser} has ${discordDisplayName} on their profile`);
  const srcDiscordName = await getDiscordNameFromProfile(srcUser);
  if (!srcDiscordName) return false;
  return srcDiscordName === discordDisplayName;
}

export async function getUserId(username: string): Promise<string | null> {
  const userResp = await got.get<UserResponse>(
    `https://www.speedrun.com/api/v1/users/${username}`,
    {
      responseType: 'json',
    }
  );
  const { data } = userResp.body;
  if (!data) return null;
  return data.id;
}

async function isModerator(userId: string, game = config.defaultSrcGame): Promise<boolean> {
  const gameResp = await got.get<GameResponse>(`https://www.speedrun.com/api/v1/games/${game}`, {
    responseType: 'json',
  });
  return Object.keys(gameResp.body.data.moderators).includes(userId);
}

async function isRunner(userId: string, game = config.defaultSrcGame): Promise<boolean> {
  const gameResp = await got.get<PersonalBestResponse>(
    `https://www.speedrun.com/api/v1/users/${userId}/personal-bests?game=${game}`,
    {
      responseType: 'json',
    }
  );
  return gameResp.body.data.length > 0;
}

export async function getModeratedGames(
  srcId: string,
  minModLevel: ModLevel = 'super-moderator'
): Promise<SelectOptions[]> {
  const allowedModLevels = modLevelOrder.slice(modLevelOrder.indexOf(minModLevel));
  const fullGamesData = await paginateData<GameData>(
    `https://www.speedrun.com/api/v1/games?moderator=${srcId}`
  );
  const moderatedGames: SelectOptions[] = fullGamesData
    .filter((game) => {
      const modLevel = game.moderators[srcId];

      return Boolean(modLevel) && allowedModLevels.includes(modLevel);
    })
    .map((game) => ({ value: game.id, display: game.names.international }));
  return moderatedGames;
}

export async function runnerType(
  userId: string,
  game = config.defaultSrcGame
): Promise<RunnerProof> {
  const gameResp = await got.get<PersonalBestResponse>(
    `https://www.speedrun.com/api/v1/users/${userId}/personal-bests?game=${game}`,
    {
      responseType: 'json',
    }
  );
  if (gameResp.body.data.find((run) => run.run.videos !== null)) return RunnerProof.PROVEN_RUNNER;
  if (gameResp.body.data.length) return RunnerProof.RUNNER;
  return RunnerProof.OBSERVER;
}

export type SRCRole = 'RUNNER' | 'MODERATOR' | 'OBSERVER';

export async function checkGamesRole(
  userId: string,
  games = [config.defaultSrcGame]
): Promise<SRCRole> {
  const moderatorPromises = games.map(async (game) => isModerator(userId, game));
  const moderatorResults = await Promise.all(moderatorPromises);
  if (moderatorResults.includes(true)) return 'MODERATOR';
  const runnerPromises = games.map(async (game) => isRunner(userId, game));
  const runnerResults = await Promise.all(runnerPromises);
  if (runnerResults.includes(true)) return 'RUNNER';
  return 'OBSERVER';
}
