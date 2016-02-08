class Card {
  constructor(rank, suit) {
    this.rank = rank;
    this.suit = suit;
    this.asciiSuit = suit[0].toLowerCase()
  }

  compareString(string) {
    return this.rank == string[0].replace('1','A').toUpperCase()
      && (string.length == 1 || string[1] == this.asciiSuit)
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

  static AsciiMapping() {
    return {'s':'♠', 'h':'♥', 'd':'♦', 'c':'♣'};
  }

  static asciiToString(string) {
    return string[0].replace('1','A').toUpperCase() + (string[1] ?
      Card.AsciiMapping()[string[1].toLowerCase()] : '');

  }
}

module.exports = Card;
