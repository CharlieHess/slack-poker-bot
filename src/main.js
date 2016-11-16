import {slackbot} from 'botkit';

if (!process.env.clientId || !process.env.clientSecret || !process.env.port) {
  console.log('Error: Specify clientId clientSecret and port in environment');
  process.exit(1);
}

let controller = slackbot({
  json_file_store: './db_slack_pokerbot/'
}).configureSlackApp({
  clientId: process.env.clientId,
  clientSecret: process.env.clientSecret,
  scopes: ['bot']
});

controller.setupWebserver(process.env.port, () => {
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

const players = [];

controller.hears(['start game', 'play game'], 'direct_mention', (bot, message) => {
  bot.reply(message, {
    text: 'Alright, who wants to play?',
    attachments: [{
      title: '',
      callback_id: 'join-game',
      attachment_type: 'default',
      actions: [{
        name: 'join',
        text: 'Deal me in',
        value: 'join',
        type: 'button'
      }]
    }]
  });
});

function onJoinGame(userId) {
  return new Promise((res, rej) => {
    controller.storage.users.get(userId, (err, user) => {
      if (err) rej(err);
      players.push(user);
      res(user);
    });
  });
}

function showAllParticipants(bot, message) {
  let listPlayers = {
    text: 'Our current lineup',
    attachments: []
  };

  for (let player of players) {
    listPlayers.attachments.push({
      title: player.user,
      callback_id: `leave-${player.id}`,
      attachment_type: 'default',
      actions: [{
        text: "Leave",
        name: "leave",
        value: "leave",
        style: "danger",
        type: "button",
        confirm: {
          title: "Are you sure you want to quit?",
          text: "Are you sure you want to quit?",
          ok_text: "Yes",
          dismiss_text: "No"
        }
      }]
    });
  }

  bot.reply(message, listPlayers);
}

controller.on('interactive_message_callback', async (bot, message) => {
  switch (message.callback_id) {
  case 'join-game':
    await onJoinGame(message.user);
    showAllParticipants(bot, message);
    break;
  }
});

controller.on('create_bot', (bot, config) => {

  if (bots[bot.config.token]) {
    // already online! do nothing.
  } else {
    bot.startRTM(function(err) {

      if (!err) {
        trackBot(bot);
      }

      bot.startPrivateConversation({user: config.createdBy}, (err,convo) => {
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

controller.hears('^stop', 'direct_message', (bot, message) => {
  bot.reply(message, 'Goodbye');
  bot.rtm.close();
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
        console.log('Error connecting bot to Slack:',err);
      } else {
        trackBot(bot);
      }
    });
  }
});
