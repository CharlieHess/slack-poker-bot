require('babel/register');

var rx = require('rx');
var assert = require('chai').assert;

var PlayerOrder = require('../src/player-order');

describe('PlayerOrder', function() {
  describe('the determine method', function() {

    it("should never change the order of the source array", function() {
      let players = ['0', '1', '2', '3'];
      PlayerOrder.determine(players, dealerButton, 'flop');

      assert(players[0] == '0');
      assert(players[1] == '1');
      assert(players[2] == '2');
      assert(players[3] == '3');
    });

    it("should ensure that cards are always dealt to the SB first", function() {
      let players = ['DB', 'SB', 'BB', 'UTG'];
      let orderedPlayers = PlayerOrder.determine(players, dealerButton, 'deal');

      assert(orderedPlayers[0] == 'SB');
      assert(orderedPlayers[1] == 'BB');
      assert(orderedPlayers[2] == 'UTG');
      assert(orderedPlayers[3] == 'DB');
    });
  });
});
