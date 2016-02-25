class Card {
  constructor(rank, suit=null) {
    if (suit == null) {
      if (rank.length != 2) {
        throw new Error(`invalid card ${rank}`);
      }
      let trueRank = rank[0].toUpperCase();
      if (Card.Ranks.indexOf(trueRank) < 0) {
        throw new Error(`invalid card rank ${trueRank}`);
      }
      let asciiSuit = rank[1].toLowerCase();
      let suit = Card.AsciiSuitMapping[asciiSuit];
      if (!suit) {
        throw new Error(`invalid card suit ${asciiSuit}`);
      }
      this.rank = trueRank;
      this.suit = suit;
      this.asciiSuit = asciiSuit;
    } else {
      this.rank = rank;
      this.suit = suit;
      this.asciiSuit = suit[0].toLowerCase();
    }
  }

  compareString(string) {
    return this.rank == string[0].replace('1','A').toUpperCase()
      && (string.length == 1 || string[1] == this.asciiSuit)
  }

  toString() {
    return `${this.rank}${Card.SuitMapping[this.suit]}`;
  }
  
  toAsciiString() {
    return `${this.rank}${this.asciiSuit}`;
  }

  rankNumber() {
    return Cards.Ranks.indexOf(this.rank);
  }

  static get Ranks() {
    return ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  }

  static get Suits() {
    return ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
  }

  static get SuitMapping() {
    return {'Spades':'♠', 'Hearts':'♥', 'Diamonds':'♦', 'Clubs':'♣'};
  }

  static get AsciiMapping() {
    return {'s':'♠', 'h':'♥', 'd':'♦', 'c':'♣'};
  }

  static get AsciiSuitMapping() {
    return {'s':'Spades', 'h':'Hearts', 'd':'Diamonds', 'c':'Clubs'};
  }

  static asciiToString(string) {
    return string[0].replace('1','A').toUpperCase() + (string[1] ?
      Card.AsciiMapping[string[1].toLowerCase()] : '');

  }

  static check(cards, string) {
    return cards.map(card => card.toAsciiString()).join('') == string;
  }
}

module.exports = Card;
