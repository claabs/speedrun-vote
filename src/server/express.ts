import express from 'express';
import config from '../config';
import L from '../logger';

const app = express();

const router = express.Router();

router.use(express.static('public'));
router.use(express.json());

router.post('/poll', async (req, res) => {
  L.debug({ body: req.body }, 'incoming POST body');
  res.status(200).send();
});

const baseUrl = new URL(config.baseUrl);
const basePath = baseUrl.pathname;

app.use(basePath, router);

app.listen(config.port);
