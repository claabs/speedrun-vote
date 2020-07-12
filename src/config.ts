import 'dotenv/config.js';

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

export default {
  baseUrl,
  port: Number(process.env.PORT) || 3000,
  logLevel: process.env.LOG_LEVEL || 'info',
  botToken: process.env.BOT_TOKEN || 'missing',
  discordClientId: process.env.DISCORD_CLIENT_ID || 'missing',
  discordClientSecret: process.env.DISCORD_CLIENT_SECRET || 'missing',
  discordCallback: `${baseUrl}/callback`,
  defaultServerId: process.env.DEFAULT_SERVER_ID || 'missing',
  voteChannelName: process.env.VOTE_CHANNEL_NAME || 'vote',
  color: process.env.COLOR,
  defaultSrcGame: process.env.DEFAULLT_SRC_GAME || 'mkw',
};
