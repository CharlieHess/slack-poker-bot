const rx = require('rx');

const Deck = require('./deck');
const ImageHelpers = require('./image-helpers');
const PlayerInteraction = require('./player-interaction');

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
    for (let player of players) {
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
  // Returns an {Observable} sequence of all actions taken by players during
  // the hand
  playHand() {
    this.board = [];
    this.playerHands = {};

    this.deck.shuffle();
    this.dealPlayerCards();

    return this.flop().flatMap(() =>
      this.turn().flatMap(() =>
        this.river()));
  }

  // Private: Deals hole cards to each player in the game. To communicate this
  // to the players, we send them a DM with the text description of the cards.
  // We can't post in channel for obvious reasons.
  //
  // Returns nothing
  dealPlayerCards() {
    for (let player of this.players) {
      let card = this.deck.drawCard();
      this.playerHands[player.id] = [card];
    }

    for (let player of this.players) {
      let card = this.deck.drawCard();
      this.playerHands[player.id].push(card);

      let dm = this.playerDms[player.id];
      dm.send(`Your hand is: ${this.playerHands[player.id]}`);
    }
  }

  // Private: Handles the flop and its subsequent round of betting.
  //
  // Returns an {Observable} sequence of player actions taken during the flop
  flop() {
    let flop = [this.deck.drawCard(), this.deck.drawCard(), this.deck.drawCard()];
    this.board = flop;

    return this.postBoard('flop')
      .flatMap(() => this.doBettingRound());
  }

  // Private: Handles the turn and its subsequent round of betting.
  //
  // Returns an {Observable} sequence of player actions taken during the turn
  turn() {
    this.deck.drawCard(); // Burn one
    let turn = this.deck.drawCard();
    this.board.push(turn);

    return this.postBoard('turn')
      .flatMap(() => this.doBettingRound());
  }

  // Private: Handles the river and its subsequent round of betting.
  //
  // Returns an {Observable} sequence of player actions taken during the river
  river() {
    this.deck.drawCard(); // Burn one
    let river = this.deck.drawCard();
    this.board.push(river);

    return this.postBoard('river')
      .flatMap(() => this.doBettingRound());
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
      // just going to wait a bit before continuing.
      return rx.Observable.timer(500);
    }).take(1);
  }

  // Private: Handles the logic for a round of betting.
  //
  // Returns an {Observable} sequence of actions (e.g, 'check', 'fold') taken
  // by players during the round
  doBettingRound() {
    return rx.Observable.fromArray(this.players)
      .concatMap((player) => PlayerInteraction.getActionForPlayer(this.messages, this.channel, player));
  }
}

module.exports = TexasHoldem;
