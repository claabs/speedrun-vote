import discordjs, {
  TextChannel,
  MessageEmbed,
  OverwriteData,
  Role,
  Guild,
  Permissions,
  PermissionResolvable,
} from 'discord.js';
import config from '../config';
import L from '../logger';
import { ChoiceResult, PollQuestion } from './types/poll/poll-data';
import { storeRole, storeVoteChannel, getGuild, getRole, getVoteChannel } from '../store';

const client = new discordjs.Client();
const EMOJI_SUFFIX = '\uFE0F\u20E3';
const PERMISSIONS: PermissionResolvable[] = [
  'MANAGE_ROLES',
  'MANAGE_CHANNELS',
  'READ_MESSAGE_HISTORY',
  'SEND_MESSAGES',
  'EMBED_LINKS',
  'ADD_REACTIONS',
  'VIEW_CHANNEL',
];

export async function login(): Promise<void> {
  await client.login(config.botToken);
}

export async function getInviteLink(): Promise<string> {
  const link = await client.generateInvite(PERMISSIONS);
  return link;
}

export function getPermissionsNumber(): number {
  return Permissions.resolve(PERMISSIONS);
}

function findVoteChannel(guildId: string): TextChannel {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) throw new Error('Cannot get guild');
  const botMember = guild.me;
  if (!botMember) throw new Error('Bot not in this guild');
  const voteChannel = guild.channels.cache.find((channel) => channel.id === 'vote');
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
  voteChannelId: string,
  pollQuestion: PollQuestion
): Promise<string> {
  L.info({ pollQuestion }, 'Creating poll message');
  // const voteChannel = findVoteChannel(guildId);
  const guild = client.guilds.cache.get(guildId);
  if (!guild) throw new Error('Cannot get guild');
  const voteChannel = guild.channels.cache.find((channel) => channel.id === voteChannelId);
  if (!voteChannel) throw new Error('Could not find vote channel');

  const embedMessage = new MessageEmbed();
  if (config.color) embedMessage.setColor(config.color);
  embedMessage.addField('Topic', pollQuestion.question);
  pollQuestion.choices.forEach((choice, index) => {
    embedMessage.addField(numberToEmoji(index + 1), choice);
  });
  const voteMessage = await (voteChannel as TextChannel).send(embedMessage);
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

function channelExists(guild: Guild): TextChannel | false {
  const channelId = getVoteChannel();
  const existingChannel = guild.channels.cache.find((channel) => channel.id === channelId);
  return (existingChannel as TextChannel) || false;
}

async function initChannel(guild: Guild, runnerRole: Role): Promise<TextChannel> {
  const { me } = guild;
  if (!me) throw new Error('Cannot find me?');
  const overwrites: OverwriteData[] = [
    {
      id: guild.roles.everyone,
      deny: ['ADD_REACTIONS', 'SEND_MESSAGES', 'VIEW_CHANNEL'],
    },
    {
      id: runnerRole,
      allow: ['VIEW_CHANNEL'],
    },
    {
      id: me,
      allow: ['SEND_MESSAGES', 'VIEW_CHANNEL', 'ADD_REACTIONS'],
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

async function roleExists(guild: Guild): Promise<Role | false> {
  const roleId = getRole();
  const existingRole = await guild.roles.fetch(roleId);
  return existingRole || false;
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
  let role = await roleExists(guild);
  if (!role) {
    role = await initRole(guild);
    storeRole(role.id);
  }
  let voteChannel = channelExists(guild);
  if (!voteChannel) {
    voteChannel = await initChannel(guild, role);
    storeVoteChannel(voteChannel.id);
  }
  return {
    runnerRoleId: role.id,
    voteChannelId: voteChannel.id,
  };
}

export async function giveSpeedrunRole(
  discordUserId: string,
  game = config.defaultSrcGame
): Promise<void> {
  const guildId = getGuild(game);
  const guild = client.guilds.cache.get(guildId);
  if (!guild) throw new Error('Cannot get guild');
  const runnerRoleId = getRole(game);
  if (!runnerRoleId) throw new Error('Cannot get role');
  const user = await guild.members.fetch({
    user: discordUserId,
  });
  await user.roles.add(runnerRoleId);
}
