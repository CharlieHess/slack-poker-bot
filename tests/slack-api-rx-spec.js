require('babel/register');

var rx = require('rx');
var _ = require('underscore-plus');
var assert = require('chai').assert;

var SlackApiRx = require('../src/slack-api-rx');

describe('SlackApiRx', function() {
  var players, openDms, scheduler, slack;

  beforeEach(function() {
    players = [
      { id: 1, name: 'Johnny Chan' },
      { id: 2, name: 'Phil Hellmuth' },
      { id: 3, name: 'Jennifer Harman' },
      { id: 4, name: 'John Juanda' },
      { id: 5, name: 'Erik Seidel' }
    ];
    
    openDms = {
      1: { is_open: true, },
      2: { is_open: true, },
      3: { is_open: true, },
      4: { is_open: true, },
      5: { is_open: true, }
    };
    
    scheduler = new rx.HistoricalScheduler();
    
    slack = {
      getDMByName: function(name) {
        var player = _.find(players, function(p) {
          return p.name === name;
        });
        return openDms[player.id];
      },
      
      openDM: function(id, callback) {
        rx.Observable.timer(1000, scheduler).subscribe(() => {
          openDms[id] = { is_open: true };
          callback({ ok: true });
        })
      }
    }
  });
  
  describe('the openDms method', function() {
    it('should open or create any DM channels that are not yet open', function() {
      delete openDms[1];
      delete openDms[3];
      openDms[5].is_open = false;
      
      SlackApiRx.openDms(slack, players).subscribe();
      scheduler.advanceBy(1500);
      
      assert(openDms[1] && openDms[1].is_open);
      assert(openDms[3] && openDms[3].is_open);
      assert(openDms[5].is_open);
    });
    
    it('should not signal completion until the API call is complete', function() {
      openDms[1].is_open = false;
      
      var didOpen = false;
      SlackApiRx.openDms(slack, players).subscribe(function() {
        didOpen = true;
      });
      
      scheduler.advanceBy(500);
      assert(!didOpen);
    });
    
    it('should not try to open DM channels that are already open', function() {
      var didOpen = false;
      slack.openDM = function() {
        didOpen = true;
      };
      
      SlackApiRx.openDms(slack, players).subscribe();
      scheduler.advanceBy(1500);
      
      assert(!didOpen);
    });
  });
});