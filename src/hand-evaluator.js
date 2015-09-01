const pokerEvaluator = require('poker-evaluator');

const Combinations = require('../util/combinations');

class HandEvaluator {
  // Public: For each player, create a 7-card hand by combining their hole
  // cards with the board, then pass that to our evaluator library to get the
  // type of hand and its ranking among types. If it's better than the best
  // hand we've seen so far, assign a winner.
  //
  // players - Players in the hand
  // playerHands - A map of player ID to their hand
  // board - An array of five {Card} objects representing the board
  //
  // Returns an object containing the winning player(s) and information about
  // their hand(s).
  static evaluateHands(players, playerHands, board) {
    let bestHand = { handType: 0, handRank: 0 };
    let winners = [];
    let cardArray = null;

    for (let player of players) {
      let sevenCardHand = [...playerHands[player.id], ...board];
      let evalInput = sevenCardHand.map(card => card.toAsciiString());
      let currentHand = pokerEvaluator.evalHand(evalInput);

      if (currentHand.handType > bestHand.handType ||
        (currentHand.handType === bestHand.handType &&
        currentHand.handRank > bestHand.handRank)) {
        winners = [];
        winners.push(player);

        bestHand = currentHand;
        cardArray = sevenCardHand;
      } else if (currentHand.handType === bestHand.handType &&
        currentHand.handRank === bestHand.handRank) {
        winners.push(player);
      }
    }

    return {
      winners: winners,
      hand: HandEvaluator.bestFiveCardHand(cardArray),
      handName: bestHand.handName,
      isSplitPot: winners.length > 1
    };
  }

  // Private: Determines the best possible 5-card hand from a 7-card hand. To
  // do this, we first need to get all the unique 5-card combinations, then
  // have our hand evaluator rank them.
  //
  // sevenCardHand - An array of seven {Card} objects
  //
  // Returns an array of five {Card} objects
  static bestFiveCardHand(sevenCardHand) {
    let fiveCardHands = Combinations.k_combinations(sevenCardHand, 5);
    let bestHand = { handType: 0, handRank: 0 };
    let cardArray = null;

    for (let fiveCardHand of fiveCardHands) {
      let evalInput = fiveCardHand.map(card => card.toAsciiString());
      let currentHand = pokerEvaluator.evalHand(evalInput);

      if (currentHand.handType > bestHand.handType ||
        (currentHand.handType === bestHand.handType && currentHand.handRank > bestHand.handRank)) {
        bestHand = currentHand;
        cardArray = fiveCardHand;
      }
    }

    return cardArray;
  }
}

module.exports = HandEvaluator;
