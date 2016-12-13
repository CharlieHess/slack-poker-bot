import _ from 'underscore-plus';

export class PlayerOrder {

  /**
   * Determines the order for players during a particular round of action. We
   * build up a new array from the source `players`, starting with the first to
   * act and moving in round-robin fashion.
   *
   * @param  {Array} players        The source array, that will remain unchanged
   * @param  {Number} dealerButton  The index of the dealer button within the players array
   * @param  {String} round         A string describing the round, e.g., 'preflop', 'flop'
   * @return {Array                 A new array with the players in sorted order
   */
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

  /**
   * Determines if the acting player is the last to act in a betting round.
   * Given a list of players sorted by position, this is accomplished by
   * comparing indices.
   *
   * @param  {Player} actingPlayer  The player who is acting
   * @param  {Array} players        An array of all players in the hand, sorted by position
   * @return {Boolean}              True if this player is the last to act, false otherwise
   */
  static isLastToAct(actingPlayer, players) {
    let playersRemaining = _.filter(players, p => p.isInHand && p.isInRound);
    let currentIndex = playersRemaining.indexOf(actingPlayer);

    let bettor = _.find(playersRemaining, p => p.isBettor);
    let bettorIndex = playersRemaining.indexOf(bettor);

    // If there's no bettor, our list is already in sorted order: just
    // compare against the last item.
    if (!bettor) {
      return actingPlayer === _.last(playersRemaining);
    }

    // If there is a bettor, there are two cases we need to handle:
    // 1. Default case; is this the player immediately before the bettor?
    // 2. Special case; a player in the BB has an option to raise.
    let nextIndex = PlayerOrder.getNextPlayerIndex(currentIndex, playersRemaining);
    let playerWithOption = _.find(playersRemaining, p => p.hasOption);

    return !playerWithOption ?
      nextIndex === bettorIndex :
      actingPlayer === playerWithOption;
  }

  /**
   * Returns the index of the next player to act.
   *
   * @param  {Number} index   The current index
   * @param  {Array} players  An array of all players in the hand, sorted by position
   * @return {Number}         The index of the next player in the hand
   */
  static getNextPlayerIndex(index, players) {
    let player = null;
    do {
      index = (index + 1) % players.length;
      player = players[index];
    } while (!player.isInHand || !player.isInRound);

    return index;
  }
}
