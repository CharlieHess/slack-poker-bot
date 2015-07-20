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
  }

  // Public: Starts a new game.
  //
  // Returns a {Disposable} that will end this game early
  start() {
    // NB: Randomly assign the dealer button to start
    this.dealerButton = Math.floor(Math.random() * this.players.length);

    return rx.Observable.return(true)
      .flatMap(() => this.playHand()
        .flatMap(() => rx.Observable.timer(5000)))
      .repeat()
      .takeUntil(this.quitGame)
      .subscribe();
  }

  // Public: Ends the current game immediately and disposes all resources
  // associated with the game.
  //
  // Returns nothing
  quit() {
    this.quitGame.onNext();
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

    this.doBettingRound('preflop').subscribe((result) =>
      result.isHandComplete ?
        this.endHand(handEnded, result) :
        this.flop(handEnded));

    return handEnded;
  }

  // Private: Handles the logic for a round of betting.
  //
  // round - The name of the betting round, e.g., 'preflop', 'flop', 'turn'
  //
  // Returns an {Observable} signaling the completion of the round
  doBettingRound(round) {
    this.orderedPlayers = PlayerOrder.determine(this.players, this.dealerButton, round);
    for (let player of this.orderedPlayers) {
      player.lastAction = null;
    }

    let previousActions = {};
    let roundEnded = new rx.Subject();

    // NB: Take the players remaining in the hand, in order, and poll each for
    // an action. This cycle will be repeated until the round is ended, which
    // can occur after any player action.
    let queryPlayers = rx.Observable.fromArray(this.orderedPlayers)
      .where((player) => player.isInHand)
      .concatMap((player) => this.deferredActionForPlayer(player, previousActions))
      .repeat()
      .reduce((acc, x) => {
        this.onPlayerAction(x.player, x.action, acc, roundEnded);
        acc.push(x);
        return acc;
      }, [])
      .takeUntil(roundEnded)
      .publish();

    queryPlayers.connect();
    return roundEnded;
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

  // Private: Occurs when a player action is received. Check the remaining
  // players and the previous actions, and possibly end the round of betting or
  // the hand entirely.
  //
  // player - The player who acted
  // action - The action the player took
  // previousActions - A map of players to their most recent action
  // roundEnded - A {Subject} used to end the betting round
  //
  // Returns nothing
  onPlayerAction(player, action, previousActions, roundEnded) {
    console.log(`${previousActions.length}: ${player.name} ${action}s`);

    if (action === 'fold') {
      player.isInHand = false;

      let playersRemaining = _.filter(this.players, (player) => player.isInHand);

      if (playersRemaining.length === 1) {
        let result = { isHandComplete: true, winner: playersRemaining[0] };
        roundEnded.onNext(result);
      }
    } else if (action === 'check') {
      let everyoneChecked = _.every(previousActions, (x) => x.action === 'check');
      let playersRemaining = _.filter(this.players, (player) => player.isInHand);
      let everyoneHadATurn = (previousActions.length + 1) % playersRemaining.length === 0;

      // TODO: Naive logic, we need to actually check that everyone has called
      // the bettor
      if (everyoneChecked && everyoneHadATurn) {
        let result = { isHandComplete: false };
        roundEnded.onNext(result);
      }
    }
  }

  // Private: Displays the flop cards and does a round of betting. If the
  // betting round results in a winner, end the hand prematurely. Otherwise,
  // progress to the turn.
  //
  // handEnded - A {Subject} that is used to end the hand
  //
  // Returns nothing
  flop(handEnded) {
    this.deck.drawCard(); // Burn one
    let flop = [this.deck.drawCard(), this.deck.drawCard(), this.deck.drawCard()];
    this.board = flop;

    this.postBoard('flop').subscribe(() =>
      this.doBettingRound('flop').subscribe((result) =>
        result.isHandComplete ?
          this.endHand(handEnded, result) :
          this.turn(handEnded)));
  }

  // Private: Displays the turn card and does an additional round of betting.
  //
  // handEnded - A {Subject} that is used to end the hand
  //
  // Returns nothing
  turn(handEnded) {
    this.deck.drawCard(); // Burn one
    let turn = this.deck.drawCard();
    this.board.push(turn);

    this.postBoard('turn').subscribe(() =>
      this.doBettingRound('turn').subscribe((result) =>
        result.isHandComplete ?
          this.endHand(handEnded, result) :
          this.river(handEnded)));
  }

  // Private: Displays the river card and does a final round of betting.
  //
  // handEnded - A {Subject} that is used to end the hand
  //
  // Returns nothing
  river(handEnded) {
    this.deck.drawCard(); // Burn one
    let river = this.deck.drawCard();
    this.board.push(river);

    this.postBoard('river').subscribe(() =>
      this.doBettingRound('river').subscribe((result) => {
        // Still no winner? Time for a showdown.
        if (!result.isHandComplete) {
          result = this.evaluateHands();
        }
        this.endHand(handEnded, result);
      }));
  }

  // Private: Does work after the hand, including declaring a winner, giving
  // them chips, and moving the dealer button.
  //
  // handEnded - A {Subject} that is used to end the hand
  // result - An object with keys for the winning player and (optionally) the
  //          hand, if a showdown was required
  //
  // Returns nothing
  endHand(handEnded, result) {
    let message = `${result.winner.name} wins`;
    if (result.hand) {
      message += ` with ${result.handName}, ${result.hand.toString()}.`;
    } else {
      message += ".";
    }

    this.channel.send(message);
    this.dealerButton = (this.dealerButton + 1) % this.players.length;

    handEnded.onNext(true);
    handEnded.onCompleted();
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
