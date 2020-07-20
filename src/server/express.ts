import express, { Request, Response, NextFunction } from 'express';
import passport, { AuthenticateOptions } from 'passport';
import { Strategy, Profile } from 'passport-discord';
import session from 'express-session';
import FileStore from 'session-file-store';
import path from 'path';
import { VerifyCallback } from 'passport-oauth2';
import helmet from 'helmet';
import 'ejs';
import config from '../config';
import L from '../logger';
import {
  UserData,
  createUser,
  getUser,
  setUser,
  createGuild,
  getPoll,
  SelectOptions,
  getGuildsData,
  getGuild,
} from '../store';
import { checkDiscordUser, getUserId, getModeratedGames } from './speedruncom';
import { giveRoles, getPermissionsNumber, initServer } from './bot';
import { createPoll } from './poll';
import { CreatePollRequest } from './types/poll/poll-data';

// TODO: Add this to @types/passport-discord
interface DiscordAuthenticateOptions extends AuthenticateOptions {
  permissions?: number;
  prompt?: string;
}

function getSessionDiscordId(req: Request): string {
  const discordId = req.session?.passport?.user?.id;
  if (!discordId) throw new Error('Cannot get Discord ID from session');
  return discordId;
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
    const srcGames = req.query.srcGame as string[];
    L.debug(`Writing speedrun.com games ${srcGames} to session`);
    const discordId = getSessionDiscordId(req);
    const userData = getUser(discordId);
    if (!userData) throw new Error(`Could not find user: ${discordId}`);
    const allowed = srcGames.every((srcGame) =>
      userData.moderatedGames.map((game) => game.value).includes(srcGame)
    );
    if (allowed) {
      req.session.srcGame = srcGames;
      next();
    } else {
      res.status(403).send();
    }
  } else {
    res.status(403).send();
  }
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

export interface DashboardData {
  games: SelectOptions[];
  guilds: SelectOptions[];
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

router.use(helmet());
router.use(
  session({
    store: new SessionStore({
      path: './config/sessions',
      retries: 1,
    }),
    name: 'sessionId',
    secret: 'siglemic',
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      sameSite: 'lax',
      domain: new URL(config.baseUrl).hostname,
      secure: !development,
      httpOnly: true,
    },
  })
);

app.set('view engine', 'ejs');

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
  app.set('views', path.join(__dirname, '..', 'site'));
} else {
  router.use(express.static('public'));
  app.set('views', path.join('public'));
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
    user.moderatedGames = await getModeratedGames(srcId);
    setUser(user);
    giveRoles(discordInfo.id);
    res.redirect('/success');
  } else {
    res.redirect('/failure');
  }
});

router.get('/dashboard', (req, res, next) => {
  const userId = getSessionDiscordId(req);
  let moderatedGames: SelectOptions[];
  let guilds: SelectOptions[];
  const userData = getUser(userId);
  if (!userData) {
    moderatedGames = [];
    guilds = [];
  } else {
    moderatedGames = userData.moderatedGames;
    const guildsData = getGuildsData();
    const mappedGuilds: (SelectOptions | null)[] = Object.values(guildsData).map((guild) => {
      const matchedGameGuilds = guild.games.filter((game) =>
        moderatedGames.some((moderatedGame) => moderatedGame.value === game)
      );
      if (matchedGameGuilds.length) {
        return {
          display: guild.name || 'unknown',
          value: guild.id,
        };
      }
      return null;
    });
    guilds = mappedGuilds.filter((guild) => guild) as SelectOptions[];
  }
  const dashboardData: DashboardData = { games: moderatedGames, guilds };
  res.render('dashboard', dashboardData);
  next();
});

router.get('/results/:pollId', (req, res, next) => {
  const { pollId } = req.params;
  if (!pollId) {
    res.status(404).send();
    next();
    return;
  }
  const pollData = getPoll(pollId);
  const results = pollData?.results;
  if (!results) {
    res.status(404).send();
    next();
    return;
  }
  res.render('results', pollData);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
router.post<any, any, CreatePollRequest, any>('/poll', async (req, res) => {
  L.debug({ body: req.body }, 'incoming new poll body');
  const pollRequest = req.body;
  const guild = getGuild(pollRequest.guildId);
  if (!guild) throw new Error(`Cannot find guild: ${pollRequest.guildId}`);
  const guildGames = guild.games;
  const discordId = getSessionDiscordId(req);
  const user = getUser(discordId);
  if (!user) throw new Error(`Cannot find user: ${discordId}`);
  const allowed = guildGames.every((guildGame) =>
    user.moderatedGames.map((game) => game.value).includes(guildGame)
  );
  if (allowed) {
    await createPoll(pollRequest);
    res.status(200).send(); // TODO: Make this a page
  } else {
    res.status(403).send(); // TODO: Make this a page
  }
});

const baseUrl = new URL(config.baseUrl);
const basePath = baseUrl.pathname;

// TODO: Error handler for all the errors I throw
app.use(basePath, router);

app.listen(config.port);
