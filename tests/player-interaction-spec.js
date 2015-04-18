require('babel/register');

var rx = require('rx');
var assert = require('chai').assert;

var PlayerInteraction = require('../src/player-interaction');

describe('PlayerInteraction', function() {
  describe('the pollPotentialPlayers method', function() {
    var messages, channel, scheduler, players;

    // We can fake out messages to the channel using a `Subject` and simulate
    // time passing using the `HistoricalScheduler`.
    beforeEach(function() {
      messages = new rx.Subject();
      channel = { 
        send: function() { 
          // NB: Posting a message to the channel returns an editable message
          // object, which we're faking out here.
          return { updateMessage: function() { } };
        } 
      };
      scheduler = new rx.HistoricalScheduler();
      players = [];
    });
    
    it("should add players when they respond with 'yes'", function() {
      PlayerInteraction.pollPotentialPlayers(messages, channel, scheduler)
        .subscribe(function(userId) { players.push(userId); });
        
      messages.onNext({ 
        user: 'Phil Hellmuth',
        text: '*Characteristic whining* But yes.'
      });
      
      messages.onNext({
        user: 'Daniel Negreanu',
        text: 'Absolutely not.'
      });
      
      messages.onNext({
        user: 'Dan Harrington',
        text: 'Yes, count me in.'
      });
      
      assert(players.length === 2);
      assert(players[0] === 'Phil Hellmuth');
      assert(players[1] === 'Dan Harrington');
    });
    
    it('should not add players more than once', function() {
      PlayerInteraction.pollPotentialPlayers(messages, channel, scheduler)
        .subscribe(function(userId) { players.push(userId); });
        
      messages.onNext({ 
        user: 'Johnny Chan',
        text: 'Yes, take me back to 87.'
      });
      
      messages.onNext({ 
        user: 'Johnny Chan',
        text: 'Hell 88 works too (yes).'
      });
      
      assert(players.length === 1);
      assert(players[0] === 'Johnny Chan');
    });
    
    it('should stop polling when the maximum number of players is reached', function() {
      PlayerInteraction.pollPotentialPlayers(messages, channel, scheduler, 10, 2)
        .subscribe(function(userId) { players.push(userId); });
        
      messages.onNext({user: 'Stu Ungar', text: 'Yes'});
      messages.onNext({user: 'Amarillo Slim', text: 'Yes'});
      messages.onNext({user: 'Doyle Brunson', text: 'Yes'});
      
      assert(players.length === 2);
      assert(players[0] === 'Stu Ungar');
      assert(players[1] === 'Amarillo Slim');
    });
    
    it('should stop polling when time expires', function() {
      PlayerInteraction.pollPotentialPlayers(messages, channel, scheduler, 5)
        .subscribe(function(userId) { players.push(userId); });
        
      messages.onNext({user: 'Chris Ferguson', text: 'Yes'});
      scheduler.advanceBy(2000);
      
      messages.onNext({user: 'Scotty Nguyen', text: 'Yes'});
      scheduler.advanceBy(4000);
      
      messages.onNext({user: 'Greg Raymer', text: 'Yes'});
      
      assert(players.length === 2);
      assert(players[0] === 'Chris Ferguson');
      assert(players[1] === 'Scotty Nguyen');
    });
  });
});