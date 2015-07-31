const textTable = require('text-table');

class PlayerStatus {
  // Public: Displays a fixed-width text table showing all of the players in
  // the hand, relevant position information (blinds, dealer button),
  // information about the player's bet, and an indicator of who's next to act.
  //
  // channel - The channel where the status message will be displayed
  // players - The players in the hand
  // actingPlayer - The player taking action
  // dealerButton - The index of the dealer button
  // bigBlind - The index of the big blind
  // smallBlind - The index of the small blind
  // tableFormatter - (Optional) String that will wrap the text table and can
  //                  provide additional formatting
  //
  // Returns nothing
  static displayHandStatus(channel, players, actingPlayer,
    dealerButton, bigBlind, smallBlind, tableFormatter=`\`\`\``) {
    let table = [];

    for (let idx = 0; idx < players.length; idx++) {
      let row = [];

      let player = players[idx];
      let turnIndicator = player === actingPlayer ? '→ ' : '  ';
      row.push(`${turnIndicator}${player.name}`);
      row.push(`$${player.chips}`);

      let handIndicator = player.isInHand ? '🂠' : ' ';
      row.push(handIndicator);

      let dealerIndicator = idx === dealerButton ? 'Ⓓ' : ' ';
      row.push(dealerIndicator);

      let bigBlindText = idx === bigBlind ? 'Ⓑ' : null;
      let smallBlindText = idx === smallBlind ? 'Ⓢ' : null;
      let blindIndicator = bigBlindText || smallBlindText || ' ';
      row.push(blindIndicator);

      if (player.lastAction) {
        let actionIndicator = player.lastAction.name;
        if (actionIndicator === 'bet' || actionIndicator === 'raise') {
          actionIndicator += ` $${player.lastAction.amount}`;
        }
        row.push(actionIndicator);
      } else {
        row.push('');
      }

      table.push(row);
    }

    let fixedWidthTable = `${tableFormatter}${textTable(table)}${tableFormatter}`;
    channel.send(fixedWidthTable);
  }
}

module.exports = PlayerStatus;
