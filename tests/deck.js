require('babel/register');

var _ = require('underscore-plus');
var assert = require('chai').assert;

var Deck = require('../src/deck');

describe('Deck', function() {
  it('should contain 52 cards', function() {
    var deck = new Deck();
    assert(deck.cards !== null);
    assert(deck.cards.length === 52);
  });
  
  it('should contain 1 card of every suit and rank', function() {
    var deck = new Deck();
    
    var suitGroups = _.groupBy(deck.cards, function(c) { return c.suit; });
    var rankGroups = _.groupBy(deck.cards, function(c) { return c.rank; });
    
    var keys = _.keys(suitGroups);
    
    assert(keys.length === 4);
    for (var key in keys) {
      assert(suitGroups[key].length === 13);
    }
    
    keys = _.keys(rankGroups);
    
    assert(keys.length === 13);
    for (key in keys) {
      assert(rankGroups[key].length === 4);
    }
  });
});