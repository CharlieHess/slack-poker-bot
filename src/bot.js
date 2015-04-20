const rx = require('rx');
const _ = require('underscore-plus');

const Slack = require('slack-client');
const TexasHoldem = require('./texas-holdem');
const MessageHelpers = require('./message-helpers');
const PlayerInteraction = require('./player-interaction');

class Bot {
  // Public: Creates a new instance of the bot.
  //
  // token - An API token from the bot integration
  constructor(token) {
    this.slack = new Slack(token, true, true);
  }
  
  // Public: Brings this bot online and starts handling messages sent to it.
  login() {
    rx.Observable.fromEvent(this.slack, 'open')
      .subscribe(() => this.onClientOpened());
    
    this.slack.login();
    this.respondToDealMessages();
  }
  
  // Private: Begins listening to messages directed to this bot and responds
  // by polling players and starting a game.
  respondToDealMessages() {
    let messages = rx.Observable.fromEvent(this.slack, 'message')
      .where((e) => e.type === 'message');
    
    // Messages directed at the bot that contain the word "deal" are valid
    let dealGameMessages = messages.where((e) => 
      MessageHelpers.containsUserMention(e.text, this.slack.self.id) &&
        e.text.toLowerCase().match(/\bdeal\b/));
    
    dealGameMessages.subscribe((e) => {
      let channel = this.slack.getChannelGroupOrDMByID(e.channel);
      
      if (this.game) {
        channel.send("A game is already in progress, I can't deal another.");
      } else {
        let players = [];
        
        PlayerInteraction.pollPotentialPlayers(messages, channel).subscribe(
          (userId) => {
            let player = this.slack.getUserByID(userId);
            players.push(player);
            
            channel.send(`${player.name} has joined the game.`);
          }, 
          (err) => console.log(`Error while polling players: ${err.stack || err}`),
          () => this.startGame(messages, channel, players)
        );
      }
    });
  }
  
  // Private: Starts and manages a new hold'em game.
  //
  // messages - An {Observable} representing messages posted to the channel
  // channel - The channel where the game will be played
  // players - The players participating in the game
  startGame(messages, channel, players) {
    channel.send(`We've got ${players.length} players, let's start the game.`);
    this.game = new TexasHoldem(this.slack, messages, channel, players);
    this.game.start();
    
    let quitGameMessages = messages.where((e) => 
      MessageHelpers.containsUserMention(e.text, this.slack.self.id) &&
        e.text.toLowerCase().match(/quit game/));
    
    // TODO: Should poll players to make sure they all want to quit.
    let listener = quitGameMessages.subscribe((e) => {
      let player = this.slack.getUserByID(e.user);
      channel.send(`${player.name} has decided to quit the game.`);

      this.game.quit();
      this.game = null;
      
      listener.dispose();
    });
  }
  
  // Private: Save which channels and groups this bot is in and log them.
  onClientOpened() {
    this.channels = _.keys(this.slack.channels)
      .map((k) => this.slack.channels[k])
      .filter((c) => c.is_member);
  
    this.groups = _.keys(this.slack.groups)
      .map((k) => this.slack.groups[k])
      .filter((g) => g.is_open && !g.is_archived);
  
    console.log(`Welcome to Slack. You are ${this.slack.self.name} of ${this.slack.team.name}`);
  
    if (this.channels.length > 0) {
      console.log(`You are in: ${this.channels.map((c) => c.name).join(', ')}`);
    }
    else {
      console.log('You are not in any channels.');
    }
  
    if (this.groups.length > 0) {
      console.log(`As well as: ${this.groups.map((g) => g.name).join(', ')}`);
    }
  }
}

module.exports = Bot;