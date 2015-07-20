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

  static isLastToAct(actingPlayer, players) {
    let playersRemaining = _.filter(players, player => player.isInHand);
    let currentIndex = playersRemaining.indexOf(actingPlayer);

    let bettor = _.find(playersRemaining, player => player.isBettor);
    let bettorIndex = playersRemaining.indexOf(bettor);

    let bigBlind =_.find(playersRemaining, player => player.isBigBlind);
    let bigBlindIndex = playersRemaining.indexOf(bigBlind);

    console.log(`Current player index: ${currentIndex}, bettor index: ${bettorIndex}, big blind index: ${bigBlindIndex}`);
    return bigBlind ?
      currentIndex === bigBlindIndex :
      currentIndex + 1 === bettorIndex;
  }
};
