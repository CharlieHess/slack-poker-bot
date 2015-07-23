## Slack Poker Bot
A bot that turns Slack into a legitimate Texas Hold'em client. Start a game in any channel or private group with 2-10 players. PokerBot will deal hands, direct message players with their hole cards, query players (in order) for their action, determine the winning hand, and (eventually) handle the pot.

![](https://s3.amazonaws.com/f.cl.ly/items/1h0S1x0e2e0t2A1W180u/Image%202015-06-30%20at%2011.07.16%20AM.png)

### Getting Started
1. Add your API token to `main.js`
1. `npm install`
1. `node src/main.js`
1. To start a game, `@<your_bot_name>: Deal`
1. To end a game, `@<your_bot_name>: Quit game`

### Run Tests
1. `gulp`

### TODO
- [x] Tally up players that are participating
- [x] Basic game logic
- [x] Send player's pocket cards as a DM
- [x] Display actual cards
  - [x] Render the cards as an image attachment
  - [x] Upload to imgur
- [x] Determining the best hand
- [x] Logic for player order
- [x] Programmable bot classes
- [x] Logic for a betting round
  - [x] Cycle through players in order, tallying actions
  - [x] Allow hands to be ended early or with showdown
  - [x] More robust processing of player action
- [ ] Logic for player's chip stacks
- [ ] Handle split pots
- [ ] Deployability (Heroku or whatever)
- [ ] Infinity other things

### Dependencies
* [Poker Evaluator](https://github.com/chenosaurus/poker-evaluator)
* [Lightweight Image Processor](https://github.com/EyalAr/lwip)
* [Imgur](https://github.com/kaimallea/node-imgur)
