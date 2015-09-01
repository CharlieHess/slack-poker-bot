require('babel/register');

var _ = require('underscore-plus');
var assert = require('chai').assert;

var Deck = require('../src/deck');

describe('Deck', function() {
  it('should contain 52 cards before and after shuffling', function() {
    var deck = new Deck();
    assert(deck.cards !== null);
    assert(deck.cards.length === 52);

    deck.shuffle();
    assert(deck.cards.length === 52);
  });

  it('should contain 1 card of every suit and rank', function() {
    var deck = new Deck();

    var suitGroups = _.groupBy(deck.cards, 'suit');
    var rankGroups = _.groupBy(deck.cards, 'rank');

    var keys = _.keys(suitGroups);

    assert(keys.length === 4);
    for (var i = 0; i < keys.length; i++) {
      assert(suitGroups[keys[i]].length === 13);
    }

    keys = _.keys(rankGroups);

    assert(keys.length === 13);
    for (i = 0; i < keys.length; i++) {
      assert(rankGroups[keys[i]].length === 4);
    }
  });

  it('should be modified when a card is drawn', function() {
    var deck = new Deck();
    deck.shuffle();

    deck.drawCard();
    deck.drawCard();
    deck.drawCard();

    assert(deck.cards.length === 49);
  });

  it('should be printable', function() {
    var deck = new Deck();
    var deckString = '2♠,3♠,4♠,5♠,6♠,7♠,8♠,9♠,T♠,J♠,Q♠,K♠,A♠,2♥,3♥,4♥,5♥,6♥,7♥,8♥,9♥,T♥,J♥,Q♥,K♥,A♥,2♦,3♦,4♦,5♦,6♦,7♦,8♦,9♦,T♦,J♦,Q♦,K♦,A♦,2♣,3♣,4♣,5♣,6♣,7♣,8♣,9♣,T♣,J♣,Q♣,K♣,A♣';

    assert(deck.toString() === deckString);
  });
});
