const _ = require('underscore-plus');

const HandEvaluator = require('./hand-evaluator');

class PotManager {
  constructor(channel, players) {
    this.channel = channel;
    this.players = players;

    this.pots = [];
    this.outcomes = [];
  }
  
  startPot(participants) {
    this.currentPot = { amount: 0, participants: participants };
    this.pots.push(this.currentPot);
  }
  
  addToPot(bet) {
    this.currentPot.amount += bet;
  }
  
  removePlayerFromPot(player) {
    let index = this.currentPot.participants.indexOf(player);
    this.currentPot.participants.splice(index, 1);
  }
  
  getTotalChips() {
    return _.reduce(this.pots, (total, pot) => total + pot.amount, 0);
  }
  
  doShowdown(playerHands, board) {
    for (let pot of this.pots) {
      pot.result = HandEvaluator.evaluateHands(pot.participants, playerHands, board);
      this.handleOutcome(pot);
    }
  }
  
  endHand(result) {
    this.currentPot.result = result;
    this.handleOutcome(this.currentPot);
  }
  
  handleOutcome(pot) {
    let message = '';
    let result = pot.result;
    
    if (result.isSplitPot) {
      _.each(result.winners, winner => {
        if (_.last(result.winners) !== winner) {
          message += `${winner.name}, `;
          winner.chips += Math.floor(pot.amount / result.winners.length);
        } else {
          message += `and ${winner.name} split the pot`;
          winner.chips += Math.ceil(pot.amount / result.winners.length);
        }
      });
      message += ` with ${result.handName}: ${result.hand.toString()}.`;
    } else {
      message = `${result.winners[0].name} wins $${pot.amount}`;
      if (result.hand) {
        message += ` with ${result.handName}: ${result.hand.toString()}.`;
      } else {
        message += '.';
      }
      result.winners[0].chips += pot.amount;
    }
    
    this.channel.send(message);
    this.outcomes.push(result);
  }
}

module.exports = PotManager;