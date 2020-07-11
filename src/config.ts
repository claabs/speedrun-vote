import 'dotenv/config.js';

export default {
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  port: Number(process.env.PORT) || 3000,
  logLevel: process.env.LOG_LEVEL || 'info',
  botToken: process.env.BOT_TOKEN || 'missing',
  defaultServerId: process.env.DEFAULT_SERVER_ID || 'missing',
  voteChannelName: process.env.VOTE_CHANNEL_NAME || 'vote',
  color: process.env.COLOR,
};
