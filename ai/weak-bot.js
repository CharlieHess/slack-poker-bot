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
  getAction(availableActions, previousActions) {
    let action = availableActions.indexOf('check') > -1 ?
      { name: 'check' } :
      { name: 'call' };
      
    let delay = 2000 + (Math.random() * 4000);
    return rx.Observable.timer(delay)
      .flatMap(() => rx.Observable.return(action));
  }
};
