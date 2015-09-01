class Card {
  constructor(rank, suit) {
    this.rank = rank;
    this.suit = suit;
  }

  toString() {
    return `${this.rank}${Card.SuitMapping()[this.suit]}`;
  }
  
  toAsciiString() {
    return `${this.rank}${this.suit.substring(0, 1).toLowerCase()}`;
  }

  static Ranks() {
    return ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  }

  static Suits() {
    return ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
  }

  static SuitMapping() {
    return {'Spades':'♠', 'Hearts':'♥', 'Diamonds':'♦', 'Clubs':'♣'};
  }
}

module.exports = Card;
