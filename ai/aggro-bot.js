const rx = require('rx');
const uuid = require('uuid');

module.exports =
class AggroBot {
  constructor(name) {
    this.id = uuid.v4();
    this.name = name;

    this.isBot = true;
    this.holeCards = [];
  }

  // TOO STRONK
  getAction(availableActions, previousActions) {
    let action = availableActions.indexOf('raise') > -1 ?
      { name: 'raise' } :
      { name: 'bet' };
    let delay = 1000 + (Math.random() * 500);
    return rx.Observable.timer(delay).map(() => action);
  }
};
