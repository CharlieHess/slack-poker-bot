const _ = require('underscore-plus');

class Pot {
  constructor(players) {
    this.currentPot = { amount: 0, participants: players.map(p => p.id) };
    this.pots = [ this.currentPot ];
  }
  
  add(bet) {
    this.currentPot.amount += bet;
  }
  
  getTotalChips() {
    return _.reduce(this.pots, (total, pot) => total + pot.amount, 0);
  }
  
  handleResult(result) {
    let message = '';
    if (result.isSplitPot) {
      _.each(result.winners, winner => {
        if (_.last(result.winners) !== winner) {
          message += `${winner.name}, `;
          winner.chips += Math.floor(this.currentPot.amount / result.winners.length);
        } else {
          message += `and ${winner.name} split the pot`;
          winner.chips += Math.ceil(this.currentPot.amount / result.winners.length);
        }
      });
      message += ` with ${result.handName}: ${result.hand.toString()}.`;
    } else {
      message = `${result.winners[0].name} wins $${this.currentPot.amount}`;
      if (result.hand) {
        message += ` with ${result.handName}: ${result.hand.toString()}.`;
      } else {
        message += '.';
      }
      result.winners[0].chips += this.currentPot.amount;
    }
    return message;
  }
}

module.exports = Pot;