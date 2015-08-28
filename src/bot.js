const rx = require('rx');
const _ = require('underscore-plus');

const Slack = require('slack-client');
const TexasHoldem = require('./texas-holdem');
const MessageHelpers = require('./message-helpers');
const PlayerInteraction = require('./player-interaction');

const WeakBot = require('../ai/weak-bot');
const AggroBot = require('../ai/aggro-bot');

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

  // Private: Listens for messages directed at this bot that contain the word
  // 'deal,' and poll players in response.
  //
  // Returns a {Disposable} that will end this subscription
  respondToDealMessages() {
    let messages = rx.Observable.fromEvent(this.slack, 'message')
      .where(e => e.type === 'message');

    // Messages directed at the bot that contain the word "deal" are valid
    let dealGameMessages = messages.where(e =>
      MessageHelpers.containsUserMention(e.text, this.slack.self.id) &&
        e.text.toLowerCase().match(/\bdeal\b/));
        
    return dealGameMessages
      .map(e => this.slack.getChannelGroupOrDMByID(e.channel))
      .where(channel => {
        if (this.isPolling) {
          return false;
        } else if (this.isGameRunning) {
          channel.send('Another game is in progress, quit that first.');
          return false;
        }
        return true;
      })
      .flatMap(channel => this.pollPlayersForGame(messages, channel))
      .subscribe();
  }
  
  // Private: Polls players to join the game, and if we have enough, starts an
  // instance.
  //
  // messages - An {Observable} representing messages posted to the channel
  // channel - The channel where the deal message was posted
  //
  // Returns an {Observable} that signals completion of the game 
  pollPlayersForGame(messages, channel) {
    this.isPolling = true;

    return PlayerInteraction.pollPotentialPlayers(messages, channel)
      .reduce((players, id) => {
        let user = this.slack.getUserByID(id);
        channel.send(`${user.name} has joined the game.`);
        
        players.push({id: user.id, name: user.name});
        return players;
      }, [])
      .flatMap(players => {
        this.isPolling = false;
        this.addBotPlayers(players);
        
        let messagesInChannel = messages.where(e => e.channel === channel.id);
        return this.startGame(messagesInChannel, channel, players);
      });
  }

  // Private: Starts and manages a new Texas Hold'em game.
  //
  // messages - An {Observable} representing messages posted to the channel
  // channel - The channel where the game will be played
  // players - The players participating in the game
  //
  // Returns an {Observable} that signals completion of the game 
  startGame(messages, channel, players) {
    if (players.length <= 1) {
      channel.send('Not enough players for a game, try again later.');
      return rx.Observable.return(null);
    }

    channel.send(`We've got ${players.length} players, let's start the game.`);
    this.isGameRunning = true;
    
    let game = new TexasHoldem(this.slack, messages, channel, players);

    // Listen for messages directed at the bot containing 'quit game.'
    messages.where(e => MessageHelpers.containsUserMention(e.text, this.slack.self.id) &&
      e.text.toLowerCase().match(/quit game/))
      .take(1)
      .subscribe(e => {
        // TODO: Should poll players to make sure they all want to quit.
        let player = this.slack.getUserByID(e.user);
        channel.send(`${player.name} has decided to quit the game. The game will end after this hand.`);
        game.quit();
      });
    
    return rx.Observable.timer(3000)
      .flatMap(() => game.start())
      .do(() => this.isGameRunning = false);
  }

  // Private: Adds AI-based players (primarily for testing purposes).
  //
  // players - The players participating in the game
  addBotPlayers(players) {
    // let bot1 = new WeakBot('Phil Hellmuth');
    // let bot2 = new AggroBot('Phil Ivey');
    // 
    // players.push(bot1);
    // players.push(bot2);
  }

  // Private: Save which channels and groups this bot is in and log them.
  onClientOpened() {
    this.channels = _.keys(this.slack.channels)
      .map(k => this.slack.channels[k])
      .filter(c => c.is_member);

    this.groups = _.keys(this.slack.groups)
      .map(k => this.slack.groups[k])
      .filter(g => g.is_open && !g.is_archived);
      
    this.dms = _.keys(this.slack.dms)
      .map(k => this.slack.dms[k])
      .filter(dm => dm.is_open);

    console.log(`Welcome to Slack. You are ${this.slack.self.name} of ${this.slack.team.name}`);

    if (this.channels.length > 0) {
      console.log(`You are in: ${this.channels.map(c => c.name).join(', ')}`);
    } else {
      console.log('You are not in any channels.');
    }

    if (this.groups.length > 0) {
      console.log(`As well as: ${this.groups.map(g => g.name).join(', ')}`);
    }
    
    if (this.dms.length > 0) {
      console.log(`Your open DM's: ${this.dms.map(dm => dm.name).join(', ')}`);
    }
  }
}

module.exports = Bot;
