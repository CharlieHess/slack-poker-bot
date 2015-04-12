class Card {
  constructor(suit, rank) {
    this.suit = suit;
    this.rank = rank;
  }
  
  toString() {
    return `${this.rank}${this.suit[0]}`;
  }
  
  static Suits() {
    return [
      'Spades',
      'Hearts',
      'Diamonds',
      'Clubs'
    ];
  }
  
  static Ranks() {
    return [
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      'T',
      'J',
      'Q',
      'K',
      'A',
    ];
  }
}

module.exports = Card;