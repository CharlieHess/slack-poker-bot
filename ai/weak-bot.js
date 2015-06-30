const rx = require('rx');
const uuid = require('uuid');

module.exports =
class WeakBot {
  constructor(name) {
    this.id = uuid.v4();
    this.name = name;

    this.isBot = true;
    this.holeCards = [];
  }

  // LOL WEAK
  getAction(previousActions) {
    let action = previousActions.indexOf('bet') > -1 ? 'fold' : 'check';
    return rx.Observable.timer(500).map(() => action);
  }
};
