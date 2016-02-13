require('babel/register');

const rx = require('rx');
const _ = require('lodash');
const assert = require('chai').assert;

const ChinesePoker = require('../src/chinese-poker');
const Card = require('../src/card');
const Deck = require('../src/deck');

describe('ChinesePoker', function() {
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
    messages.subscribe(m => {
      if (m.user && m.text) {
        console.log(`${players.find(p => p.id == m.user).name}: ${m.text}`);
      }
    });
    
    scheduler = new rx.HistoricalScheduler();
    players = [
      { id: 1, name: 'Phil Ivey' },
      { id: 2, name: 'Doyle Brunson' },
      { id: 3, name: 'Stu Ungar' }
    ];

    game = new ChinesePoker(slack, messages, channel, players, scheduler);
    var emptyDm = { send: function() { /* no-op */ } };
    playerDms = { 1: emptyDm, 2: emptyDm, 3: emptyDm };
  });
  
  it('check standard play and scoring', function() {
    game.resetDeck = () => {
      return new Deck().replaceTop([
        '4s','4c','5s','3c','9d'
      ]);
    };
    game.start(playerDms, 0);

    scheduler.advanceBy(1000);
    messages.onNext({user: 1, text: '4s5s3,4c9,'});

    assert(Card.check(players[0].playField[2], ''));
    assert(Card.check(players[0].playField[1], '4c9d'));
    assert(Card.check(players[0].playField[0], '4s5s3c'));
  });
});
