require('babel/register');

var assert = require('chai').assert;

var Card = require('../src/card');

describe('Card', function() {
  it('should display the short-hand syntax for card names', function() {
    var card = new Card('J', 'Spades');
    assert.equal(card.toString(), 'J♠');

    card = new Card('4', 'Diamonds');
    assert.equal(card.toString(), '4♦');

    card = new Card('T', 'Clubs');
    assert.equal(card.toString(), 'T♣');

    card = new Card('A', 'Hearts');
    assert.equal(card.toString(), 'A♥');
  });
});
