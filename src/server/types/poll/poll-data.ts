import { User } from 'discord.js';

export interface PollQuestion {
  id: string;
  question: string;
  choices: string[];
  multipleAllowed: boolean;
}

export interface PollResult {
  /**
   * Ordered array of user lists
   */
  choiceResults: ChoiceResult[];
  pollQuestion: PollQuestion;
}
/**
 * List of users that voted for this option
 */

export type ChoiceResult = User[];

export interface CreatePollRequest {
  srcGame: string;
  pollQuestion: string;
  options: string[];
}
