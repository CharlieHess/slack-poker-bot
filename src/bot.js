const rx = require('rx');
const _ = require('underscore-plus');

const Slack = require('slack-client');
const MessageHelpers = require('./message-helpers');
const PlayerInteraction = require('./player-interaction');

class Bot {
  // Public: Creates a new instance of the bot
  //
  // token - An API token from the bot integration
  constructor(token) {
    this.slack = new Slack(token, true, true);
  }
  
  // Public: Brings this bot online and starts handling messages sent to it
  login() {
    rx.Observable.fromEvent(this.slack, 'open')
      .subscribe(() => this.logBasicInfo());
    
    this.respondToDealMessages();
    this.slack.login();
  }
  
  // Private: Begins listening to messages directed to this bot and responds
  // by starting a poker game
  respondToDealMessages() {
    let messages = rx.Observable.fromEvent(this.slack, 'message')
      .where((e) => e.type === 'message');
    
    // Messages directed at the bot that contain the word "deal" are valid
    let dealGameMessages = messages
      .where((e) => MessageHelpers.containsUserMention(e.text, this.slack.self.id) &&
        e.text.toLowerCase().match(/\bdeal\b/));
    
    dealGameMessages.subscribe((e) => {
      let channel = this.slack.getChannelGroupOrDMByID(e.channel);
      
      if (this.game) {
        channel.send("A game is already in progress, I can't deal another.");
      } else {
        PlayerInteraction.pollPotentialPlayers(messages, channel)
          .subscribe((userId) => {
            let user = this.slack.getUserByID(userId);
            channel.send(`Player ${user.name} has joined the game`);
          });
      }
    });
  }
  
  // Private: Logs information about what channels and groups this bot is in
  logBasicInfo() {
    let channels = _.keys(this.slack.channels)
      .map((k) => this.slack.channels[k])
      .filter((c) => c.is_member)
      .map((c) => c.name);
  
    let groups = _.keys(this.slack.groups)
      .map((k) => this.slack.groups[k])
      .filter((g) => g.is_open && !g.is_archived)
      .map((g) => g.name);
  
    console.log(`Welcome to Slack. You are ${this.slack.self.name} of ${this.slack.team.name}`);
  
    if (channels.length > 0) {
      console.log(`You are in: ${channels.join(', ')}`);
    }
    else {
      console.log('You are not in any channels.');
    }
  
    if (groups.length > 0) {
      console.log(`As well as: ${groups.join(', ')}`);
    }
  }
}

module.exports = Bot;