const textTable = require('text-table');

class PlayerStatus {
  // Public: Displays a fixed-width text table showing all of the players in
  // the game, relevant position information (blinds, dealer button),
  // information about the player's bet, and an indicator of who's next to act.
  //
  // channel - The channel where the status message will be displayed
  // players - The players in the game
  // actingPlayer - The player taking action
  // potManager - Holds information about the current pot
  // dealerButton - The index of the dealer button
  // bigBlind - The index of the big blind
  // smallBlind - The index of the small blind
  // tableFormatter - (Optional) String that will wrap the text table and can
  //                  provide additional formatting
  //
  // Returns nothing
  static displayHandStatus(channel, players, actingPlayer,
    potManager, dealerButton, bigBlind, smallBlind, tableFormatter=`\`\`\``) {
    let table = [];

    for (let idx = 0; idx < players.length; idx++) {
      let row = [];

      let player = players[idx];
      let turnIndicator = player === actingPlayer ? '→ ' : '  ';
      row.push(`${turnIndicator}${player.name}`);
      row.push(`$${player.chips}`);

      let handIndicator = player.isInHand ? '🂠' : ' ';
      row.push(handIndicator);

      let dealerText = idx === dealerButton ? 'Ⓓ' : null;
      let smallBlindText = idx === smallBlind ? 'Ⓢ' : null;
      let bigBlindText = idx === bigBlind ? 'Ⓑ' : null;
      let positionIndicator = bigBlindText || smallBlindText || dealerText || ' ';
      row.push(positionIndicator);

      if (player.lastAction) {
        let actionIndicator = player.lastAction.name;
        if (player.lastAction.amount > 0) {
          actionIndicator += ` $${player.lastAction.amount}`;
        }
        row.push(actionIndicator);
      } else {
        row.push('');
      }

      table.push(row);
    }

    let handStatus = `${tableFormatter}${textTable(table)}${tableFormatter}`;
    let potBreakdown = '';
    
    for (let idx = 0; idx < potManager.pots.length; idx++) {
      let amount = potManager.pots[idx].amount;
      if (amount === 0) continue;
      
      if (idx === 0) {
        potBreakdown += `Main Pot: $${amount}\n`;
      } else {
        potBreakdown += `Side Pot: $${amount}\n`;
      }
    }
    
    handStatus = `${handStatus}\n${potBreakdown}`;
    channel.send(handStatus);
  }
}

module.exports = PlayerStatus;
