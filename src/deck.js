const Card = require('./card.js');

class Deck {
  constructor() {
    this.cards = [];
    for (let suit of Card.Suits) {
      for (let rank of Card.Ranks) {
        let card = new Card(rank, suit);
        this.cards.push(card);
      }
    }
  }

  // Public: Performs a proper Fisher-Yates shuffle.
  //
  // Returns nothing; the shuffle is in-place.
  shuffle() {
    let temp, idx;
    let cardsRemaining = this.cards.length;

    // While there remain elements to shuffle…
    while (cardsRemaining) {

      // Pick a remaining element…
      idx = Math.floor(Math.random() * cardsRemaining--);

      // And swap it with the current element.
      temp = this.cards[cardsRemaining];
      this.cards[cardsRemaining] = this.cards[idx];
      this.cards[idx] = temp;
    }
    return this;
  }

  drawCard() {
    return this.cards.shift();
  }

  replaceTop(cards) {
    if (!(cards instanceof Array)) {
      cards = [cards];
    }
    let mapping = {};
    let top = cards.map(card => {
      mapping[card[0] + Card.AsciiMapping[card[1]]] = true;
      return new Card(card);
    });
    this.cards = this.cards.filter(card => !mapping[card.toAsciiString()]);
    this.cards = top.concat(this.cards);
    return this;
  }

  toString() {
    return this.cards.join();
  }

  toAsciiString() {
    return this.cards.map(card => card.toAsciiString()).join();
  }
}

module.exports = Deck;
