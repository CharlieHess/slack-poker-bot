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
    var unicodeDeck = '2♠,3♠,4♠,5♠,6♠,7♠,8♠,9♠,T♠,J♠,Q♠,K♠,A♠,2♥,3♥,4♥,5♥,6♥,7♥,8♥,9♥,T♥,J♥,Q♥,K♥,A♥,2♦,3♦,4♦,5♦,6♦,7♦,8♦,9♦,T♦,J♦,Q♦,K♦,A♦,2♣,3♣,4♣,5♣,6♣,7♣,8♣,9♣,T♣,J♣,Q♣,K♣,A♣';
    var asciiDeck = '2s,3s,4s,5s,6s,7s,8s,9s,Ts,Js,Qs,Ks,As,2h,3h,4h,5h,6h,7h,8h,9h,Th,Jh,Qh,Kh,Ah,2d,3d,4d,5d,6d,7d,8d,9d,Td,Jd,Qd,Kd,Ad,2c,3c,4c,5c,6c,7c,8c,9c,Tc,Jc,Qc,Kc,Ac';

    assert(deck.toString() === unicodeDeck);
    assert(deck.toAsciiString() === asciiDeck);
  });
});
