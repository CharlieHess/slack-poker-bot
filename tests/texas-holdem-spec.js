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

    // NB: We don't want to create any images during tests, so just have this
    // function write to the console.
    game.postBoard = function(round) {
      console.log("Dealing the " + round + ": " + game.board.toString());
      return rx.Observable.return(true);
    };
  });

  it('should handle player timeout by folding, or if possible, checking', function() {
    game.start(0);
    scheduler.advanceBy(5000);

    // Patrik is UTG and is going to timeout.
    assert(game.actingPlayer.name === 'Patrik Antonius');
    scheduler.advanceBy(30000);

    // Bye bye Patrik.
    var playersInHand = game.getPlayersInHand();
    assert(playersInHand.length === 4);
    assert(game.actingPlayer.name === 'Chip Reese');

    // Everyone else calls.
    messages.onNext({user: 5, text: "Call"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 1, text: "call"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 2, text: "call"});
    scheduler.advanceBy(5000);

    // Option to Stu, who also times out.
    assert(game.actingPlayer.name === 'Stu Ungar');
    assert(game.board.length === 0);
    scheduler.advanceBy(30000);

    // But we kindly checked for him since he's in the BB.
    playersInHand = game.getPlayersInHand();
    assert(playersInHand.length === 4);
    assert(game.actingPlayer.name === 'Doyle Brunson');
    game.quit();
  });

  it('should handle a complex hand correctly', function() {
    // Start with Phil Ivey (index 0) as dealer.
    game.start(0);
    scheduler.advanceBy(5000);

    // Doyle is SB, Stu is BB, Patrik is UTG.
    assert(game.actingPlayer.name === 'Patrik Antonius');

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
    assert(game.actingPlayer.name === 'Stu Ungar');
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
    assert(game.board.length === 3);
    assert(game.actingPlayer.name === 'Doyle Brunson');

    // Stu tries a continuation bet, which Doyle calls.
    messages.onNext({user: 2, text: "check"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 3, text: "Bet"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 2, text: "call"});
    scheduler.advanceBy(5000);

    assert(game.actingPlayer.name === 'Doyle Brunson');
    assert(game.board.length === 4);

    // Stu fires another round, but Doyle check-raises him.
    messages.onNext({user: 2, text: "Check"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 3, text: "Bet"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 2, text: "Raise"});
    scheduler.advanceBy(5000);

    assert(game.actingPlayer.name === 'Stu Ungar');
    assert(game.board.length === 4);

    // Stu reluctantly calls.
    messages.onNext({user: 3, text: "Call"});
    scheduler.advanceBy(5000);

    assert(game.actingPlayer.name === 'Doyle Brunson');
    assert(game.board.length === 5);

    // Now Doyle leads on the river and Stu calls him down.
    messages.onNext({user: 2, text: "Bet"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 3, text: "Call"});
    scheduler.advanceBy(5000);

    // Someone won, although the result isn't important. Check that the hand
    // was ended and that the dealer button moved.
    assert(game.board.length === 0);
    assert(game.dealerButton === 1);
    game.quit();
  });
});
