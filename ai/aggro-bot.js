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
    let desiredAction = 'call';

    if (availableActions.indexOf('raise') > -1) {
      desiredAction = 'raise';
    } else if (availableActions.indexOf('bet') > -1) {
      desiredAction = 'bet';
    }

    let delay = 2000 + (Math.random() * 2000);
    return rx.Observable.timer(delay).map(() => {
      return { name: desiredAction };
    });
  }
};
