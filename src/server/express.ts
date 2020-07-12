import express, { Request, Response, NextFunction } from 'express';
import passport, { AuthenticateOptions } from 'passport';
import { Strategy, Profile } from 'passport-discord';
import session from 'express-session';
import FileStore from 'session-file-store';
import path from 'path';
import { VerifyCallback } from 'passport-oauth2';
import config from '../config';
import L from '../logger';
import { storeUser, storeSrcUser, VoteUserData, storeGuildId } from '../store';
import { checkDiscordUser } from './speedruncom';
import { giveSpeedrunRole, getPermissionsNumber } from './bot';

interface DiscordAuthenticateOptions extends AuthenticateOptions {
  permissions?: number;
  prompt?: string;
}

function saveSrcUser(req: Request, res: Response, next: NextFunction) {
  if (req.session) {
    const srcUser = req.query['src-username'];
    L.debug(`Writing speedrun.com user ${srcUser} to session`);
    req.session.srcUser = srcUser;
  }
  next();
}

function saveSrcGame(req: Request, res: Response, next: NextFunction) {
  if (req.session) {
    const srcGame = req.query['src-game'];
    L.debug(`Writing speedrun.com game ${srcGame} to session`);
    req.session.srcGame = srcGame;
  }
  next();
}

function checkBotCallback(req: Request, res: Response, next: NextFunction) {
  if (req.session) {
    const guildId = req.query.guild_id;
    const { srcGame } = req.session;
    if (guildId && srcGame) {
      L.info(`Writing guild to game database`);
      storeGuildId(guildId as string, srcGame as string);
      // TODO: run initServer here
    }
  }
  next();
}

export interface SessionDiscordInfo {
  displayName: string;
  id: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSessionDiscordInfo(sessionData: Record<string, any>): SessionDiscordInfo {
  const passportData = sessionData.passport;
  if (!passportData) throw new Error('Missing passport in session');
  const { user } = passportData;
  if (!user) throw new Error('Missing user in session');
  const { username } = user;
  if (!user) throw new Error('Missing username in session');
  const { discriminator } = user;
  if (!user) throw new Error('Missing discriminator in session');
  const { id } = user;
  if (!id) throw new Error('Missing id in session');
  return {
    displayName: `${username}#${discriminator}`,
    id,
  };
}

const development = process.env.NODE_ENV !== 'production';

const app = express();
const router = express.Router();

const SessionStore = FileStore(session);

router.use(
  session({
    store: new SessionStore({
      path: './config/sessions',
      retries: 1,
    }),
    secret: 'siglemic',
    resave: false,
    saveUninitialized: true,
  })
);

router.use(passport.initialize());
router.use(passport.session());

// Set up passport
passport.serializeUser((user: VoteUserData, done) => {
  done(null, user);
});
passport.deserializeUser((user: string, done) => {
  done(null, user);
});

if (development) {
  router.use(
    express.static(path.join(__dirname, '..', 'site'), { index: false, extensions: ['html'] })
  );
} else {
  router.use(express.static('public'));
}
router.use(express.json());

passport.use(
  new Strategy(
    {
      clientID: config.discordClientId,
      clientSecret: config.discordClientSecret,
      callbackURL: config.discordCallback,
    },
    (accessToken: string, refreshToken: string, profile: Profile, cb: VerifyCallback) => {
      cb(null, storeUser(profile));
    }
  )
);

router.get(
  '/auth',
  saveSrcUser,
  passport.authenticate('discord', {
    scope: 'identify',
  })
);

router.get(
  '/invite',
  saveSrcGame,
  passport.authenticate('discord', {
    permissions: getPermissionsNumber(),
    scope: ['bot'],
  } as AuthenticateOptions)
);
router.get(
  '/callback',
  checkBotCallback,
  passport.authenticate('discord', {
    failureRedirect: '/failure',
    successRedirect: '/link',
  })
);

// TODO: This can probably just be a middleware after the callback authenticate?
router.get('/link', async (req, res) => {
  if (!req.session) throw new Error('Missing session');
  const { srcUser } = req.session;
  if (!srcUser) throw new Error('Missing srcUser for session');
  const discordInfo = getSessionDiscordInfo(req.session);
  if (await checkDiscordUser(discordInfo.displayName, srcUser)) {
    storeSrcUser(discordInfo.id, srcUser);
    giveSpeedrunRole(discordInfo.id);
    res.redirect('/success');
  }
  res.redirect('/failure');
});

router.post('/poll', async (req, res) => {
  L.debug({ body: req.body }, 'incoming POST body');
  res.status(200).send();
});

const baseUrl = new URL(config.baseUrl);
const basePath = baseUrl.pathname;

app.use(basePath, router);

app.listen(config.port);
