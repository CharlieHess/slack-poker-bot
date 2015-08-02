const rx = require('rx');
const _ = require('underscore-plus');

const Deck = require('./deck');
const ImageHelpers = require('./image-helpers');
const PlayerInteraction = require('./player-interaction');
const PlayerOrder = require('./player-order');
const PlayerStatus = require('./player-status');
const HandEvaluator = require('./hand-evaluator');

class TexasHoldem {
  // Public: Creates a new game instance.
  //
  // slack - An instance of the Slack client
  // messages - An {Observable} representing messages posted to the channel
  // channel - The channel where the game will be played
  // players - The players participating in the game
  // scheduler - (Optional) The scheduler to use for timing events
  constructor(slack, messages, channel, players, scheduler=rx.Scheduler.timeout) {
    this.slack = slack;
    this.messages = messages;
    this.channel = channel;
    this.players = players;
    this.scheduler = scheduler;

    this.deck = new Deck();
    this.smallBlind = 1;
    this.bigBlind = this.smallBlind * 2;
    this.quitGame = new rx.Subject();

    // Cache the direct message channels for each player as we'll be using
    // them often, and fetching them takes linear time per number of users.
    this.playerDms = {};
    for (let player of this.players) {
      this.playerDms[player.id] = this.slack.getDMByName(player.name);

      // Each player starts with 100 big blinds.
      player.chips = this.bigBlind * 100;
    }
  }

  // Public: Starts a new game.
  //
  // dealerButton - (Optional) The initial index of the dealer button, or null
  //                to have it randomly assigned
  // timeBetweenHands - (Optional) The time, in milliseconds, to pause between
  //                    the end of one hand and the start of another
  //
  // Returns a {Disposable} that will end this game early
  start(dealerButton=null, timeBetweenHands=5000) {
    this.dealerButton = dealerButton === null ?
      Math.floor(Math.random() * this.players.length) :
      dealerButton;

    return rx.Observable.return(true)
      .flatMap(() => this.playHand()
        .flatMap(() => rx.Observable.timer(timeBetweenHands, this.scheduler)))
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

  // Public: Get all players still in the current hand.
  //
  // Returns an array of players
  getPlayersInHand() {
    return _.filter(this.players, player => player.isInHand);
  }

  // Private: Plays a single hand of hold'em. The sequence goes like this:
  // 1. Clear the board and player hands
  // 2. Shuffle the deck and give players their cards
  // 3. Do a pre-flop betting round
  // 4. Deal the flop and do a betting round
  // 5. Deal the turn and do a betting round
  // 6. Deal the river and do a final betting round
  // 7. Decide a winner and send chips their way
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
    // NB: If every player is already all-in, end this round early.
    let playersRemaining = _.filter(this.players, p => p.isInHand);
    if (_.every(playersRemaining, p => p.isAllIn)) {
      let result = { isHandComplete: false };
      return rx.Observable.return(result);
    }

    this.orderedPlayers = PlayerOrder.determine(this.players, this.dealerButton, round);
    let previousActions = {};
    let roundEnded = new rx.Subject();

    this.resetPlayersForBetting(round, previousActions);

    // NB: Take the players remaining in the hand, in order, and poll each for
    // an action. This cycle will be repeated until the round is ended, which
    // can occur after any player action.
    let queryPlayers = rx.Observable.fromArray(this.orderedPlayers)
      .where((player) => player.isInHand && !player.isAllIn)
      .concatMap((player) => this.deferredActionForPlayer(player, previousActions))
      .repeat()
      .reduce((acc, x) => {
        this.onPlayerAction(x.player, x.action, previousActions, roundEnded);
        acc.push(x);
        return acc;
      }, [])
      .takeUntil(roundEnded)
      .publish();

    queryPlayers.connect();
    return roundEnded;
  }

  // Private: Resets all player state from the previous round. If this is the
  // preflop, do some additional initialization.
  //
  // round - The name of the betting round
  // previousActions - A map of players to their most recent action
  //
  // Returns nothing
  resetPlayersForBetting(round, previousActions) {
    for (let player of this.orderedPlayers) {
      player.lastAction = null;
      player.isBettor = false;
      player.hasOption = false;
    }

    this.currentBet = null;

    if (round === 'preflop') {
      this.postBlinds(previousActions);
    }
  }

  // Private: Posts blinds for a betting round.
  //
  // previousActions - A map of players to their most recent action
  //
  // Returns nothing
  postBlinds(previousActions) {
    let sbPlayer = this.players[this.smallBlindIdx];
    let bbPlayer = this.players[this.bigBlindIdx];

    // NB: So, in the preflop round we want to treat the big blind as the
    // bettor. Because the bet was implict, that player also has an "option,"
    // i.e., they will be the last to act.
    this.onPlayerBet(sbPlayer, this.smallBlind);
    this.onPlayerBet(bbPlayer, this.bigBlind);
    bbPlayer.hasOption = true;

    previousActions[sbPlayer.id] =
      sbPlayer.lastAction = { name: 'bet', amount: this.smallBlind };
    previousActions[bbPlayer.id] =
      bbPlayer.lastAction = { name: 'bet', amount: this.bigBlind };
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
      PlayerStatus.displayHandStatus(this.channel,
        this.players, player,
        this.currentPot, this.dealerButton,
        this.bigBlindIdx, this.smallBlindIdx,
        this.tableFormatter);

      return rx.Observable.timer(timeToPause, this.scheduler).flatMap(() => {
        this.actingPlayer = player;

        return PlayerInteraction.getActionForPlayer(this.messages, this.channel,
          player, previousActions, this.scheduler)
          .map(action => {
            this.validatePlayerAction(player, action);
            this.postActionToChannel(player, action);

            // NB: Save the action in various structures and return it with a
            // reference to the acting player.
            player.lastAction = action;
            previousActions[player.id] = action;
            return { player: player, action: action };
          });
        });
    });
  }

  validatePlayerAction(player, action) {
    if (action.name === 'bet' || action.name === 'raise') {
      // If another player has bet, the default raise is 2x. Otherwise the
      // minimum bet is 1 small blind.
      if (isNaN(action.amount)) {
        action.amount = this.currentBet ?
          this.currentBet * 2 :
          this.smallBlind;
      }

      if (action.amount >= player.chips) {
        action.amount = player.chips;
      }
    }
  }

  postActionToChannel(player, action) {
    let message = `${player.name} ${action.name}s`;
    if (action.name === 'bet')
      message += ` $${action.amount}.`;
    else if (action.name === 'raise')
      message += ` to $${action.amount}.`;
    else
      message += '.';

    this.channel.send(message);
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
    switch (action.name) {
    case 'fold':
      this.onPlayerFolded(player, roundEnded);
      break;
    case 'check':
      this.onPlayerChecked(player, previousActions, roundEnded);
      break;
    case 'call':
      this.onPlayerCalled(player, roundEnded);
      break;
    case 'bet':
    case 'raise':
      this.onPlayerBet(player, action.amount);
      break;
    }
  }

  // Private: If everyone folded out, declare a winner. Otherwise see if this
  // was the last player to act and move to the next round.
  //
  // player - The player who folded
  // roundEnded - A {Subject} used to end the betting round
  //
  // Returns nothing
  onPlayerFolded(player, roundEnded) {
    // See if this was the last player to act before we fold them out,
    // otherwise they won't be in the list of remaining players.
    let everyoneActed = PlayerOrder.isLastToAct(player, this.orderedPlayers);

    player.isInHand = false;
    let playersRemaining = _.filter(this.players, p => p.isInHand);

    if (playersRemaining.length === 1) {
      let result = {
        isHandComplete: true,
        winners: [playersRemaining[0]],
        isSplitPot: false
      };
      roundEnded.onNext(result);
    } else if (everyoneActed) {
      let result = { isHandComplete: false };
      roundEnded.onNext(result);
    }
  }

  // Private: If everyone checked, move to the next round.
  //
  // player - The player who checked
  // previousActions - A map of players to their most recent action
  // roundEnded - A {Subject} used to end the betting round
  //
  // Returns nothing
  onPlayerChecked(player, previousActions, roundEnded) {
    let everyoneChecked = this.everyPlayerTookAction(['check', 'call'], p => p.isInHand);
    let everyoneHadATurn = PlayerOrder.isLastToAct(player, this.orderedPlayers);

    if (everyoneChecked && everyoneHadATurn) {
      let result = { isHandComplete: false };
      roundEnded.onNext(result);
    }
  }

  // Private: If everyone left in the hand has called and we're back to the
  // original bettor, move to the next round.
  //
  // player - The player who called
  // roundEnded - A {Subject} used to end the betting round
  //
  // Returns nothing
  onPlayerCalled(player, roundEnded) {
    this.updatePlayerChips(player, this.currentBet);

    let everyoneCalled = this.everyPlayerTookAction(['call'], p => p.isInHand && !p.isBettor);
    let everyoneHadATurn = PlayerOrder.isLastToAct(player, this.orderedPlayers);

    if (everyoneCalled && everyoneHadATurn) {
      let result = { isHandComplete: false };
      roundEnded.onNext(result);
    }
  }

  // Private: When a player bets, assign them as the current bettor. The
  // betting round will cycle through all players up to the bettor.
  //
  // player - The player who bet or raised
  // amount - The amount that was bet
  //
  // Returns nothing
  onPlayerBet(player, amount) {
    let currentBettor = _.find(this.players, p => p.isBettor);
    if (currentBettor) {
      currentBettor.isBettor = false;
      currentBettor.hasOption = false;
    }

    player.isBettor = true;
    this.currentBet = amount;
    this.updatePlayerChips(player, amount);
  }

  // Private: Update a player's chip stack and the pot based on a wager.
  //
  // player - The calling / betting player
  // amount - The amount wagered
  //
  // Returns nothing
  updatePlayerChips(player, amount) {
    if (player.chips <= amount) {
      player.isAllIn = true;
      this.currentPot += player.chips;
      player.chips = 0;
    } else {
      player.chips -= amount;
      this.currentPot += amount;
    }
  }

  everyPlayerTookAction(actions, playerPredicate) {
    let playersRemaining = _.filter(this.players, playerPredicate);
    return _.every(playersRemaining, p => p.lastAction !== null &&
      actions.indexOf(p.lastAction.name) > -1);
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
          let playersRemaining = _.filter(this.players, p => p.isInHand);
          result = HandEvaluator.evaluateHands(
            playersRemaining,
            this.playerHands,
            this.board);
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
    let message = '';
    if (result.isSplitPot) {
      _.each(result.winners, winner => {
        if (_.last(result.winners) !== winner)
          message += `${winner.name}, `;
        else
          message += `and ${winner.name} split the pot`;
      });
      message += ` with ${result.handName}: ${result.hand.toString()}.`;
    } else {
      message = `${result.winners[0].name} wins $${this.currentPot}`;
      if (result.hand) {
        message += ` with ${result.handName}: ${result.hand.toString()}.`;
      } else {
        message += '.';
      }
      result.winners[0].chips += this.currentPot;
    }

    this.channel.send(message);
    this.dealerButton = (this.dealerButton + 1) % this.players.length;
    this.lastHandResult = result;

    handEnded.onNext(true);
    handEnded.onCompleted();
  }

  // Private: Adds players to the hand if they have enough chips and determines
  // small blind and big blind indices.
  //
  // Returns nothing
  setupPlayers() {
    for (let player of this.players) {
      player.isInHand = true;
      player.isBettor = false;
    }

    this.currentPot = 0;
    this.smallBlindIdx = (this.dealerButton + 1) % this.players.length;
    this.bigBlindIdx = (this.smallBlindIdx + 1) % this.players.length;
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
        color: 'good',
        image_url: url
      }];

      this.channel.postMessage(message);

      // NB: Since we don't have a callback for the message arriving, we're
      // just going to wait a second before continuing.
      return rx.Observable.timer(1000, this.scheduler);
    }).take(1);
  }
}

module.exports = TexasHoldem;
