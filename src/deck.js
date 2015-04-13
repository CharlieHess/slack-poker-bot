const Card = require('./card.js');

class Deck {
  constructor() {
    this.cards = [];
    for (let suit of Card.Suits()) {
      for (let rank of Card.Ranks()) {
        let card = new Card(rank, suit);
        this.cards.push(card);
      }
    }
  }
  
  shuffle() {
    let numberOfCards = this.cards.length;
    
    for (let index = 0; index < numberOfCards; index++) {
      let newIndex = Deck.getRandomInt(0, numberOfCards);
      let cardToSwap = this.cards[newIndex];
      
      this.cards[newIndex] = this.cards[index];
      this.cards[index] = cardToSwap;
    }
  }
  
  nextCard() {
    return this.cards.shift();
  }
  
  toString() {
    return this.cards.join();
  }
  
  static getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
  }
}

module.exports = Deck;