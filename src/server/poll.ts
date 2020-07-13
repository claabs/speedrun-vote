import { v4 as uuid } from 'uuid';
import schedule from 'node-schedule';
import { createPollMessage, getPollResults } from './bot';
import {
  CreatePollRequest,
  PollQuestion,
  ChoiceResult,
  RawChoiceResult,
  ResultUser,
  RunnerProof,
} from './types/poll/poll-data';
import { getPollsData, getPoll, setPoll, getUser, getGuild } from '../store';
import { runnerType } from './speedruncom';
import L from '../logger';

interface CachedUser {
  [discordId: string]: ResultUser;
}
function makeResultUser(discordId: string, role: RunnerProof): ResultUser {
  const resultUser: ResultUser = {
    discordId,
    role,
  };
  return resultUser;
}

/**
 * This shit is fuckin wild
 * @param rawResults
 * @param games
 */
async function lookupResultUsers(
  rawResults: RawChoiceResult[],
  games: string[]
): Promise<ChoiceResult[]> {
  const userCache: CachedUser = {};
  const resultsPromises = rawResults.map(async (result) => {
    const usersPromises = result.map(
      async (user): Promise<ResultUser> => {
        const discordId = user.id;
        L.debug({ discordId }, 'Looking up SRC status');
        const cachedUser = userCache[discordId];
        if (cachedUser) return cachedUser;
        const dbUser = getUser(discordId);
        // TODO: This is onyl returning Observer
        if (!dbUser) {
          L.warn('Could not find user in database');
          const resultUser = makeResultUser(discordId, RunnerProof.OBSERVER);
          userCache[discordId] = resultUser;
          return resultUser;
        }
        const { srcId } = dbUser;
        if (!srcId) {
          L.warn('Could not find users SRC ID in database');
          const resultUser = makeResultUser(discordId, RunnerProof.OBSERVER);
          userCache[discordId] = resultUser;
          return resultUser;
        }
        const typePromises = games.map(async (game) => runnerType(srcId, game));
        const runnerTypes = await Promise.all(typePromises);
        const maxRole = runnerTypes.reduce((a, b) => Math.max(a, b));
        const resultUser = makeResultUser(discordId, maxRole);
        userCache[discordId] = resultUser;
        return resultUser;
      }
    );
    return Promise.all(usersPromises);
  });
  return Promise.all(resultsPromises);
}

export async function endPoll(id: string): Promise<void> {
  L.info({ id }, 'Ending poll');
  let poll = getPoll(id);
  if (!poll) throw new Error(`Could not find poll ${id} in database`);
  const { messageId } = poll;
  if (!messageId) throw new Error(`Cannot find messageId for poll ${id}`);
  const rawResults = await getPollResults(poll.guildId, messageId);
  const guild = getGuild(poll.guildId);
  if (!guild) throw new Error(`Could not get guild ${poll.guildId} from database`);
  L.debug('Looking up users on SRC');
  const refinedResults = await lookupResultUsers(rawResults, guild.games);
  poll = {
    ...poll,
    results: refinedResults,
  };
  setPoll(poll);
}

export async function createPoll(req: CreatePollRequest): Promise<void> {
  const endTime = new Date(req.endTime);
  let poll: PollQuestion = {
    id: uuid(),
    question: req.pollQuestion,
    choices: req.options.filter((option) => option),
    multipleAllowed: false,
    endTime: endTime.toISOString(), // turn into full length date string
    guildId: req.guildId,
  };
  const messageId = await createPollMessage(poll);
  L.debug({ messageId }, 'Created poll');
  poll = {
    ...poll,
    messageId,
  };
  setPoll(poll);
  L.debug({ endTime }, 'Scheduling poll end');
  schedule.scheduleJob(poll.id, endTime, () => endPoll(poll.id)); // TODO: This doesn't use UTC, soooo
}

export async function schedulePollEndings(): Promise<void> {
  const polls = getPollsData();
  Object.values(polls).forEach((poll) => {
    const endDate = new Date(poll.endTime);
    if (endDate > new Date()) {
      schedule.scheduleJob(poll.id, endDate, () => endPoll(poll.id)); // TODO: This doesn't use UTC, soooo
    }
  });
}
