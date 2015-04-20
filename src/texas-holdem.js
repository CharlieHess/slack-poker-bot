
class TexasHoldem {
  // Public: Creates a new game instance.
  //
  // messages - An {Observable} representing messages posted to the channel
  // channel - The channel where the game will be played
  // players - The players participating in the game
  constructor(messages, channel, players) {
    this.messages = messages;
    this.channel = channel;
    this.players = players;
  }
  
  start() {
    
  }
  
  quit() {
    
  }
}

module.exports = TexasHoldem;