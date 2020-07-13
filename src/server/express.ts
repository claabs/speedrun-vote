import express, { Request, Response, NextFunction } from 'express';
import passport, { AuthenticateOptions } from 'passport';
import { Strategy, Profile } from 'passport-discord';
import session from 'express-session';
import FileStore from 'session-file-store';
import path from 'path';
import { VerifyCallback } from 'passport-oauth2';
import config from '../config';
import L from '../logger';
import { UserData, createUser, getUser, setUser, createGuild } from '../store';
import { checkDiscordUser, getUserId } from './speedruncom';
import { giveRoles, getPermissionsNumber, initServer } from './bot';
import { createPoll } from './poll';
import { CreatePollRequest } from './types/poll/poll-data';

// TODO: Add this to @types/passport-discord
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
    const { srcGame } = req.query;
    L.debug(`Writing speedrun.com games ${srcGame} to session`);
    req.session.srcGame = srcGame;
  }
  next();
}

async function handleDiscordCallback(req: Request, res: Response, next: NextFunction) {
  const guildId = req.query.guild_id;
  if (guildId) {
    if (!req.session) throw new Error('No session found');
    const { srcGame } = req.session;
    if (guildId && srcGame.length) {
      L.info(`Writing guild to game database`);
      createGuild(guildId as string, srcGame);
      await initServer(guildId as string);
      passport.authenticate('discord', {
        successRedirect: '/success-bot',
        failureRedirect: '/failure',
      })(req, res, next);
    }
  } else {
    passport.authenticate('discord', {
      successRedirect: '/link',
      failureRedirect: '/failure',
    })(req, res, next);
  }
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
passport.serializeUser((user: UserData, done) => {
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
// router.use(express.json());
router.use(express.urlencoded({ extended: true }));

passport.use(
  new Strategy(
    {
      clientID: config.discordClientId,
      clientSecret: config.discordClientSecret,
      callbackURL: config.discordCallback,
    },
    (accessToken: string, refreshToken: string, profile: Profile, cb: VerifyCallback) => {
      cb(null, createUser(profile));
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
router.get('/callback', handleDiscordCallback);

// TODO: This can probably just be a middleware after the callback authenticate?
router.get('/link', async (req, res) => {
  if (!req.session) throw new Error('Missing session');
  const { srcUser } = req.session;
  // TODO: We fail here on the invite callback cause we're missing session data. Should use a middleware instead?
  if (!srcUser) throw new Error('Missing srcUser for session');
  const discordInfo = getSessionDiscordInfo(req.session);
  if (await checkDiscordUser(discordInfo.displayName, srcUser)) {
    const user = getUser(discordInfo.id);
    if (!user) throw new Error(`Cannot find user ${discordInfo.id}`);
    const srcId = await getUserId(srcUser);
    if (!srcId) throw new Error(`Cannot get speedrun.com userId for username ${srcUser}`);
    user.srcId = srcId;
    user.srcUsername = srcUser;
    setUser(user);
    giveRoles(discordInfo.id);
    res.redirect('/success');
  } else {
    res.redirect('/failure');
  }
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
router.post<any, any, CreatePollRequest, any>('/poll', async (req, res) => {
  // TODO: Validate that the user is moderator in the guild it is starting a poll for
  L.debug({ body: req.body }, 'incoming new poll body');
  await createPoll(req.body);
  res.status(200).send(); // TODO: Make this a page
});

const baseUrl = new URL(config.baseUrl);
const basePath = baseUrl.pathname;

// TODO: Error handler for all the errors I throw
app.use(basePath, router);

app.listen(config.port);
