let Card = require('./card.js');

class Deck {
  constructor() {
    this.cards = [];
    for (let suit in Card.Suits()) {
      for (let rank in Card.Ranks()) {
        let card = new Card(rank, suit);
        this.cards.push(card);
      }
    }
  }
  
  shuffle() {
    
  }
}

module.exports = Deck;