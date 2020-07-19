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
import { PollQuestion, RawChoiceResult } from './types/poll/poll-data';
import {
  storeRole,
  storeVoteChannel,
  getGuild,
  getRole,
  getVoteChannel,
  getUser,
  getGuildName,
  storeGuildName,
} from '../store';
import { checkGamesRole } from './speedruncom';

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
  const voteChannelId = getVoteChannel(guildId);
  if (!voteChannelId) throw new Error(`Guild ${guildId} does not have a channel in the database`);
  const voteChannel = guild.channels.cache.find((channel) => channel.id === voteChannelId);
  if (!voteChannel) throw new Error('Could not find vote channel');
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

export async function createPollMessage(pollQuestion: PollQuestion): Promise<string> {
  L.info({ pollQuestion }, 'Creating poll message');
  const voteChannel = findVoteChannel(pollQuestion.guildId);

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

export async function getPollResults(
  guildId: string,
  messageId: string
): Promise<RawChoiceResult[]> {
  L.info({ messageId }, 'Getting poll results');
  const voteChannel = findVoteChannel(guildId);
  const voteMessage = await voteChannel.messages.fetch(messageId);
  const reactions = voteMessage.reactions.cache.values();
  const choiceResults: RawChoiceResult[] = [];
  Array.from(reactions).forEach((react) => {
    const number = emojiToNumber(react.emoji.toString());
    if (!number) return;
    const users = react.users.cache.values();
    choiceResults[number - 1] = Array.from(users);
  });
  return choiceResults;
}

function channelExists(guild: Guild): TextChannel | false {
  const channelId = getVoteChannel(guild.id);
  if (!channelId) return false;
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
  const roleId = getRole(guild.id);
  if (!roleId) return false;
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
    storeRole(guildId, role.id);
  }
  let voteChannel = channelExists(guild);
  if (!voteChannel) {
    voteChannel = await initChannel(guild, role);
    storeVoteChannel(guildId, voteChannel.id);
  }
  let guildName = getGuildName(guildId);
  if (!guildName) {
    guildName = guild.name;
    storeGuildName(guildId, guildName);
  }
  // TODO: Check all existing users against server members and grant role
  return {
    runnerRoleId: role.id,
    voteChannelId: voteChannel.id,
  };
}

export function findCommonGuilds(userId: string): string[] {
  const guilds = client.guilds.cache.array();
  const filteredGuilds = guilds.filter((guild) => guild.member(userId)).map((guild) => guild.id);
  return filteredGuilds;
}

export async function giveRoles(discordUserId: string): Promise<void> {
  const userData = getUser(discordUserId);
  if (!userData) throw new Error(`User ${discordUserId} not in database`);
  const { srcId } = userData;
  if (!srcId) throw new Error(`User ${discordUserId} has no SRC username`);
  const guildIds = findCommonGuilds(discordUserId);
  if (!guildIds.length) throw new Error(`User ${discordUserId} has no common guilds with bot`);
  const giveRolePromises = guildIds.map(async (guildId) => {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) throw new Error('Cannot get guild');
    const guildData = getGuild(guildId);
    if (!guildData) throw new Error(`Guild ${guildId} not in database`);
    // TODO: Check user's SRC status. Reject if 'OBSERVER'
    const srcRole = await checkGamesRole(srcId, guildData.games);
    if (srcRole === 'OBSERVER') return;
    const roleId = guildData.runnerRoleId;
    if (!roleId) throw new Error('Guild data missing role');
    const user = await guild.members.fetch({
      user: discordUserId,
    });
    await user.roles.add(roleId);
  });
  await Promise.all(giveRolePromises);
}
