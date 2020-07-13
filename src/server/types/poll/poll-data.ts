import { User } from 'discord.js';

export interface PollQuestion {
  id: string;
  question: string;
  choices: string[];
  multipleAllowed: boolean;
  endTime: string;
  guildId: string;
  messageId?: string;
  results?: PollResult;
}

/**
 * Ordered list of reactions
 */
export type PollResult = ChoiceResult[];

/**
 * List of users that voted for this option
 */
export type RawChoiceResult = User[];

export type ChoiceResult = ResultUser[];

export enum RunnerProof {
  OBSERVER,
  RUNNER,
  PROVEN_RUNNER,
}

export interface ResultUser {
  discordId: string;
  role: RunnerProof;
}

export interface CreatePollRequest {
  endTime: string;
  guildId: string;
  pollQuestion: string;
  options: string[];
}
