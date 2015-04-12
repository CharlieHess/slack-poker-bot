require('babel/register');

var assert = require('chai').assert;

var Deck = require('../src/deck');

describe('Deck', function() {
  it('should contain 52 cards', function() {
    var deck = new Deck();
    assert(deck.cards !== null);
    assert(deck.cards.length === 52);
  });
});