import 'source-map-support/register';
import { getInviteLink, login } from './server/bot';
import './server/express';
import L from './logger';
import { schedulePollEndings } from './server/poll';

async function main() {
  try {
    await login();
    const link = await getInviteLink();
    L.info({ link }, 'Invite link');
    schedulePollEndings();
    // const guildId = config.defaultServerId;
    // await initServer(guildId);
  } catch (err) {
    L.error(err);
  }
}

main();
