let Deck = require('./deck');

class TexasHoldem {
  // Public: Creates a new game instance.
  //
  // slack - An instance of the Slack client
  // messages - An {Observable} representing messages posted to the channel
  // channel - The channel where the game will be played
  // players - The players participating in the game
  constructor(slack, messages, channel, players) {
    this.slack = slack;
    this.messages = messages;
    this.channel = channel;
    this.players = players;
    
    // Cache the direct message channels for each player as we'll be using
    // them often, and fetching them takes linear time per number of users.
    this.playerDms = {};
    for (let player of players) {
      this.playerDms[player.id] = this.slack.getDMByName(player.name);
    }
    
    this.deck = new Deck();
    this.inGame = true;
  }
  
  start() {
    while (this.inGame) {
      this.playHand();
    }
  }
  
  quit() {
    this.inGame = false;
  }
  
  playHand() {
    this.board = [];
    this.playerHands = {};
    
    this.deck.shuffle();
    this.dealPlayerCards();
    
    this.flop();
    this.turn();
    this.river();
    
    // TODO: Only play one hand right now, until we sort the betting rounds.
    this.quit();
  }
  
  dealPlayerCards() {
    for (let player of this.players) {
      let card = this.deck.drawCard();
      this.playerHands[player.id] = [card];
    }
    
    for (let player of this.players) {
      let card = this.deck.drawCard();
      this.playerHands[player.id].push(card);
      
      // Send hole cards as a DM; we can't post in channel for obvious reasons.
      let dm = this.playerDms[player.id];
      dm.send(`Your hand is: ${this.playerHands[player.id]}`);
    }
  }
  
  flop() {
    let flop = [this.deck.drawCard(), this.deck.drawCard(), this.deck.drawCard()];
    this.board = flop;
    
    this.channel.send(`Dealing the flop: ${this.board}`);
    this.doBettingRound();
  }
  
  turn() {
    this.deck.drawCard(); // Burn one
    let turn = this.deck.drawCard();
    this.board.push(turn);
    
    this.channel.send(`Dealing the turn: ${this.board}`);
    this.doBettingRound();
  }
  
  river() {
    this.deck.drawCard(); // Burn one
    let river = this.deck.drawCard();
    this.board.push(river);
    
    this.channel.send(`Dealing the river: ${this.board}`);
    this.doBettingRound();
  }
  
  doBettingRound() {
    
  }
}

module.exports = TexasHoldem;