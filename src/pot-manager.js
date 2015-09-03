const _ = require('underscore-plus');

const HandEvaluator = require('./hand-evaluator');

class PotManager {
  // Public: Creates a new instance of {PotManager}, which is used to manage
  // pots and store outcomes for the duration of a game.
  //
  // channel - The channel where the game is taking place
  // players - The players participating in the game
  // minimumBet - The minimum bet in the game
  constructor(channel, players, minimumBet) {
    this.channel = channel;
    this.players = players;
    this.minimumBet = minimumBet;

    this.pots = [];
    this.outcomes = [];
  }
  
  // Public: Creates a new pot and assigns it as the current destination for
  // bets. This can occur at the start of a hand or at the end of a betting
  // round, when making side pots.
  //
  // participants - The players participating in the pot
  // amount - (Optional) The starting amount in the pot, defaults to 0
  //
  // Returns nothing
  createPot(participants, amount=0) {
    // Trim out any empty pots; this can occasionally occur when creating side
    // pots for multiple all-in players.
    if (this.currentPot && this.currentPot.amount === 0) {
      let index = this.pots.indexOf(this.currentPot);
      this.pots.splice(index, 1);
    }
    
    this.currentPot = { 
      participants: participants, 
      amount: amount 
    };
    
    this.pots.push(this.currentPot);
  }
  
  // Public: Resets state for the start of a betting round.
  //
  // Returns nothing
  startBettingRound() {
    this.currentBet = 0;
    this.allInPlayers = [];
  }
  
  // Public: Handles any post-round work, primarily the creation of side pots
  // for any players who went all-in during the round.
  //
  // Returns nothing
  endBettingRound() {
    // NB: It's important to start with the shortest stacks, as those will be
    // the first side pots created.
    this.allInPlayers = _.sortBy(this.allInPlayers, p => p.lastAction.amount);

    // Stash a reference to the current pot, as any side pots created at this
    // time will take chips from there.
    let mainPot = this.currentPot;
    let amountSetAside = 0;

    for (let player of this.allInPlayers) {
      amountSetAside += this.createSidePot(player);
    }
    
    mainPot.amount -= amountSetAside;
  }
  
  // Public: Updates the current pot based on a player action.
  //
  // player - The acting player
  // action - The action the player took
  //
  // Returns nothing
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
      this.correctInvalidBets(player, action);
      this.currentBet = this.updateChipsAndPot(player, action);
      break;
    }
  }
  
  // Private: Creates a side pot for the given player.
  //
  // player - The player who went all-in during the last betting round
  //
  // Returns the number of chips allocated to the side pot
  createSidePot(player) {
    // NB: We want to calculate the delta between this player's wager and the
    // next highest wager, multiplied by the number of callers, and set that
    // amount aside.
    let currentWager = player.lastAction.amount;
    let nextHighestWager = this.getNextHighestWager(player.lastAction.amount);

    // We then remove this player from the side pot.
    let sidePotParticipants = _.without(this.currentPot.participants, player);
    let sidePotAmount = 0;
    
    // The amount we place in the side pot is the difference in wagers,
    // multiplied by the number of callers.
    let potDelta = nextHighestWager - currentWager;
    if (potDelta > 0) {
      sidePotAmount = potDelta * sidePotParticipants.length;
    }
    
    this.createPot(sidePotParticipants, sidePotAmount);
    return sidePotAmount;
  }
  
  // Private: Given a wager, return the next highest wager from any player who
  // went all-in during the last betting round. If none is found, return the
  // current bet.
  //
  // currentWager - The amount wagered by an all-in player
  //
  // Returns the amount of the next highest wager
  getNextHighestWager(currentWager) {
    let wagers = this.allInPlayers
      .map(p => p.lastAction.amount)
      .sort((a, b) => a - b);
    wagers.push(this.currentBet);
    wagers = _.uniq(wagers);

    let nextIndex = wagers.indexOf(currentWager) + 1;
    return wagers[nextIndex] || wagers[wagers.length - 1];
  }

  // Private: Update a player's chip stack and the pot based on a wager.
  //
  // player - The calling / betting player
  // action - The action the player took
  //
  // Returns the amount of the wager after taking the player's available chips
  // into account.
  updateChipsAndPot(player, action) {
    let previousWager = (player.lastAction && player.lastAction.amount) ?
      player.lastAction.amount : 0;
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

  // Private: End a hand by evaluating pocket cards and deciding on a winner.
  //
  // playerHands - A map of players to their pocket cards
  // board - An array of five community cards
  //
  // Returns nothing
  endHandWithShowdown(playerHands, board) {
    let outcome = [];
    
    // Evaluate the main pot and side pots separately, as each pot has a unique
    // set of players eligible to win the hand.
    for (let pot of this.pots) {
      if (pot.amount === 0) continue;
      
      pot.result = HandEvaluator.evaluateHands(pot.participants, playerHands, board);
      this.handleOutcome(pot);
      outcome.push(pot.result);
    }
    
    // If there are multiple outcomes, push the array as a result. Otherwise,
    // just push the single result.
    if (outcome.length === 1) {
      this.outcomes.push(outcome[0]);
    } else {
      this.outcomes.push(outcome);
    }
    
    this.pots = [];
  }
  
  // Private: End a hand without evaluating pocket cards.
  //
  // result - An object identifying the winning player
  //
  // Returns nothing
  endHand(result) {
    let outcome = [];
    
    for (let pot of this.pots) {
      if (pot.amount === 0) continue;
      
      pot.result = result;
      this.handleOutcome(pot);
      outcome.push(pot.result);
    }
    
    if (outcome.length === 1) {
      this.outcomes.push(outcome[0]);
    } else {
      this.outcomes.push(outcome);
    }
    this.pots = [];
  }
  
  // Private: Given a pot that has ended, display a message to the channel
  // declaring the winner(s) of that pot, the amount(s) won, and the winning
  // hand, if a showdown was required.
  //
  // pot - The pot that has ended
  //
  // Returns nothing
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
  
  // Public: Returns the total number of chips in all pots. Primarily used for
  // testing.
  getTotalChips() {
    return _.reduce(this.pots, (total, pot) => total + pot.amount, 0);
  }
  
  // Private: When a player folds, they are no longer eligible to win any pot.
  removePlayerFromAllPots(player) {
    for (let pot of this.pots) {
      let index = pot.participants.indexOf(player);
      pot.participants.splice(index, 1);
    }
  }
  
  // Private: Correct any irregular bets or raises.
  //
  // player - The player who bet or raise
  // action - The action they took
  //
  // Returns nothing
  correctInvalidBets(player, action) {
    // NB: No bet was specified.
    if (isNaN(action.amount)) {
      // If another player has bet, the default raise is 2x. Otherwise use the
      // minimum bet (1 small blind).
      action.amount = this.currentBet ?
        this.currentBet * 2 :
        this.minimumBet;
    }
    
    // If this raise was too small, set it to 2x the current bet.
    if (action.name === 'raise' && action.amount < this.currentBet * 2) {
      action.amount = this.currentBet * 2;
    }
    
    if (action.amount > this.currentBet) {
      // If there are no players left in the hand with chips, and a player
      // raises, the raise is actually a call.
      let playersWhoCanCall = _.filter(this.players, p => p.isInHand && p !== player && p.chips > 0);
      if (playersWhoCanCall.length === 0) {
        action.amount = this.currentBet;
      }
    }
  }
}

module.exports = PotManager;