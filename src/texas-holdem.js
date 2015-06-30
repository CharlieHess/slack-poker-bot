const rx = require('rx');
const pokerEvaluator = require('poker-evaluator');

const Deck = require('./deck');
const ImageHelpers = require('./image-helpers');
const PlayerInteraction = require('./player-interaction');
const PlayerOrder = require('./player-order');
const Combinations = require('../util/combinations');

class TexasHoldem {
  // Public: Creates a new game instance.
  //
  // slack - An instance of the Slack client
  // messages - An {Observable} representing messages posted to the channel
  // channel - The channel where the game will be played
  // players - The players participating in the game
  constructor(slack, messages, channel, players) {
    this.slack = slack;
    this.messages = messages;
    this.channel = channel;
    this.players = players;

    // Cache the direct message channels for each player as we'll be using
    // them often, and fetching them takes linear time per number of users.
    this.playerDms = {};
    for (let player of this.players) {
      this.playerDms[player.id] = this.slack.getDMByName(player.name);
    }

    this.deck = new Deck();
    this.quitGame = new rx.Subject();
    this.disp = new rx.CompositeDisposable();
  }

  // Public: Starts a new game.
  //
  // Returns nothing
  start() {
    // NB: Randomly assign the dealer button to start
    this.dealerButton = Math.floor(Math.random() * this.players.length);

    this.disp.add(rx.Observable.return(true)
      .flatMap(() => this.playHand())
      .repeat()
      .takeUntil(this.quitGame)
      .subscribe());
  }

  // Public: Ends the current game immediately and disposes all resources
  // associated with the game.
  //
  // Returns nothing
  quit() {
    this.quitGame.onNext();
    this.disp.dispose();
  }

  // Private: Plays a single hand of hold'em. The sequence goes like this:
  // 1. Clear the board and player hands
  // 2. Shuffle the deck and give players their cards
  // 3. TODO: Do a pre-flop betting round
  // 4. Deal the flop and do a betting round
  // 5. Deal the turn and do a betting round
  // 6. Deal the river and do a final betting round
  // 7. TODO: Decide a winner and send chips their way
  //
  // Returns an {Observable} containing the result of the hand
  playHand() {
    this.board = [];
    this.playerHands = {};

    this.assignBlinds();
    this.deck.shuffle();
    this.dealPlayerCards();

    let handFinished = () =>
      this.evaluateHands().do((result) => {
        this.channel.send(`${result.winner.name} wins with ${result.handName}, ${result.hand.toString()}`);

        this.dealerButton = (this.dealerButton + 1) % this.players.length;
      });

    return this.doBettingRound('preflop').flatMap(() =>
      this.flop().flatMap(() =>
        this.turn().flatMap(() =>
          this.river().flatMap(handFinished))));
  }

  assignBlinds() {
    this.smallBlind = (this.dealerButton + 1) % this.players.length;
    this.bigBlind = (this.smallBlind + 1) % this.players.length;
  }

  // Private: Deals hole cards to each player in the game. To communicate this
  // to the players, we send them a DM with the text description of the cards.
  // We can't post in channel for obvious reasons.
  //
  // Returns nothing
  dealPlayerCards() {
    this.orderedPlayers = PlayerOrder.determine(this.players, this.dealerButton, 'deal');

    for (let player of this.orderedPlayers) {
      let card = this.deck.drawCard();
      this.playerHands[player.id] = [card];
    }

    for (let player of this.orderedPlayers) {
      let card = this.deck.drawCard();
      this.playerHands[player.id].push(card);

      if (!player.isBot) {
        let dm = this.playerDms[player.id];
        dm.send(`Your hand is: ${this.playerHands[player.id]}`);
      } else {
        player.holeCards = this.playerHands[player.id];
      }
    }
  }

  // Private: Handles the flop and its subsequent round of betting.
  //
  // Returns an {Observable} sequence of player actions taken during the flop
  flop() {
    let flop = [this.deck.drawCard(), this.deck.drawCard(), this.deck.drawCard()];
    this.board = flop;

    return this.postBoard('flop')
      .flatMap(() => this.doBettingRound('flop'));
  }

  // Private: Handles the turn and its subsequent round of betting.
  //
  // Returns an {Observable} sequence of player actions taken during the turn
  turn() {
    this.deck.drawCard(); // Burn one
    let turn = this.deck.drawCard();
    this.board.push(turn);

    return this.postBoard('turn')
      .flatMap(() => this.doBettingRound('turn'));
  }

  // Private: Handles the river and its subsequent round of betting.
  //
  // Returns an {Observable} sequence of player actions taken during the river
  river() {
    this.deck.drawCard(); // Burn one
    let river = this.deck.drawCard();
    this.board.push(river);

    return this.postBoard('river')
      .flatMap(() => this.doBettingRound('river'));
  }

  // Private: For each player, create a 7-card hand by combining their hole
  // cards with the board, then pass that to our hand evaluator to get the type
  // of hand and its ranking among types. If it's better than the best hand
  // we've seen so far, assign a winner.
  //
  // Returns an {Observable} with a single value: an object containing the
  // winning player and information about their hand.
  evaluateHands() {
    let bestHand = { handType: 0, handRank: 0 };
    let winner = null;
    let cardArray = null;

    for (let player of this.players) {
      let sevenCardHand = [...this.playerHands[player.id], ...this.board];
      let evalInput = sevenCardHand.map(card => card.toString());
      let currentHand = pokerEvaluator.evalHand(evalInput);

      // TODO: Handle ties
      if (currentHand.handType > bestHand.handType ||
        (currentHand.handType === bestHand.handType && currentHand.handRank > bestHand.handRank)) {
        bestHand = currentHand;
        winner = player;
        cardArray = sevenCardHand;
      }
    }

    return rx.Observable.return({
      winner: winner,
      hand: this.bestFiveCardHand(cardArray),
      handName: bestHand.handName
    });
  }

  // Private: Determines the best possible 5-card hand from a 7-card hand. To
  // do this, we first need to get all the unique 5-card combinations, then
  // have our hand evaluator rank them.
  //
  // Returns an array of five {Card} objects
  bestFiveCardHand(sevenCardHand) {
    let fiveCardHands = Combinations.k_combinations(sevenCardHand, 5);
    let bestHand = { handType: 0, handRank: 0 };
    let cardArray = null;

    for (let fiveCardHand of fiveCardHands) {
      let evalInput = fiveCardHand.map(card => card.toString());
      let currentHand = pokerEvaluator.evalHand(evalInput);

      if (currentHand.handType > bestHand.handType ||
        (currentHand.handType === bestHand.handType && currentHand.handRank > bestHand.handRank)) {
        bestHand = currentHand;
        cardArray = fiveCardHand;
      }
    }

    return cardArray;
  }

  // Private: Creates an image of the cards on board and posts it to the
  // channel using `message.attachments`.
  //
  // round - The name of the round
  //
  // Returns an {Observable} indicating completion
  postBoard(round) {
    return ImageHelpers.createBoardImage(this.board).flatMap((url) => {
      let message = {
        as_user: true,
        token: this.slack.token,
      };

      message.attachments = [{
        title: `Dealing the ${round}:`,
        fallback: this.board.toString(),
        text: this.board.toString(),
        color: "good",
        image_url: url
      }];

      this.channel.postMessage(message);

      // NB: Since we don't have a callback for the message arriving, we're
      // just going to wait a second before continuing.
      return rx.Observable.timer(1000);
    }).take(1);
  }

  // Private: Handles the logic for a round of betting.
  //
  // round - The name of the betting round, e.g., 'preflop', 'flop', 'turn'
  //
  // Returns an {Observable} sequence of actions (e.g, 'check', 'fold') taken
  // by players during the round
  doBettingRound(round) {
    this.orderedPlayers = PlayerOrder.determine(this.players, this.dealerButton, round);
    let previousActions = [];

    // NB: Take the players remaining in the hand, in order, and map each to an
    // action for that round. We need to use `defer` to ensure the sequence
    // doesn't continue until the previous action is completed, and `reduce` to
    // turn the resulting sequence into a single array.
    return rx.Observable.fromArray(this.orderedPlayers)
      .concatMap((player) => rx.Observable.defer(() => {
        console.log(`Previous actions: ${JSON.stringify(previousActions)}`);
        return PlayerInteraction.getActionForPlayer(this.messages, this.channel, player, previousActions)
          .do((action) => previousActions.push(action));
      }))
      .reduce((acc, x) => {
        acc.push(x);
        return acc;
      }, [])
      .do((result) => console.log(`Got result: ${JSON.stringify(result)}`));
  }
}

module.exports = TexasHoldem;
