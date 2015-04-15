## Slack Poker Bot
A bot that will deal Texas Hold'em games in a Slack channel!

### TODO
- [ ] Tally up players that are participating
- [ ] Actual game logic
- [ ] Render the cards as an image attachment

### Notes
`node-slack-client` seems to have a bug with edited messages; removing the `_onUpdateMessage` callback in message.coffee fixes it.