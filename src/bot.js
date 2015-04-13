const rx = require('rx');
const _ = require('underscore-plus');

const Slack = require('slack-client');
const Deck = require('./deck');
const MessageHelpers = require('./message-helpers');

class Bot {
  // Public: Creates a new instance of the bot
  //
  // token - An API token from the bot integration
  constructor(token) {
    this.token = token;
  }
  
  // Public: Brings this bot online and starts handling messages sent to it
  login() {
    let slack = new Slack(this.token, true, true);
    
    rx.Observable.fromEvent(slack, 'open')
      .subscribe(() => this.logBasicInfo(slack));
    
    this.respondToDealMessages(slack);
    
    slack.login();
  }
  
  // Private: Begins listening to messages directed to this bot and responds
  // by starting a poker game
  //
  // slack - A `slack-client` instance
  respondToDealMessages(slack) {
    let messagesToThisBot = rx.Observable.fromEvent(slack, 'message')
      .where((e) => (e.type === 'message') && 
        MessageHelpers.containsUserMention(e.text, slack.self.id));
    
    messagesToThisBot.where((e) => e.text.toLowerCase().match(/\bdeal\b/))
      .subscribe((e) => {
        let deck = new Deck();
        deck.shuffle();
        
        let channel = slack.getChannelGroupOrDMByID(e.channel);
        channel.send(`Here's the deck: ${deck}`);
      });
  }
  
  // Private: Logs information about what channels and groups this bot is in
  //
  // slack - A `slack-client` instance
  logBasicInfo(slack) {
    let channels = _.keys(slack.channels)
      .map((k) => slack.channels[k])
      .filter((c) => c.is_member)
      .map((c) => c.name);
  
    let groups = _.keys(slack.groups)
      .map((k) => slack.groups[k])
      .filter((g) => g.is_open && !g.is_archived)
      .map((g) => g.name);
  
    console.log(`Welcome to Slack. You are ${slack.self.name} of ${slack.team.name}`);
  
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