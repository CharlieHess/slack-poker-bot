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
        '4s','4c','5s','3c','9d',
        'Jh','4h','Qc','Ts','Th',
        '5c','6h','As','Kd','8h',
        
        '2s',
        '7d',
        '8c',
        
        'Ad',
        '9s',
        'Qh',
        
        'Tc',
        '2d',
        'Jc',
        
        '8s',
        '3h',
        '5d',
        
        'Ac',
        '9h',
        'Jd',

        '2h',
        'Qd',
        'Ks',

        '7c',
        'Qs',
        'Jc',
        
        '8d',
        'Qc',
        'Ah'
      ]);
    };
    game.start(playerDms, 0);

    scheduler.advanceBy(1000);
    messages.onNext({user: 1, text: '4s5s3,4c9,'});
    assert(Card.check(players[0].playField[2], ''));
    assert(Card.check(players[0].playField[1], '4c9d'));
    assert(Card.check(players[0].playField[0], '4s5s3c'));

    scheduler.advanceBy(1000);
    messages.onNext({user: 2, text: 'th4j,ts,q'});
    assert(Card.check(players[1].playField[2], 'Qc'));
    assert(Card.check(players[1].playField[1], 'Ts'));
    assert(Card.check(players[1].playField[0], 'Th4hJh'));

    scheduler.advanceBy(1000);
    messages.onNext({user: 3, text: 'As5,Kd8h,6'});
    assert(Card.check(players[2].playField[2], '6h'));
    assert(Card.check(players[2].playField[1], 'Kd8h'));
    assert(Card.check(players[2].playField[0], 'As5c'));



    scheduler.advanceBy(1000);
    messages.onNext({user: 1, text: 'b'});
    assert(Card.check(players[0].playField[2], ''));
    assert(Card.check(players[0].playField[1], '4c9d'));
    assert(Card.check(players[0].playField[0], '4s5s3c2s'));

    scheduler.advanceBy(1000);
    messages.onNext({user: 2, text: 'm'});
    assert(Card.check(players[1].playField[2], 'Qc'));
    assert(Card.check(players[1].playField[1], 'Ts7d'));
    assert(Card.check(players[1].playField[0], 'Th4hJh'));

    scheduler.advanceBy(1000);
    messages.onNext({user: 3, text: 'm'});
    assert(Card.check(players[2].playField[2], '6h'));
    assert(Card.check(players[2].playField[1], 'Kd8h8c'));
    assert(Card.check(players[2].playField[0], 'As5c'));



    scheduler.advanceBy(1000);
    messages.onNext({user: 1, text: 'b'});
    assert(Card.check(players[0].playField[2], ''));
    assert(Card.check(players[0].playField[1], '4c9d'));
    assert(Card.check(players[0].playField[0], '4s5s3c2sAd'));

    scheduler.advanceBy(1000);
    messages.onNext({user: 2, text: 'm'});
    assert(Card.check(players[1].playField[2], 'Qc'));
    assert(Card.check(players[1].playField[1], 'Ts7d9s'));
    assert(Card.check(players[1].playField[0], 'Th4hJh'));

    scheduler.advanceBy(1000);
    messages.onNext({user: 3, text: 't'});
    assert(Card.check(players[2].playField[2], '6hQh'));
    assert(Card.check(players[2].playField[1], 'Kd8h8c'));
    assert(Card.check(players[2].playField[0], 'As5c'));



    scheduler.advanceBy(1000);
    messages.onNext({user: 1, text: 'm'});
    assert(Card.check(players[0].playField[2], ''));
    assert(Card.check(players[0].playField[1], '4c9dTc'));
    assert(Card.check(players[0].playField[0], '4s5s3c2sAd'));

    scheduler.advanceBy(1000);
    messages.onNext({user: 2, text: 't'});
    assert(Card.check(players[1].playField[2], 'Qc2d'));
    assert(Card.check(players[1].playField[1], 'Ts7d9s'));
    assert(Card.check(players[1].playField[0], 'Th4hJh'));

    scheduler.advanceBy(1000);
    messages.onNext({user: 3, text: 'b'});
    assert(Card.check(players[2].playField[2], '6hQh'));
    assert(Card.check(players[2].playField[1], 'Kd8h8c'));
    assert(Card.check(players[2].playField[0], 'As5cJc'));



    scheduler.advanceBy(1000);
    messages.onNext({user: 1, text: 't'});
    assert(Card.check(players[0].playField[2], '8s'));
    assert(Card.check(players[0].playField[1], '4c9dTc'));
    assert(Card.check(players[0].playField[0], '4s5s3c2sAd'));

    scheduler.advanceBy(1000);
    messages.onNext({user: 2, text: 'b'});
    assert(Card.check(players[1].playField[2], 'Qc2d'));
    assert(Card.check(players[1].playField[1], 'Ts7d9s'));
    assert(Card.check(players[1].playField[0], 'Th4hJh3h'));

    scheduler.advanceBy(1000);
    messages.onNext({user: 3, text: 'b'});
    assert(Card.check(players[2].playField[2], '6hQh'));
    assert(Card.check(players[2].playField[1], 'Kd8h8c'));
    assert(Card.check(players[2].playField[0], 'As5cJc5d'));



    scheduler.advanceBy(1000);
    messages.onNext({user: 1, text: 'm'});
    assert(Card.check(players[0].playField[2], '8s'));
    assert(Card.check(players[0].playField[1], '4c9dTcAc'));
    assert(Card.check(players[0].playField[0], '4s5s3c2sAd'));

    scheduler.advanceBy(1000);
    messages.onNext({user: 2, text: 'b'});
    assert(Card.check(players[1].playField[2], 'Qc2d'));
    assert(Card.check(players[1].playField[1], 'Ts7d9s'));
    assert(Card.check(players[1].playField[0], 'Th4hJh3h9h'));

    scheduler.advanceBy(1000);
    messages.onNext({user: 3, text: 'b'});
    assert(Card.check(players[2].playField[2], '6hQh'));
    assert(Card.check(players[2].playField[1], 'Kd8h8c'));
    assert(Card.check(players[2].playField[0], 'As5cJc5dJd'));



    scheduler.advanceBy(1000);
    messages.onNext({user: 1, text: 't'});
    assert(Card.check(players[0].playField[2], '8s2h'));
    assert(Card.check(players[0].playField[1], '4c9dTcAc'));
    assert(Card.check(players[0].playField[0], '4s5s3c2sAd'));

    scheduler.advanceBy(1000);
    messages.onNext({user: 2, text: 'm'});
    assert(Card.check(players[1].playField[2], 'Qc2d'));
    assert(Card.check(players[1].playField[1], 'Ts7d9sQd'));
    assert(Card.check(players[1].playField[0], 'Th4hJh3h9h'));

    scheduler.advanceBy(1000);
    messages.onNext({user: 3, text: 't'});
    assert(Card.check(players[2].playField[2], '6hQhKs'));
    assert(Card.check(players[2].playField[1], 'Kd8h8c'));
    assert(Card.check(players[2].playField[0], 'As5cJc5dJd'));



    scheduler.advanceBy(1000);
    messages.onNext({user: 1, text: 't'});
    assert(Card.check(players[0].playField[2], '8s2h7c'));
    assert(Card.check(players[0].playField[1], '4c9dTcAc'));
    assert(Card.check(players[0].playField[0], '4s5s3c2sAd'));

    scheduler.advanceBy(1000);
    messages.onNext({user: 2, text: 'm'});
    assert(Card.check(players[1].playField[2], 'Qc2d'));
    assert(Card.check(players[1].playField[1], 'Ts7d9sQdQs'));
    assert(Card.check(players[1].playField[0], 'Th4hJh3h9h'));

    scheduler.advanceBy(1000);
    messages.onNext({user: 3, text: 'm'});
    assert(Card.check(players[2].playField[2], '6hQhKs'));
    assert(Card.check(players[2].playField[1], 'Kd8h8cJc'));
    assert(Card.check(players[2].playField[0], 'As5cJc5dJd'));



    scheduler.advanceBy(1000);
    messages.onNext({user: 1, text: 'm'});
    assert(Card.check(players[0].playField[2], '8s2h7c'));
    assert(Card.check(players[0].playField[1], '4c9dTcAc8d'));
    assert(Card.check(players[0].playField[0], '4s5s3c2sAd'));

    scheduler.advanceBy(1000);
    messages.onNext({user: 2, text: 't'});
    assert(Card.check(players[1].playField[2], 'Qc2dQc'));
    assert(Card.check(players[1].playField[1], 'Ts7d9sQdQs'));
    assert(Card.check(players[1].playField[0], 'Th4hJh3h9h'));

    scheduler.advanceBy(1000);
    messages.onNext({user: 3, text: 'm'});
    assert(Card.check(players[2].playField[2], '6hQhKs'));
    assert(Card.check(players[2].playField[1], 'Kd8h8cJcAh'));
    assert(Card.check(players[2].playField[0], 'As5cJc5dJd'));
  });
});
