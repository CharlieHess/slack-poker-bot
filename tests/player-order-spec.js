require('babel/register');

var rx = require('rx');
var assert = require('chai').assert;

var PlayerOrder = require('../src/player-order');

describe('PlayerOrder', function() {
  describe('the determine method', function() {

    it("should never change the order of the source array", function() {
      var players = ['0', '1', '2', '3'];
      var dealerButton = 0;
      PlayerOrder.determine(players, dealerButton, 'flop');

      assert(players[0] == '0');
      assert(players[1] == '1');
      assert(players[2] == '2');
      assert(players[3] == '3');
    });

    it("should always deal cards to the SB first", function() {
      var players = ['DB', 'SB', 'BB', 'UTG'];
      var dealerButton = 0;
      var orderedPlayers = PlayerOrder.determine(players, dealerButton, 'deal');

      assert(orderedPlayers[0] == 'SB');
      assert(orderedPlayers[1] == 'BB');
      assert(orderedPlayers[2] == 'UTG');
      assert(orderedPlayers[3] == 'DB');
    });

    it("should skip the blinds during preflop rounds, but deal SB first in the other rounds", function() {
      var players = ['DB', 'SB', 'BB', 'UTG'];
      var dealerButton = 0;
      var orderedPlayers = PlayerOrder.determine(players, dealerButton, 'preflop');

      assert(orderedPlayers[0] == 'UTG');
      assert(orderedPlayers[1] == 'DB');
      assert(orderedPlayers[2] == 'SB');
      assert(orderedPlayers[3] == 'BB');

      orderedPlayers = PlayerOrder.determine(players, dealerButton, 'flop');

      assert(orderedPlayers[0] == 'SB');
      assert(orderedPlayers[1] == 'BB');
      assert(orderedPlayers[2] == 'UTG');
      assert(orderedPlayers[3] == 'DB');
    });

    it("should handle heads-up play", function() {
      var players = ['DB', 'SB'];
      var dealerButton = 0;
      var orderedPlayers = PlayerOrder.determine(players, dealerButton, 'deal');

      assert(orderedPlayers[0] == 'SB');
      assert(orderedPlayers[1] == 'DB');

      orderedPlayers = PlayerOrder.determine(players, dealerButton, 'preflop');

      assert(orderedPlayers[0] == 'SB');
      assert(orderedPlayers[1] == 'DB');

      orderedPlayers = PlayerOrder.determine(players, dealerButton, 'flop');

      assert(orderedPlayers[0] == 'SB');
      assert(orderedPlayers[1] == 'DB');
    });
  });
});
