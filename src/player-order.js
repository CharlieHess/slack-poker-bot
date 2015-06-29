module.exports = class PlayerOrder {

  // Public: Determines the order for players during a particular round of
  // action. We build up a new array from the source `players`, starting with
  // the first to act and moving in round-robin fashion.
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
}
