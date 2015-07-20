const rx = require('rx');
const _ = require('underscore-plus');
const textTable = require('text-table');
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
    this.handEnded = new rx.Subject();
    this.disp = new rx.CompositeDisposable();
  }

  // Public: Starts a new game.
  //
  // Returns nothing
  start() {
    // NB: Randomly assign the dealer button to start
    this.dealerButton = 0;//Math.floor(Math.random() * this.players.length);

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
  // 3. Do a pre-flop betting round
  // 4. Deal the flop and do a betting round
  // 5. Deal the turn and do a betting round
  // 6. Deal the river and do a final betting round
  // 7. TODO: Decide a winner and send chips their way
  //
  // Returns an {Observable} signaling the completion of the hand
  playHand() {
    this.board = [];
    this.playerHands = {};

    this.setupPlayers();
    this.deck.shuffle();
    this.dealPlayerCards();

    let handEnded = new rx.Subject();

    let handFinished = (result) => {
      let message = `${result.winner.name} wins`;
      if (result.hand) {
        message += ` with ${result.handName}, ${result.hand.toString()}`;
      }
      this.channel.send(message);
      this.dealerButton = (this.dealerButton + 1) % this.players.length;
      handEnded.onNext(true);
      handEnded.onCompleted();
    };

    let flop = () => {
      let flop = [this.deck.drawCard(), this.deck.drawCard(), this.deck.drawCard()];
      this.board = flop;

      this.postBoard('flop').subscribe(() =>
        this.doBettingRound('flop').subscribe((result) => {
          if (!result.handEnded) {
            result = this.evaluateHands();
          }
          handFinished(result);
        }));
    };

    this.doBettingRound('preflop').subscribe((result) =>
        !result.handEnded ? flop() : handFinished(result));

    return handEnded;
  }

  // Private: Handles the logic for a round of betting.
  //
  // round - The name of the betting round, e.g., 'preflop', 'flop', 'turn'
  //
  // Returns an array of actions taken during the round
  doBettingRound(round) {
    this.roundEnded = new rx.Subject();
    this.orderedPlayers = PlayerOrder.determine(this.players, this.dealerButton, round);
    let previousActions = {};

    // NB: Take the players remaining in the hand, in order, and map each to an
    // action for that round. We use `reduce` to turn the resulting sequence
    // into a single array.
    let queryPlayers = rx.Observable.fromArray(this.orderedPlayers)
      .where((player) => player.isInHand)
      .concatMap((player) => this.deferredActionForPlayer(player, previousActions))
      .repeat()
      .reduce((acc, x) => {
        this.onPlayerAction(x.player, x.action, acc);
        acc.push(x);
        return acc;
      }, [])
      .takeUntil(this.roundEnded)
      .publish();

    queryPlayers.connect();
    return this.roundEnded;
  }

  onPlayerAction(player, action, previousActions) {
    console.log(`${previousActions.length}: ${player.name} ${action}s`);

    if (action === 'fold') {
      player.isInHand = false;

      let playersRemaining = _.filter(this.players, (player) => player.isInHand);

      if (playersRemaining.length === 1) {
        let result = { handEnded: true, winner: playersRemaining[0] };
        console.log(`Hand ended, ${result.winner.name} wins`);

        this.roundEnded.onNext(result);
      }
    } else if (action === 'check') {
      let everyoneChecked = _.every(previousActions, (x) => x.action === 'check');
      let playersRemaining = _.filter(this.players, (player) => player.isInHand);
      let everyoneHadATurn = (previousActions.length + 1) % playersRemaining.length === 0;

      if (everyoneChecked && everyoneHadATurn) {
        let result = { handEnded: false };
        this.roundEnded.onNext(result);
      }
    }
  }

  // Private: Displays player position and who's next to act, pauses briefly,
  // then polls the acting player for an action. We use `defer` to ensure the
  // sequence doesn't continue until the player has responded.
  //
  // player - The player being polled
  // previousActions - A map of players to their most recent action
  // timeToPause - (Optional) The time to wait before polling, in ms
  //
  // Returns an {Observable} containing the player's action
  deferredActionForPlayer(player, previousActions, timeToPause=1000) {
    return rx.Observable.defer(() => {

      // Display player position and who's next to act before polling.
      this.displayHandStatus(this.players, player);

      return rx.Observable.timer(timeToPause).flatMap(() =>
        PlayerInteraction.getActionForPlayer(this.messages, this.channel, player, previousActions)
          .map((action) => {
            player.lastAction = action;
            previousActions[player] = action;
            return {player: player, action: action};
          }));
    });
  }

  // Private: Adds players to the hand if they have enough chips and posts
  // blinds.
  //
  // Returns nothing
  setupPlayers() {
    for (let player of this.players) {
      player.isInHand = true;
    }

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
  // Returns an object containing the winning player and information about
  // their hand.
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

    return {
      winner: winner,
      hand: this.bestFiveCardHand(cardArray),
      handName: bestHand.handName
    };
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

  // Private: Displays a fixed-width text table showing all of the players in
  // the hand, relevant position information (blinds, dealer button),
  // information about the player's bet, and an indicator of who's next to act.
  //
  // players - The players in the hand
  // actingPlayer - The player taking action
  //
  // Returns nothing
  displayHandStatus(players, actingPlayer) {
    let table = [];

    for (let idx = 0; idx < players.length; idx++) {
      let row = [];

      let player = players[idx];
      let turnIndicator = player === actingPlayer ? '→ ' : '  ';
      row.push(`${turnIndicator}${player.name}`);

      let handIndicator = player.isInHand ? '🂠' : ' ';
      row.push(handIndicator);

      let dealerIndicator = idx === this.dealerButton ? 'Ⓓ' : ' ';
      row.push(dealerIndicator);

      let bigBlind = idx === this.bigBlind ? 'Ⓑ' : null;
      let smallBlind = idx === this.smallBlind ? 'Ⓢ' : null;
      let blindIndicator = bigBlind || smallBlind || ' ';
      row.push(blindIndicator);

      row.push(player.lastAction || '');

      table.push(row);
    }

    let fixedWidthTable = `\`\`\`${textTable(table)}\`\`\``;
    this.channel.send(fixedWidthTable);
  }
}

module.exports = TexasHoldem;
