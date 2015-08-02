require('babel/register');

var rx = require('rx');
var assert = require('chai').assert;

var Card = require('../src/card');
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

    // Improves the appearance of player status in the console.
    game.tableFormatter = "\n";
  });

  it('should handle all-ins correctly', function() {
    game.start(0);
    scheduler.advanceBy(5000);

    messages.onNext({user: 4, text: "call"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 5, text: "fold"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 1, text: "raise 20"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 2, text: "Fold"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 3, text: "Fold"});
    scheduler.advanceBy(5000);

    messages.onNext({user: 4, text: "Raise 200"});
    scheduler.advanceBy(5000);

    assert(game.currentBet === 198);
    assert(players[3].chips === 0);
    assert(players[3].isAllIn);

    messages.onNext({user: 1, text: "Call"});
    assert(game.currentPot === 403);
    scheduler.advanceBy(5000);

    var winner = game.lastHandResult.winners[0];
    assert(winner.id === 1 || winner.id === 4);
    assert(game.board.length === 0);
    game.quit();
  });

  it('should handle split pots correctly', function() {
    game.start(0);
    scheduler.advanceBy(5000);

    messages.onNext({user: 4, text: "Call"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 5, text: "Fold"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 1, text: "Fold"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 2, text: "Fold"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 3, text: "Check"});
    scheduler.advanceBy(5000);

    messages.onNext({user: 3, text: "Check"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 4, text: "Check"});
    scheduler.advanceBy(5000);

    messages.onNext({user: 3, text: "Check"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 4, text: "Check"});
    scheduler.advanceBy(5000);

    // Override the game board and player hands to guarantee a split pot.
    game.board = [
      new Card('A', 'Hearts'),
      new Card('8', 'Spades'),
      new Card('8', 'Diamonds'),
      new Card('8', 'Clubs'),
      new Card('8', 'Hearts'),
    ];

    game.playerHands[3] = [
      new Card('2', 'Clubs'),
      new Card('3', 'Hearts')
    ];

    game.playerHands[4] = [
      new Card('2', 'Diamonds'),
      new Card('3', 'Spades')
    ];

    messages.onNext({user: 3, text: "Check"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 4, text: "Check"});
    scheduler.advanceBy(5000);

    assert(game.lastHandResult.isSplitPot);
    assert(game.lastHandResult.winners.length === 2);
    assert(game.lastHandResult.handName === 'four of a kind');
    game.quit();
  });

  it('should assign a winner if everyone folds', function() {
    game.start(0);
    scheduler.advanceBy(5000);

    messages.onNext({user: 4, text: "Fold"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 5, text: "Fold"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 1, text: "Fold"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 2, text: "Fold"});
    scheduler.advanceBy(5000);

    assert(game.lastHandResult.winners[0].name === 'Stu Ungar');
    assert(!game.lastHandResult.isSplitPot);
    game.quit();
  });

  it('should handle consecutive raises correctly', function() {
    game.start(0);
    scheduler.advanceBy(5000);

    // A flurry of raises, starting with Patrik.
    messages.onNext({user: 4, text: "Raise"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 5, text: "raise"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 1, text: "Raise"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 2, text: "Fold"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 3, text: "fold"});
    scheduler.advanceBy(5000);

    var playersInHand = game.getPlayersInHand();
    assert(playersInHand.length === 3);
    assert(game.actingPlayer.name === 'Patrik Antonius');

    messages.onNext({user: 4, text: "Call"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 5, text: "Fold"});
    scheduler.advanceBy(5000);

    // Patrik and Phil are still left in the hand.
    playersInHand = game.getPlayersInHand();
    assert(playersInHand.length === 2);
    assert(game.actingPlayer.name === 'Patrik Antonius');
    game.quit();
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

    // Call all the way down to Stu.
    messages.onNext({user: 4, text: "Call"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 5, text: "Call"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 1, text: "call"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 2, text: "Call"});
    scheduler.advanceBy(5000);

    // Stu has the option, and raises.
    assert(game.actingPlayer.name === 'Stu Ungar');
    messages.onNext({user: 3, text: "Raise"});
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

    // Check that one of the last two players won, although the result is
    // random. Also assert that the hand was ended and the dealer button moved.
    var winner = game.lastHandResult.winners[0];
    assert(winner.id === 2 || winner.id === 3);
    assert(game.board.length === 0);
    assert(game.dealerButton === 1);
    game.quit();
  });
});
