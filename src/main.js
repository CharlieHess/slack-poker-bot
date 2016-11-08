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

controller.on('interactive_message_callback', (bot, message) => {

  let [user_id, item_id] = message.callback_id.split(/\-/);

  controller.storage.users.get(user_id, (err, user) => {

    user = user || {
      id: user_id,
      list: []
    };

    for (let item of user.list) {
      if (item.id === item_id) {
        if (message.actions[0].value === 'flag') {
          item.flagged = !item.flagged;
        }

        if (message.actions[0].value === 'delete') {
          user.list.splice(user.list.indexOf(item), 1);
        }
      }
    }

    let reply = {
      text: 'Here is <@' + user_id + '>s list:',
      attachments: []
    };

    for (let item of user.list) {
      reply.attachments.push({
        title: item.text + (item.flagged? ' *FLAGGED*' : ''),
        callback_id: user_id + '-' + item.id,
        attachment_type: 'default',
        actions: [{
          "name":"flag",
          "text": ":waving_black_flag: Flag",
          "value": "flag",
          "type": "button"
        },
        {
          "text": "Delete",
          "name": "delete",
          "value": "delete",
          "style": "danger",
          "type": "button",
          "confirm": {
            "title": "Are you sure?",
            "text": "This will do something!",
            "ok_text": "Yes",
            "dismiss_text": "No"
          }
        }]
      });
    }

    bot.replyInteractive(message, reply);
    controller.storage.users.save(user);
  });
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
