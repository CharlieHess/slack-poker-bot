const rx = require('rx');
const _ = require('underscore-plus');

const Slack = require('slack-client');
const Deck = require('./deck');
const MessageHelpers = require('./message-helpers');

class Bot {
  constructor(token) {
    this.token = token;
  }
  
  login() {
    let slack = new Slack(this.token, true, true);
    
    rx.Observable.fromEvent(slack, 'open').subscribe(() => {
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
    });
    
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
    
    slack.login();
  }
}

module.exports = Bot;