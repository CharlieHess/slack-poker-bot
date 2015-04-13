require('babel/register');

var assert = require('chai').assert;

var Card = require('../src/card');

describe('Card', function() {
  it('should display the short-hand syntax for card names', function() {
    var card = new Card('J', 'Spades');
    assert.equal(card.toString(), 'Js');
    
    card = new Card('4', 'Diamonds');
    assert.equal(card.toString(), '4d');
    
    card = new Card('T', 'Clubs');
    assert.equal(card.toString(), 'Tc');
    
    card = new Card('A', 'Hearts');
    assert.equal(card.toString(), 'Ah');
  });
});