## Slack Poker Bot
A bot that will deal Texas Hold'em games in a Slack channel!

### Getting Started
1. Add your API token to `main.js`
1. `npm install`
1. `node src/main.js`
1. To start a game, `@<your_bot_name>: Deal`
1. To end a game, `@<your_bot_name> Quit game`

### Run Tests
1. `gulp`

### TODO
- [x] Tally up players that are participating
- [x] Basic game logic
- [x] Send player's pocket cards as a DM
- [x] Display actual cards
  - [x] Render the cards as an image attachment
  - [x] Upload to imgur
- [ ] Logic for a betting round
- [ ] Determining the best hand
- [ ] Potential AI plug-in?
- [ ] Infinity other things
