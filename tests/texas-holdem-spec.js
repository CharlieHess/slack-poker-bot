require('babel/register');

var rx = require('rx');
var assert = require('chai').assert;

var TexasHoldem = require('../src/texas-holdem');

describe('TexasHoldem', function() {
  var game;
  var slack, messages, channel, players, scheduler;

  beforeEach(function() {
    slack = {
      token: 0xDEADBEEF,
      getDMByName: function() {
        return { send: function() { } };
      }
    };
    messages = new rx.Subject();
    channel = {
      send: function(message) {
        console.log(message);
        return { updateMessage: function() { } };
      }
    };
    scheduler = new rx.HistoricalScheduler();
    players = [
      { id: 1, name: 'Phil Ivey' },
      { id: 2, name: 'Doyle Brunson' },
      { id: 3, name: 'Stu Ungar' },
      { id: 4, name: 'Patrik Antonius' },
      { id: 5, name: 'Chip Reese' }
    ];

    game = new TexasHoldem(slack, messages, channel, players, scheduler);
    
    // NB: We don't want to create any images during tests, so just wipe this
    // function out entirely.
    game.postBoard = function() { };
  });

  it('should not die a fiery death', function() {
    // Start with Phil Ivey (index 0) as dealer.
    game.start(0);
    scheduler.advanceBy(5000);

    // Doyle is SB, Stu is BB, Patrik is UTG.
    // Check all the way down to Stu.
    messages.onNext({user: 4, text: "Check"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 5, text: "Check"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 1, text: "check"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 2, text: "Check"});
    scheduler.advanceBy(5000);

    // Stu makes a bet.
    messages.onNext({user: 3, text: "Bet"});
    scheduler.advanceBy(5000);

    // Everyone folds except Doyle.
    messages.onNext({user: 4, text: "fold"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 5, text: "Fold"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 1, text: "fold"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 2, text: "Call"});
    scheduler.advanceBy(5000);

    var playersInHand = game.getPlayersInHand();
    assert(playersInHand.length === 2);
    assert(playersInHand[0].name === 'Doyle Brunson');
    assert(playersInHand[1].name === 'Stu Ungar');

    game.quit();
  });
});
