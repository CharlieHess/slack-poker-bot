require('babel/register');

var rx = require('rx');
var _ = require('underscore-plus');
var assert = require('chai').assert;

var Card = require('../src/card');
var TexasHoldem = require('../src/texas-holdem');

describe('TexasHoldem', function() {
  var game, slack, messages, channel, scheduler, players, playerDms;

  beforeEach(function() {
    slack = { token: 0xDEADBEEF };
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
    var emptyDm = { send: function() { /* no-op */ } };
    playerDms = { 1: emptyDm, 2: emptyDm, 3: emptyDm, 4: emptyDm, 5: emptyDm };

    // We don't want to create any images during tests, so just have this
    // function write to the console.
    game.postBoard = function(round) {
      console.log("Dealing the " + round + ": " + game.board.toString());
      return rx.Observable.return(true);
    };

    // Improves the appearance of player status in the console.
    game.tableFormatter = "\n";
  });
  
  it('should handle players who are forced all-in by posting blinds', function() {
    game.start(playerDms, 0);
    
    // Sad Patrik.
    players[3].chips = 2;
    scheduler.advanceBy(5000);

    messages.onNext({user: 4, text: "Fold"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 5, text: "Fold"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 1, text: "Fold"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 2, text: "Fold"});
    scheduler.advanceBy(10000);
    
    messages.onNext({user: 5, text: "Fold"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 1, text: "Fold"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 2, text: "Fold"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 3, text: "Call"});
    scheduler.advanceBy(5000);
    
    // Patrik either doubled up (2 * 2 = 4, minus the SB = 3), or lost it all.
    assert(game.potManager.outcomes.length === 2);
    assert(players[3].chips === 3 || players[3].chips === 0);
  });
  
  it('should award the pot to an all-in player if everyone else folds', function() {
    game.start(playerDms, 0);
    scheduler.advanceBy(5000);

    messages.onNext({user: 4, text: "Fold"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 5, text: "Raise 200"});
    scheduler.advanceBy(5000);

    messages.onNext({user: 1, text: "Fold"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 2, text: "Fold"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 3, text: "Fold"});
    scheduler.advanceBy(5000);
    
    assert(players[4].chips === 203);
  });
  
  it('should handle multiple rounds with all-ins', function() {
    game.start(playerDms, 0);
    
    players[0].chips = 200;
    players[1].chips = 149;
    players[2].chips = 98;
    players[3].chips = 75;
    players[4].chips = 50;
    scheduler.advanceBy(5000);
    
    messages.onNext({user: 4, text: "Fold"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 5, text: "Call"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 1, text: "Call"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 2, text: "Call"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 3, text: "Raise 8"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 5, text: "Raise 50"});
    scheduler.advanceBy(5000);
    assert(game.potManager.getTotalChips() === 62);
    
    messages.onNext({user: 1, text: "Call"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 2, text: "Call"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 3, text: "Call"});
    scheduler.advanceBy(5000);
    assert(game.potManager.getTotalChips() === 200);
    assert(game.potManager.pots.length === 2);
    
    messages.onNext({user: 2, text: "Bet 60"});
    scheduler.advanceBy(5000);
    assert(game.potManager.pots[0].amount === 200);
    assert(game.potManager.pots[1].amount === 60);
    
    // Stu only has 50 chips left, so this is an all-in.
    messages.onNext({user: 3, text: "Call"});
    scheduler.advanceBy(5000);
    assert(game.potManager.pots[0].amount === 200);
    assert(game.potManager.pots[1].amount === 110);

    // 60 - 50 = 10 * 2 callers = 20 chips on the side.
    messages.onNext({user: 1, text: "Call"});
    scheduler.advanceBy(5000);
    assert(game.potManager.pots.length === 3);
    assert(game.potManager.pots[0].amount === 200);
    assert(game.potManager.pots[1].amount === 150);
    assert(game.potManager.pots[2].amount === 20);
    
    messages.onNext({user: 2, text: "Check"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 1, text: "Bet 10"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 2, text: "Call"});
    scheduler.advanceBy(5000);
    assert(game.potManager.pots.length === 3);
    assert(game.potManager.pots[0].amount === 200);
    assert(game.potManager.pots[1].amount === 150);
    assert(game.potManager.pots[2].amount === 40);
    
    messages.onNext({user: 2, text: "Bet 30"});
    scheduler.advanceBy(5000);
    assert(game.potManager.pots.length === 3);
    assert(game.potManager.pots[0].amount === 200);
    assert(game.potManager.pots[1].amount === 150);
    assert(game.potManager.pots[2].amount === 70);
    
    assert(players[0].chips === 80);
    assert(players[1].chips === 0);
    assert(players[2].chips === 0);
    assert(players[3].chips === 75);
    assert(players[4].chips === 0);
    
    messages.onNext({user: 1, text: "Call"});
    scheduler.advanceBy(5000);
    
    var chipTotalAfter = _.reduce(players, function(total, player) { 
      return total + player.chips; 
    }, 0);
    
    assert(game.isRunning);
    assert(game.potManager.pots.length === 1);
    assert(game.potManager.pots[0].amount === 3);
    assert(chipTotalAfter === 572);
  });
  
  it('should handle multiple side pots and all-ins over the top (scenario 1)', function() {
    game.start(playerDms, 0);
    
    // Lots of short stacks this time around.
    players[0].chips = 200;
    players[1].chips = 149;
    players[2].chips = 98;
    players[3].chips = 75;
    players[4].chips = 50;
    scheduler.advanceBy(5000);
    
    var chipTotalBefore = _.reduce(players, function(total, player) { 
      return total + player.chips; 
    }, 0);

    messages.onNext({user: 4, text: "Call"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 5, text: "Raise 50"});
    scheduler.advanceBy(5000);
    assert(players[4].chips === 0);
    assert(game.potManager.pots[0].amount === 55);
    
    messages.onNext({user: 1, text: "Call"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 2, text: "Call"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 3, text: "Call"});
    scheduler.advanceBy(5000);
    assert(game.potManager.pots[0].amount === 202);
    
    // Over the top all-in.
    messages.onNext({user: 4, text: "Raise 75"});
    scheduler.advanceBy(5000);
    assert(players[3].chips === 0);
    assert(game.potManager.pots[0].amount === 275);
    
    messages.onNext({user: 1, text: "Call"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 2, text: "Call"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 3, text: "Raise 100"});
    scheduler.advanceBy(5000);
    assert(players[2].chips === 0);
    assert(game.potManager.pots[0].amount === 375);
    
    messages.onNext({user: 1, text: "Call"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 2, text: "Call"});
    scheduler.advanceBy(5000);
    
    assert(game.potManager.pots.length === 4);
    assert(game.potManager.pots[0].amount === 250);
    assert(game.potManager.pots[1].amount === 100);
    assert(game.potManager.pots[2].amount === 75);
    assert(game.potManager.pots[3].amount === 0);
    
    messages.onNext({user: 2, text: "Bet 50"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 1, text: "Call"});
    scheduler.advanceBy(5000);

    var chipTotalAfter = _.reduce(players, function(total, player) {
      return total + player.chips;
    }, 0);
    
    // If the game has ended, blinds won't be posted, causing the chip total to
    // differ slightly.
    assert(!game.isRunning || chipTotalBefore === chipTotalAfter);
  });
  
  it('should handle multiple side pots and all-ins over the top (scenario 2)', function() {
    game.start(playerDms, 0);
    
    players[1].chips = 149;
    players[2].chips = 73;
    players[3].chips = 75;
    players[4].chips = 50;
    scheduler.advanceBy(5000);

    messages.onNext({user: 4, text: "Call"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 5, text: "Raise 50"});
    scheduler.advanceBy(5000);
    assert(players[4].chips === 0);
    assert(game.potManager.pots[0].amount === 55);
    
    messages.onNext({user: 1, text: "Call"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 2, text: "Call"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 3, text: "Call"});
    scheduler.advanceBy(5000);
    assert(game.potManager.pots[0].amount === 202);

    messages.onNext({user: 4, text: "Raise 75"});
    scheduler.advanceBy(5000);
    assert(players[3].chips === 0);
    assert(game.potManager.pots[0].amount === 275);
    
    messages.onNext({user: 1, text: "Call"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 2, text: "Call"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 3, text: "Call"});
    scheduler.advanceBy(5000);
    
    assert(players[2].chips === 0);
    assert(game.potManager.pots.length === 3);
    assert(game.potManager.pots[0].amount === 250);
    assert(game.potManager.pots[1].amount === 100);
    assert(game.potManager.pots[2].amount === 0);
  });
  
  it("should divide pots based on a player's stake", function() {
    game.start(playerDms, 0);

    // Give Chip a small stack for this test.
    players[4].chips = 50;
    scheduler.advanceBy(5000);

    messages.onNext({user: 4, text: "Fold"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 5, text: "Raise 50"});
    scheduler.advanceBy(5000);
    assert(players[4].isAllIn);

    messages.onNext({user: 1, text: "Fold"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 2, text: "Call"});
    scheduler.advanceBy(5000);
    assert(players[1].chips === 150);
    assert(game.potManager.pots[0].amount === 102);

    messages.onNext({user: 3, text: "Call"});
    scheduler.advanceBy(5000);
    assert(game.potManager.pots[0].amount === 150);

    // Get a side pot going.
    assert(game.actingPlayer.name === 'Doyle Brunson');
    messages.onNext({user: 2, text: "Bet 10"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 3, text: "Call"});
    scheduler.advanceBy(5000);
    assert(game.potManager.pots[0].amount === 150);
    assert(game.potManager.pots[1].amount === 20);

    messages.onNext({user: 2, text: "Bet 20"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 3, text: "Call"});
    scheduler.advanceBy(5000);
    assert(game.potManager.pots[1].amount === 60);

    // Override the game board and player hands to guarantee Chip wins.
    game.board = [
      new Card('A', 'Hearts'),
      new Card('K', 'Hearts'),
      new Card('Q', 'Hearts'),
      new Card('J', 'Hearts'),
      new Card('2', 'Hearts'),
    ];

    game.playerHands[5] = [
      new Card('T', 'Hearts'),
      new Card('9', 'Hearts')
    ];

    game.playerHands[2] = [
      new Card('2', 'Clubs'),
      new Card('3', 'Clubs')
    ];

    game.playerHands[3] = [
      new Card('4', 'Clubs'),
      new Card('5', 'Clubs')
    ];

    messages.onNext({user: 2, text: "Check"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 3, text: "Bet 20"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 2, text: "Raise 80"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 3, text: "Call"});
    scheduler.advanceBy(5000);

    // Chip triples up his initial stack of 50.
    var lastResult = game.potManager.outcomes.pop();
    assert(lastResult.length === 2);
    assert(!lastResult[0].isSplitPot);
    assert(lastResult[0].winners[0].name === 'Chip Reese');
    assert(lastResult[0].winners[0].chips === 150);
    
    // Doyle and Stu split the remainder (Stu would be 150, but posted SB).
    assert(lastResult[1].isSplitPot);
    assert(lastResult[1].winners.length === 2);
    assert(lastResult[1].winners[0].name === 'Doyle Brunson');
    assert(lastResult[1].winners[1].name === 'Stu Ungar');
    assert(players[1].chips === 150);
    assert(players[2].chips === 149);
    
    game.quit();
  });

  it('should end the game when all players have been eliminated', function() {
    game.start(playerDms, 0);
    scheduler.advanceBy(5000);

    messages.onNext({user: 4, text: "Raise 200"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 5, text: "Call"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 1, text: "Call"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 2, text: "Call"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 3, text: "Call"});
    scheduler.advanceBy(5000);

    // If the game is still running, the last hand was a tie.
    var lastResult = game.potManager.outcomes.pop();
    assert(!game.isRunning || (lastResult && lastResult.isSplitPot));
  });

  it('should handle default bets and raises', function() {
    game.start(playerDms, 0);
    scheduler.advanceBy(5000);

    messages.onNext({user: 4, text: "raise"});
    scheduler.advanceBy(5000);
    assert(game.potManager.currentBet === 4);
    assert(game.potManager.getTotalChips() === 7);

    messages.onNext({user: 5, text: "raise"});
    scheduler.advanceBy(5000);
    assert(game.potManager.currentBet === 8);
    assert(game.potManager.getTotalChips() === 15);

    messages.onNext({user: 1, text: "raise"});
    scheduler.advanceBy(5000);
    assert(game.potManager.currentBet === 16);
    assert(game.potManager.getTotalChips() === 31);

    messages.onNext({user: 2, text: "fold"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 3, text: "fold"});
    scheduler.advanceBy(5000);

    messages.onNext({user: 4, text: "call"});
    scheduler.advanceBy(5000);
    assert(game.potManager.currentBet === 16);
    assert(game.potManager.getTotalChips() === 43);

    messages.onNext({user: 5, text: "call"});
    scheduler.advanceBy(5000);
    assert(game.potManager.currentBet === 0);
    assert(game.potManager.getTotalChips() === 51);

    messages.onNext({user: 4, text: "bet"});
    scheduler.advanceBy(5000);
    assert(game.potManager.currentBet === 1);
    assert(game.potManager.getTotalChips() === 52);

    game.quit();
  });

  it('should handle all-ins correctly', function() {
    game.start(playerDms, 0);
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

    assert(game.potManager.currentBet === 200);
    assert(game.potManager.getTotalChips() === 223);
    assert(players[3].chips === 0);
    assert(players[3].isAllIn);

    messages.onNext({user: 1, text: "Call"});
    scheduler.advanceBy(5000);

    var lastResult = game.potManager.outcomes.pop();
    var winner = lastResult.winners[0];
    assert(winner.id === 1 || winner.id === 4);

    // Check that the losing player was eliminated, or that the pot was split.
    assert(game.board.length === 0);
    assert(game.getPlayersInHand().length === 4 || lastResult.isSplitPot);
    game.quit();
  });

  it('should handle split pots correctly', function() {
    game.start(playerDms, 0);
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

    var lastResult = game.potManager.outcomes.pop();
    assert(lastResult.isSplitPot);
    assert(lastResult.winners.length === 2);
    assert(lastResult.handName === 'four of a kind');
    game.quit();
  });

  it('should assign a winner if everyone folds', function() {
    game.start(playerDms, 0);
    scheduler.advanceBy(5000);

    messages.onNext({user: 4, text: "Fold"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 5, text: "Fold"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 1, text: "Fold"});
    scheduler.advanceBy(5000);
    messages.onNext({user: 2, text: "Fold"});
    scheduler.advanceBy(5000);

    var lastResult = game.potManager.outcomes.pop();
    assert(lastResult.winners[0].name === 'Stu Ungar');
    assert(!lastResult.isSplitPot);
    game.quit();
  });

  it('should handle consecutive raises correctly', function() {
    game.start(playerDms, 0);
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
    game.start(playerDms, 0);
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
    game.start(playerDms, 0);
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
    assert(game.potManager.getTotalChips() === 10);
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
    var lastResult = game.potManager.outcomes.pop();
    var winner = lastResult.winners[0];
    assert(winner.id === 2 || winner.id === 3);
    assert(game.board.length === 0);
    assert(game.dealerButton === 1);
    game.quit();
  });
});
