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

  describe('the actionFromMessage method', function() {
    it('should parse check, call, and fold actions', function() {
      var availableActions = ['check', 'bet', 'fold'];
      var action = PlayerInteraction.actionFromMessage('C', availableActions);
      assert(action.name === 'check');

      action = PlayerInteraction.actionFromMessage(' CHECK  ', availableActions);
      assert(action.name === 'check');

      action = PlayerInteraction.actionFromMessage('Check mumble mumble', availableActions);
      assert(action.name == 'check');

      action = PlayerInteraction.actionFromMessage('mumble mumble Check', availableActions);
      assert(action === null);

      action = PlayerInteraction.actionFromMessage('c2', availableActions);
      assert(action === null);

      action = PlayerInteraction.actionFromMessage('wat?', availableActions);
      assert(action === null);

      action = PlayerInteraction.actionFromMessage('A B C', availableActions);
      assert(action === null);

      availableActions = ['call', 'raise', 'fold'];
      action = PlayerInteraction.actionFromMessage('c', availableActions);
      assert(action.name === 'call');

      action = PlayerInteraction.actionFromMessage('CaLl', availableActions);
      assert(action.name === 'call');

      action = PlayerInteraction.actionFromMessage('calling a phone number', availableActions);
      assert(action === null);

      action = PlayerInteraction.actionFromMessage('FOLD', availableActions);
      assert(action.name === 'fold');

      action = PlayerInteraction.actionFromMessage('     f', availableActions);
      assert(action.name === 'fold');

      action = PlayerInteraction.actionFromMessage('     ffffff', availableActions);
      assert(action === null);
    });

    it('should parse bet and raise actions', function() {
      var availableActions = ['check', 'bet', 'fold'];
      var action = PlayerInteraction.actionFromMessage('BET', availableActions);
      assert(action.name === 'bet');
      assert(isNaN(action.amount));

      action = PlayerInteraction.actionFromMessage('bet 25', availableActions);
      assert(action.name === 'bet');
      assert(action.amount === 25);

      action = PlayerInteraction.actionFromMessage('bet    5000', availableActions);
      assert(action.name === 'bet');
      assert(action.amount === 5000);

      action = PlayerInteraction.actionFromMessage('bet some money 999', availableActions);
      assert(action.name === 'bet');
      assert(isNaN(action.amount));

      action = PlayerInteraction.actionFromMessage('not a bet', availableActions);
      assert(action === null);

      action = PlayerInteraction.actionFromMessage('55 bet 88', availableActions);
      assert(action === null);

      availableActions = ['call', 'raise', 'fold'];
      action = PlayerInteraction.actionFromMessage('raise infinity', availableActions);
      assert(action.name === 'raise');
      assert(isNaN(action.amount));

      action = PlayerInteraction.actionFromMessage('  RAISE    200   ', availableActions);
      assert(action.name === 'raise');
      assert(action.amount === 200);

      action = PlayerInteraction.actionFromMessage('raising children is hard', availableActions);
      assert(action === null);
    });
  });
});
