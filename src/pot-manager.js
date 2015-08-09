const _ = require('underscore-plus');

const HandEvaluator = require('./hand-evaluator');

class PotManager {
  constructor(channel, players, minimumBet) {
    this.channel = channel;
    this.players = players;
    this.minimumBet = minimumBet;

    this.pots = [];
    this.outcomes = [];
  }
  
  startHand(participants) {
    this.currentPot = { amount: 0, participants: participants };
    this.pots.push(this.currentPot);
  }
  
  startBettingRound() {
    this.currentBet = 0;
  }
  
  updatePotForAction(player, action) {
    switch (action.name) {
    case 'check':
      return;
    case 'fold':
      this.removePlayerFromAllPots(player);
      return;
    case 'call':
      // Calls don't specify an amount, but they are a wager nonetheless.
      action.amount = this.currentBet;
      break;
    case 'bet':
    case 'raise':
      this.correctInvalidBets(action);
      break;
    }
    
    this.currentBet = this.updateChipsAndPot(player, action);
  }

  // Private: Update a player's chip stack and the pot based on a wager.
  //
  // player - The calling / betting player
  // action - The action the player took
  //
  // Returns the amount of the wager after taking the player's available chips
  // into account.
  updateChipsAndPot(player, action) {
    let previousWager = player.lastAction ? player.lastAction.amount : 0;
    let availableChips = player.chips + previousWager;

    if (action.amount >= availableChips) {
      action.amount = availableChips;
    }

    let wagerIncrease = action.amount - previousWager;
    player.chips -= wagerIncrease;
    this.currentPot.amount += wagerIncrease;

    return action.amount;
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
  
  removePlayerFromAllPots(player) {
    for (let pot of this.pots) {
      let index = pot.participants.indexOf(player);
      pot.participants.splice(index, 1);
    }
  }
  
  correctInvalidBets(action) {
    if (isNaN(action.amount)) {
      // If another player has bet, the default raise is 2x. Otherwise use the
      // minimum bet (1 small blind).
      action.amount = this.currentBet ?
        this.currentBet * 2 :
        this.minimumBet;
    }
  }
}

module.exports = PotManager;