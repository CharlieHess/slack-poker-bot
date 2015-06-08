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
    this.inGame = true;
  }

  start() {
    while (this.inGame) {
      this.playHand();
    }
  }

  quit() {
    this.inGame = false;
  }

  playHand() {
    this.board = [];
    this.playerHands = {};

    this.deck.shuffle();
    this.dealPlayerCards();

    this.flop().subscribe(() =>
      this.turn().subscribe(() =>
        this.river().subscribe()));

    // TODO: Only play one hand right now, until we sort the betting rounds.
    this.quit();
  }

  dealPlayerCards() {
    for (let player of this.players) {
      let card = this.deck.drawCard();
      this.playerHands[player.id] = [card];
    }

    for (let player of this.players) {
      let card = this.deck.drawCard();
      this.playerHands[player.id].push(card);

      // Send hole cards as a DM; we can't post in channel for obvious reasons.
      let dm = this.playerDms[player.id];
      dm.send(`Your hand is: ${this.playerHands[player.id]}`);
    }
  }

  flop() {
    let flop = [this.deck.drawCard(), this.deck.drawCard(), this.deck.drawCard()];
    this.board = flop;

    this.postBoard('flop');
    return this.doBettingRound();
  }

  turn() {
    this.deck.drawCard(); // Burn one
    let turn = this.deck.drawCard();
    this.board.push(turn);

    this.postBoard('turn');
    return this.doBettingRound();
  }

  river() {
    this.deck.drawCard(); // Burn one
    let river = this.deck.drawCard();
    this.board.push(river);

    this.postBoard('river');
    return this.doBettingRound();
  }

  postBoard(round) {
    let ret = ImageHelpers.createBoardImage(this.board).map((url) => {
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
    }).publish();
    ret.connect();
    return ret;
  }

  doBettingRound() {
    return rx.Observable.fromArray(this.players)
      .concatMap((player) => PlayerInteraction.getActionForPlayer(this.messages, this.channel, player));
  }
}

module.exports = TexasHoldem;
