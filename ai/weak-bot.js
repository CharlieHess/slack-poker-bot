const rx = require('rx');
const uuid = require('uuid');
const _ = require('underscore-plus');

module.exports =
class WeakBot {
  constructor(name) {
    this.id = uuid.v4();
    this.name = name;

    this.isBot = true;
    this.holeCards = [];
  }

  // LOL WEAK
  getAction(availableActions, previousActions) {
    let action = availableActions.indexOf('check') > -1 ? 'check' : 'call';
    let delay = 1000 + (Math.random() * 3000);
    return rx.Observable.timer(delay).map(() => action);
  }
};
