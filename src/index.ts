import 'source-map-support/register';
import config from './config';
import { initServer, getInviteLink, login } from './server/bot';
import L from './logger';

async function main() {
  try {
    await login();
    const link = await getInviteLink();
    L.info({ link }, 'Invite link');
    const guildId = config.defaultServerId;
    await initServer(guildId);
  } catch (err) {
    L.error(err);
  }
}

main();
