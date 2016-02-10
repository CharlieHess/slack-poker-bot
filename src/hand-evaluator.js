const pokerEvaluator = require('poker-evaluator');
const Card = require('./card.js');
const Combinations = require('../util/combinations');

let singleton = Symbol();
let singletonEnforcer = Symbol();

class HandEvaluator {

  constructor(enforcer) {
    if (enforcer != singletonEnforcer) {
      throw "Cannot construct singleton";
    }
    this.initializeThreeCardLookup();
  }

  initializeThreeCardLookup() {
    //
    // poker-evaluator's 3-card hand lookup is broken, so implement our own
    //
    let lookup = this.lookup = {};
    let _23 = ['2c', '3d'], _24 = ['2c', '4d'], _34 = ['3c', '4d'], _45 = ['4c', '5d'];
    let specialRanks = {
      '432': 0,
      '431': -1,
      '430': -2,
      '421': -3,
      '420': -4,
      '410': -5,
      '321': -6,
      '320': -7,
      '310': -8,
      '210': -9
    };
    let ranks = Card.Ranks;
    let suits = Object.keys(Card.AsciiMapping);
    let cardSet = [];
    for (let i = 0; i < ranks.length; i++) {
      let rank = ranks[i];
      cardSet.push(suits.map(suit => rank + suit))
    }

    let lookupSet = (a,b) => {
      if (a == 0) {
        if (b == 1) {
          return _45;
        } else {
          return _34;
        }
      } else if (a == 1) {
        if (b == 0) {
          return _45;
        } else {
          return _24;
        }
      } else if (b == 0) {
        return _34;
      } else if (b == 1) {
        return _24;
      }
      return _23;
    }

    for (let i = 0; i < ranks.length; i++) {
      let ii = i << 8;
      for (let j = 0; j < ranks.length; j++) {
        let jj = j << 4;
        for (let k = 0; k < ranks.length; k++) {
          let key = ii + jj + k, hand;
          if (i == j) {
            if (j == k) { // three of a kind
              hand = cardSet[i].slice(0,3).concat(i == 0 ? _34 : i == 1 ? _24 : _23);
              lookup[key] = pokerEvaluator.evalHand(hand);
              lookup[key].royalties = 10 + i;
            } else { // pair
              hand = [...cardSet[i].slice(0,2), cardSet[k][0], ...lookupSet(i,k)];
              lookup[key] = pokerEvaluator.evalHand(hand);
              if (i > 3) {
                lookup[key].royalties = i - 3;
              }
            }
          } else if (i == k) { // pair
            hand = [...cardSet[i].slice(0,2), cardSet[j][0], ...lookupSet(i,j)];
            lookup[key] = pokerEvaluator.evalHand(hand);
            if (i > 3) {
              lookup[key].royalties = i - 3;
            }
          } else if (j == k) { // pair
            hand = [...cardSet[j].slice(0,2), cardSet[i][0], ...lookupSet(i,j)];
            lookup[key] = pokerEvaluator.evalHand(hand);
            if (j > 3) {
              lookup[key].royalties = j - 3
            }
          } else { // high card
            if (i >= 5) {
              hand = [cardSet[i][0],cardSet[j][0],cardSet[k][0], ...lookupSet(j,k)];
              lookup[key] = pokerEvaluator.evalHand(hand);
            } else if (j >= 5) {
              hand = [cardSet[i][0],cardSet[j][0],cardSet[k][0], ...lookupSet(i,k)];
              lookup[key] = pokerEvaluator.evalHand(hand);
            } else if (k >= 5) {
              hand = [cardSet[i][0],cardSet[j][0],cardSet[k][0], ...lookupSet(i,j)];
              lookup[key] = pokerEvaluator.evalHand(hand);
            } else {
              var val = [i,j,k].sort((a,b) => b-a).join('')
              lookup[key] = {
                handType: 1,
                handRank: specialRanks[val],
                value: parseInt(val),
                handName: pokerEvaluator.HANDTYPES[1],
                royalties: 0
              }
            }
          }
          if (lookup[key].royalties === undefined) {
            lookup[key].royalties = 0;
          }
        }
      }
    }
  }

  // singleton instance for the 3 card initialization
  static get instance() {
    if (!this[singleton]) {
      this[singleton] = new HandEvaluator(singletonEnforcer);
    }
    return this[singleton];
  }

  static get royalties() {
    return [
      [0,0,0,0,0,2,4,6,10,15,25],
      [0,0,0,0,2,4,8,12,20,30,50]
    ];
  }

  static getRoyalties(row) {
    return HandEvaluator.royalties[row];
  }

  static evalHand(hand, row=0) {
    if (hand.length == 3) {
      // doesn't check duplicates
      let key = hand.reduce((sum,card,i) => {
        return sum + (((pokerEvaluator.CARDS[card.toLowerCase()] - 1) / 4) << (i * 4))
      }, 0);
      return HandEvaluator.instance.lookup[key];
    }
    let ret = pokerEvaluator.evalHand(hand), bonus;
    let royalties = HandEvaluator.getRoyalties(row);
    if (ret.handType == 9 && ret.handRank == 10) {
      bonus = royalties[10]; // royal flush
    } else {
      bonus = royalties[ret.handType];
    }
    if (bonus > 0) {
      ret.royalties = bonus;
    }
    return ret;
  }

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
