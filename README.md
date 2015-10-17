## Slack Poker Bot [![Build Status](https://travis-ci.org/CharlieHess/slack-poker-bot.png)](https://travis-ci.org/CharlieHess/slack-poker-bot)

A bot that turns Slack into a legitimate Texas Hold'em client. Start a game in any channel or private group with 2-10 players. PokerBot will deal hands, direct message players with their hole cards, query players for their action, determine the winning hand, and handle the pot.

![](https://s3.amazonaws.com/f.cl.ly/items/3w3k222T0A1o2e0d033Q/Image%202015-09-01%20at%2011.41.33%20PM.png)
![](https://s3.amazonaws.com/f.cl.ly/items/2a073W0Q1Y2N0O2U1i3p/Image%202015-09-01%20at%2011.39.28%20PM.png)

See it [in action](https://www.youtube.com/watch?v=Joku-PKUObE).

## Getting Started
1. Create a new [bot integration](https://my.slack.com/services/new/bot)
1. Follow the steps to deploy the bot to Heroku or run it locally
1. Once the bot is running, start a game with: `@<your-bot-name>: deal`

#### One-Click Heroku
Click this button:

[![Deploy](https://www.herokucdn.com/deploy/button.png)](https://heroku.com/deploy)

#### Manual Heroku
1. Install [Heroku toolbelt](https://devcenter.heroku.com/articles/getting-started-with-nodejs#set-up)
1. Create a new bot integration (as above)
1. `heroku create`
1. `heroku config:set SLACK_POKER_BOT_TOKEN=[Your API token]`
1. `git push heroku master`

#### To Run Locally
1. Create a `token.txt` file and paste your API token there
1. `npm install`
1. `node src/main.js`

## Directions
* To start a game, `@<your-bot-name>: deal`.
* To end a game, `@<your-bot-name>: quit game`. The game will end once the current hand finishes.
Note that any player can end a game at any time with this command, so Be Honorable™.
* To configure some bot options, `@<your-bot-name>: config <name-of-option>=<value>`. The supported options are:
```
timeout: Sets the duration (in seconds) before a player times out. 
Set to 0 to specify no timeout.
```
So, to start a game without any player timeout, say:
```
@<your-bot-name>: config timeout=0
@<your-bot-name>: deal
```

Check the open issues for some planned enhancements.

### AI Players
Although this client was built for managing human players in a Slack channel, it has some support for AI players. To add a bot player:

1. Add a bot class under the `ai/` folder
1. Implement `getAction`, which is called whenever it is the bot's turn
1. Modify the `addBotPlayers` method in `src/bot.js` to add your bot to every game

### Test All The Things
To run tests, simply do:

1. `gulp`

The tests produce legible output that matches what users in Slack would see. This is the same test suite that is run on each pull request. This is very helpful when diagnosing a logic bug:
![](https://s3.amazonaws.com/f.cl.ly/items/2L0Y2Y3d3g0i1x171n2V/Image%202015-09-08%20at%207.00.40%20PM.png)

### Dependencies
* [NodeJS Slack Client](https://github.com/slackhq/node-slack-client)
`node-slack-client` abstracts the basics of a Slack bot, including authentication, getting messages from players, and posting messages or attachments to the channel.

* [RxJS](https://github.com/Reactive-Extensions/RxJS)
The majority of this client is written using `RxJS`. It simplifies many of the complex player polling interactions, that would otherwise be Death By Timers, into very legible code.

* [Imgur](https://github.com/kaimallea/node-imgur) / [Lightweight Image Processor](https://github.com/EyalAr/lwip)
Each card is a separate image, and board images are created on the fly by pasting several cards onto a single canvas (with the help of  `lwip`). The resulting image is than uploaded to `imgur`, which gives us a single URL that can be passed as an attachment to the Slack API. This route was chosen to avoid uploading 318,505,200 images to the cloud, and allows us to modify the card assets easily.

* [Poker Evaluator](https://github.com/chenosaurus/poker-evaluator)
`poker-evaluator` is used for evaluating the winning hand when it comes time to show down. Here it has been extended to calculate the best 5-card hand from any 7-card hand.

* [MochaJS](http://mochajs.org/)
Most of the tricky client logic is backed up by tests, which were written using `MochaJS`.

* [Vector Playing Cards](https://code.google.com/p/vector-playing-cards/)
