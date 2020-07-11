import pino from 'pino';
import config from './config';

const logger = pino({
  prettyPrint: {
    translateTime: `SYS:standard`,
  },
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  level: config.logLevel,
});

export default logger;
