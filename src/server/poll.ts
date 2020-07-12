/* eslint-disable import/prefer-default-export */
import { v4 as uuid } from 'uuid';
import config from '../config';
import { getGuild, getVoteChannel } from '../store';
import { createPollMessage } from './bot';
import { CreatePollRequest, PollQuestion } from './types/poll/poll-data';

export async function createPoll(
  req: CreatePollRequest,
  game = config.defaultSrcGame
): Promise<void> {
  const guildId = getGuild(game);
  const voteChannelId = getVoteChannel(game);
  const poll: PollQuestion = {
    id: uuid(),
    question: req.pollQuestion,
    choices: req.options.filter((option) => option),
    multipleAllowed: false,
  };
  await createPollMessage(guildId, voteChannelId, poll);
}
