import {slackbot} from 'botkit';

import {gameState} from './shared-constants';
import {getOrUpdateUser} from './storage-utils';
import {showGameRoster, updateGameRoster, showInProgressMessage,
  rosterMessageId, startGameMessageId} from './game-roster';
import {TexasHoldem} from './texas-holdem';

if (!process.env.POKER_BOT_CLIENT_ID ||
  !process.env.POKER_BOT_CLIENT_SECRET ||
  !process.env.POKER_BOT_PORT) {
  console.log('Error: Specify POKER_BOT_CLIENT_ID, POKER_BOT_CLIENT_SECRET, and POKER_BOT_PORT in environment');
  process.exit(1);
}

const controller = slackbot({
  json_file_store: './db_slack_pokerbot/'
}).configureSlackApp({
  clientId: process.env.POKER_BOT_CLIENT_ID,
  clientSecret: process.env.POKER_BOT_CLIENT_SECRET,
  scopes: ['bot']
});

controller.setupWebserver(process.env.POKER_BOT_PORT, () => {
  controller.createWebhookEndpoints(controller.webserver);

  controller.createOauthEndpoints(controller.webserver, (err, req, res) => {
    if (err) {
      res.status(500).send('ERROR: ' + err);
    } else {
      res.send('Success!');
    }
  });
});

// just a simple way to make sure we don't
// connect to the RTM twice for the same team
const bots = {};
function trackBot(bot) {
  bots[bot.config.token] = bot;
}

const players = {};

let currentGame = null;
let currentState = gameState.notStarted;

function resetGameState() {
  currentGame = null;
  for (const playerId of Object.keys(players)) {
    delete players[playerId];
  }
  currentState = gameState.notStarted;
}

controller.hears([/^(start|play|deal)(\sgame)?$/i], 'direct_mention', (bot, message) => {
  switch (currentState) {
  case gameState.notStarted:
    currentState = gameState.inRegistration;
    showGameRoster({players, bot, message});
    break;
  case gameState.inRegistration:
  case gameState.inProgress:
    bot.reply(message, 'A game is already underway.');
    break;
  }
});

controller.hears([/^(stop|end)(\sgame)?$/i], 'direct_mention', async (bot, message) => {
  switch (currentState) {
  case gameState.notStarted:
    bot.reply(message, "We haven't started a game yet.");
    break;
  case gameState.inRegistration:
  case gameState.inProgress:
    const {user} = await getOrUpdateUser({controller, message});
    bot.reply(message, `This game was cancelled by ${user}.`);
    resetGameState();
    break;
  }
});

controller.on('interactive_message_callback', async (bot, message) => {
  switch (message.callback_id) {
  case rosterMessageId:
    await updateGameRoster({controller, players, bot, message});
    break;
  case startGameMessageId:
    currentGame = new TexasHoldem({bot, players});
    currentState = gameState.inProgress;
    showInProgressMessage({players, bot, message});
    break;
  }
});

controller.on('create_bot', (bot, config) => {
  if (bots[bot.config.token]) {
    // already online! do nothing.
  } else {
    bot.startRTM((err) => {

      if (!err) {
        trackBot(bot);
      }

      bot.startPrivateConversation({user: config.createdBy}, (err, convo) => {
        if (err) {
          console.log(err);
        } else {
          convo.say('I am a bot that has just joined your team');
          convo.say('You must now /invite me to a channel so that I can be of use!');
        }
      });
    });
  }
});

// Handle events related to the websocket connection to Slack
controller.on('rtm_open', () => {
  console.log('** The RTM api just connected!');
});

controller.on('rtm_close', () => {
  console.log('** The RTM api just closed');
  // you may want to attempt to re-open
});

controller.storage.teams.all((err, teams) => {

  if (err) {
    throw new Error(err);
  }

  // connect all teams with bots up to slack!
  for (let t in teams) {
    if (!teams[t].bot) continue;

    controller.spawn(teams[t]).startRTM((err, bot) => {
      if (err) {
        console.log('Error connecting bot to Slack:', err);
      } else {
        trackBot(bot);
      }
    });
  }
});
