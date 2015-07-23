const _ = require('underscore-plus');

module.exports = class PlayerOrder {

  // Public: Determines the order for players during a particular round of
  // action. We build up a new array from the source `players`, starting with
  // the first to act and moving in round-robin fashion.
  //
  // players - The source array, that will remain unchanged
  // dealerButton - The index of the dealer button within the `players` array
  // round - A string describing the round, e.g., 'preflop', 'flop'
  //
  // Returns a new array with the players in sorted order
  static determine(players, dealerButton, round) {
    // NB: During the preflop betting round, SB (1) and BB (2) are skipped and
    // we start with UTG (3). Every other round starts with the SB.
    let offsetFromButton = round === 'preflop' ? 3 : 1;

    // Calculate the index of the first player to act.
    let firstToAct = (dealerButton + offsetFromButton) % players.length;

    let orderedPlayers = [];

    for (let index = 0; index < players.length; index++) {
      let sourceIndex = (firstToAct + index) % players.length;
      orderedPlayers.push(players[sourceIndex]);
    }

    return orderedPlayers;
  }

  // Public: Determines if the acting player is the last to act in a betting
  // round. Given a list of players sorted by position, this is accomplished by
  // comparing indices.
  //
  // actingPlayer - The player who is acting
  // players - A list of all players in the hand, sorted by position
  //
  // Returns true if this player is the last to act, false otherwise
  static isLastToAct(actingPlayer, players) {
    let playersRemaining = _.filter(players, p => p.isInHand);
    let currentIndex = playersRemaining.indexOf(actingPlayer);

    let bettor = _.find(playersRemaining, p => p.isBettor);
    let bettorIndex = playersRemaining.indexOf(bettor);

    let playerWithOption =_.find(playersRemaining, p => p.hasOption);
    let optionIndex = playersRemaining.indexOf(playerWithOption);

    return playerWithOption ?
      currentIndex === optionIndex :
      (currentIndex + 1) % playersRemaining.length === bettorIndex;
  }
};
