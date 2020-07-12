/* eslint-disable import/prefer-default-export */
import { v4 as uuid } from 'uuid';
import { getVoteChannel } from '../store';
import { createPollMessage } from './bot';
import { CreatePollRequest, PollQuestion } from './types/poll/poll-data';

export async function createPoll(req: CreatePollRequest): Promise<void> {
  const voteChannelId = getVoteChannel(req.guildId);
  if (!voteChannelId)
    throw new Error(`Guild ${req.guildId} does not have a channel in the database`);
  const poll: PollQuestion = {
    id: uuid(),
    question: req.pollQuestion,
    choices: req.options.filter((option) => option),
    multipleAllowed: false,
  };
  await createPollMessage(req.guildId, voteChannelId, poll);
}
