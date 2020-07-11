import discordjs, { TextChannel, MessageEmbed, OverwriteData, Role, Guild } from 'discord.js';
import config from '../config';
import L from '../logger';
import { ChoiceResult, PollQuestion } from './poll';

const client = new discordjs.Client();
const EMOJI_SUFFIX = '\uFE0F\u20E3';

export async function login(): Promise<void> {
  await client.login(config.botToken);
}

export async function getInviteLink(): Promise<string> {
  const link = await client.generateInvite([
    'MANAGE_ROLES',
    'MANAGE_CHANNELS',
    'READ_MESSAGE_HISTORY',
    'SEND_MESSAGES',
    'EMBED_LINKS',
    'ADD_REACTIONS',
    'VIEW_CHANNEL',
  ]);
  return link;
}

function findVoteChannel(guildId: string): TextChannel {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) throw new Error('Cannot get guild');
  const botMember = guild.me;
  if (!botMember) throw new Error('Bot not in this guild');

  const voteChannel = guild.channels.cache.find((channel) => channel.name === 'vote');
  if (!voteChannel) throw new Error(`No vote channel in guild ${guild.name}`);
  const permission = voteChannel.permissionsFor(botMember);
  if (!(voteChannel.type === 'text' && permission && Boolean(permission.has('SEND_MESSAGES'))))
    throw new Error(`Vote channel not text channel that bot can send to`);
  return voteChannel as TextChannel;
}

function numberToEmoji(num: number): string {
  if (num < 0 || num >= 10) throw new Error('Cannot convert number to emoji');
  const int = num.toFixed(0);
  return `${int}${EMOJI_SUFFIX}`;
}

function emojiToNumber(emoji: string): number | null {
  if (!emoji.endsWith(EMOJI_SUFFIX)) return null;
  return Number.parseInt(emoji[0], 10);
}

export async function createPollMessage(
  guildId: string,
  pollQuestion: PollQuestion
): Promise<string> {
  L.info({ pollQuestion }, 'Creating poll message');
  const voteChannel = findVoteChannel(guildId);

  const embedMessage = new MessageEmbed();
  if (config.color) embedMessage.setColor(config.color);
  embedMessage.addField('Topic', pollQuestion.question);
  pollQuestion.choices.forEach((choice, index) => {
    embedMessage.addField(numberToEmoji(index + 1), choice);
  });
  const voteMessage = await voteChannel.send(embedMessage);
  const reactPromises = pollQuestion.choices.map((_choice, index) => {
    return voteMessage.react(numberToEmoji(index + 1));
  });
  await Promise.all(reactPromises); // Might need to make this a `for in` loop to not randomly shuffle the reacts
  return voteMessage.id;
}

export async function getPollResults(guildId: string, messageId: string): Promise<ChoiceResult[]> {
  L.info({ messageId }, 'Getting poll results');
  const voteChannel = findVoteChannel(guildId);
  const voteMessage = await voteChannel.messages.fetch(messageId);
  const reactions = voteMessage.reactions.cache.values();
  const choiceResults: ChoiceResult[] = [];
  Array.from(reactions).forEach((react) => {
    const number = emojiToNumber(react.emoji.toString());
    if (!number) return;
    const users = react.users.cache.values();
    choiceResults[number - 1] = Array.from(users);
  });
  return choiceResults;
}

async function initChannel(guild: Guild, runnerRole: Role): Promise<TextChannel> {
  const overwrites: OverwriteData[] = [
    {
      id: guild.roles.everyone,
      deny: ['ADD_REACTIONS', 'SEND_MESSAGES', 'USE_EXTERNAL_EMOJIS', 'VIEW_CHANNEL'],
    },
    {
      id: runnerRole,
      allow: ['SEND_MESSAGES'],
    },
  ];
  L.info(`Creating vote channel in guild: ${guild.id}`);
  const voteChannel = await guild.channels.create(config.voteChannelName, {
    type: 'text',
    topic: 'Vote on community polls',
    permissionOverwrites: overwrites,
    reason: 'Initializing speedrun vote channels',
  });
  return voteChannel;
}

async function initRole(guild: Guild): Promise<Role> {
  L.info(`Creating runner role in guild: ${guild.id}`);
  const runnerRole = await guild.roles.create({
    data: {
      name: 'Runner',
      mentionable: false,
      color: config.color,
    },
    reason: 'Initializing speedrun vote roles',
  });
  return runnerRole;
}

export interface InitServerResp {
  runnerRoleId: string;
  voteChannelId: string;
}

export async function initServer(guildId: string): Promise<InitServerResp> {
  L.info(`Initializing guild: ${guildId}`);
  const guild = client.guilds.cache.get(guildId);
  if (!guild) throw new Error('Cannot get guild');
  const role = await initRole(guild);
  const voteChannel = await initChannel(guild, role);
  return {
    runnerRoleId: role.id,
    voteChannelId: voteChannel.id,
  };
}
