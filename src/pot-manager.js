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
  
  createPot(participants, amount=0) {
    this.currentPot = { 
      participants: participants, 
      amount: amount 
    };
    this.pots.push(this.currentPot);
  }
  
  startBettingRound() {
    this.currentBet = 0;
    this.allInPlayers = [];
  }
  
  endBettingRound() {
    for (let player of this.allInPlayers) {
      let otherPlayers = _.without(this.currentPot.participants, player);
      let sidePotParticipants = _.filter(otherPlayers, p => p.chips > 0);
      
      if (sidePotParticipants.length > 0) {
        let sidePotAmount = 0;
        
        let shortStackDelta = this.currentBet - player.lastAction.amount;
        if (shortStackDelta > 0) {
          sidePotAmount = shortStackDelta * sidePotParticipants.length;
          this.currentPot.amount -= sidePotAmount;
        }
        
        this.createPot(sidePotParticipants, sidePotAmount);
      }
    }
  }
  
  updatePotForAction(player, action) {
    switch (action.name) {
    case 'fold':
      this.removePlayerFromAllPots(player);
      break;
    case 'call':
      // Calls don't specify an amount, but they are a wager nonetheless.
      action.amount = this.currentBet;
      this.updateChipsAndPot(player, action);
      break;
    case 'bet':
    case 'raise':
      this.correctInvalidBets(action);
      this.currentBet = this.updateChipsAndPot(player, action);
      break;
    }
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
    
    if (player.chips === 0) {
      this.allInPlayers.push(player);
    }

    return action.amount;
  }

  doShowdown(playerHands, board) {
    let outcome = [];
    for (let pot of this.pots) {
      pot.result = HandEvaluator.evaluateHands(pot.participants, playerHands, board);
      this.handleOutcome(pot);
      outcome.push(pot.result);
    }
    
    if (outcome.length === 1) {
      this.outcomes.push(outcome[0]);
    } else {
      this.outcomes.push(outcome);
    }
  }
  
  endHand(result) {
    this.currentPot.result = result;
    this.handleOutcome(this.currentPot);
    this.outcomes.push(result);
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
          message += `and ${winner.name} split the pot of $${pot.amount}`;
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
  }
  
  getTotalChips() {
    return _.reduce(this.pots, (total, pot) => total + pot.amount, 0);
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