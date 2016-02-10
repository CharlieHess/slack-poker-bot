const rx = require('rx');
const _ = require('lodash');
const Deck = require('./deck');
const SlackApiRx = require('./slack-api-rx');
const PlayerInteraction = require('./player-interaction');
const MessageHelpers = require('./message-helpers');
const Combinations = require('../util/combinations')
const HandEvaluator = require('./hand-evaluator');

const ROWNAMES = ['bot','mid','top'];

rx.config.longStackSupport = true;

class ChinesePoker {
  constructor(slack, messages, channel, players, scheduler=rx.Scheduler.timeout) {
    this.slack = slack;
    this.messages = messages;
    this.channel = channel;
    this.players = players;
    this.scheduler = scheduler;
    this.gameEnded = new rx.Subject();

    for (let player of this.players) {
      player.fantasyLand = false;
      player.score = 0;
    }
  }

  start(playerDms, timeBetweenHands=3000) {
    this.isRunning = true;
    this.playerDms = playerDms;

    rx.Observable.return(true)
      .flatMap(() => this.playRound()
        .flatMap(() => rx.Observable.timer(timeBetweenHands, this.scheduler)))
      .repeat()
      .takeUntil(this.gameEnded)
      .subscribe();
      
    return this.gameEnded;

  }

  quit() {
  }

  playRound() {
    this.deck = new Deck();
    this.deck.shuffle();
    this.round = 0;
    
    let players = this.players;
    for (let player of this.players) {
      player.inPlay = true
    }

    let roundEnded = new rx.Subject();
    let queryPlayers = rx.Observable.fromArray(players)
      .where(player => player.inPlay)
      //.concatMap(player => this.deferredActionForPlayer(player, roundEnded))
      .concatMap(player => this.autoFlop(player, roundEnded))
      .repeat()
      .takeUntil(roundEnded)
      .publish()

    queryPlayers.connect();
    roundEnded.subscribe(() => {
      let results = players.map(player => {
        let score = player.playField.map((row,i) => {
          let asciiRow = row.map(card => card.toAsciiString());
          return HandEvaluator.evalHand(asciiRow);
        });
        player.misset = score.reduce((acc, handScore) => {
          return acc <= handScore ? handScore : Number.POSITIVE_INFINITY
        }, 0) == Number.POSITIVE_INFINITY;
        return score;
      })

      let oldScores = players.map(player => player.score);
      Combinations.k_combinations(_.times(players.length, Number), 2).forEach(combo => {
        let [a,b] = combo;
        let resultA = results[a];
        let resultB = results[b];
        let playerA = players[a];
        let playerB = players[b];
        let royaltyDif = 0;
        let difference = resultA.reduce((score, resA, i) => {
          let resB = resultB[i];
          let valA = playerA.misset ? 0 : resA.value;
          let valB = playerB.misset ? 0 : resB.value;
          let royaltiesA = playerA.misset ? 0 : resA.royalties;
          let royaltiesB = playerB.misset ? 0 : resB.royalties;
          royaltyDif = royaltiesA - royaltiesB;
          return score + (valA > valB ? 1 : valA < valB ? -1 : 0);
        }, 0);
        difference = (difference == 3) ? 6 : (difference == -3) ? -6 : difference;
        playerA.score += difference + royaltyDif;
        playerB.score -= difference + royaltyDif;
      })

      let money = MessageHelpers.money;
      players.forEach((player,i) => {
        this.channel.send(`\`${player.name}: ${money(oldScores[i])} ${money(player.score-oldScores[i],' ','+')}\``);
      });
    })

    return roundEnded;
  }

  autoFlop(player, roundEnded) {
    player.playField = [
      _.times(5, () => this.deck.drawCard()),
      _.times(5, () => this.deck.drawCard()),
      _.times(3, () => this.deck.drawCard())
    ];
    player.inPlay = false;
    this.checkRoundEnded(roundEnded);
    this.showPlayField(player);
    return rx.Observable.return(true);
  }

  deferredActionForPlayer(player, roundEnded, timeToPause=1000) {
    return rx.Observable.defer(() => {

      return rx.Observable.timer(timeToPause, this.scheduler).flatMap(() => {

        if (player.fantasyLand) {
          return this.playFantasyLand(player);
        } else if (this.round < this.players.length) {
          return this.playFiveCards(player);
        }
        return this.playOneCard(player, roundEnded);
        
      });
    });
  }

  playFiveCards(player) {
    let hand = _.times(5, () => this.deck.drawCard());
    this.channel.send(`${MessageHelpers.formatAtUser(player)}: You draw ${hand.join('')}`)

    let timeout = 1
    let timeoutMessage = this.channel.send(`You have ${timeout} seconds to respond`);
    let timeExpired = rx.Observable.timer(0,1000,this.scheduler)
      .take(timeout+1)
      .do((x) => timeoutMessage.updateMessage(`You have ${timeout - x} seconds to respond`))
      .publishLast()
    let expiredDisp = timeExpired.connect();


    let actionForTimeout = timeExpired.map(() => {
      let r1 = _.random(5)
      let r2 = _.random(Math.max(r1,2), 5)
      let playField = [hand.slice(0,r1), hand.slice(r1,r2), hand.slice(r2)];
      player.playField = playField;
      return playField;
    });
    let playerAction = this.messages
      .where(e => e.user === player.id)
      .map(e => e.text ? e.text.toLowerCase().split(/[^,\s\w]/) : null)
      .where(rows => rows && rows.length >= 2)
      .map(rows => {
          let playField = [[],[],[]];
          let trackHand = hand.slice(0);
        if (rows.length == 2) {
          rows.push('');
        }
        for (let i = 0; i < 3; i++) {
          let row = rows[i];
          let match
          while ((match = row.match(/[1-9tjqka][shdc]?/))) {
            if (row.length >= (i < 2 ? 5 : 3)) {
              this.channel.send(`${MessageHelpers.formatAtUser(player)}, too many cards played on ${ROWNAMES[i]}`);
              return
            }
            if (match[0].length == 1) {
              for (let j = i+1; j < 3; j++) {
                if (rows[j].match(match[0])) {
                  this.channel.send(`${MessageHelpers.formatAtUser(player)}, ambiguous card ${Card.asciiToString(match[0])}`);
                  return
                }
              }
            }
            
            let cardIndex = _.findIndex(trackHand);
            if (cardIndex < 0) {
              this.channel.send(`${MessageHelpers.formatAtUser(player)}, you do not have ${Card.asciiToString(match[0])}`);
              return
            }
            
            playField[i].push(trackHand.splice(cardIndex,1)[0])
            row = row.substring(match.index + match[0].length);
          }
        }
        if (trackHand.length > 0) {
          this.channel.send(`${MessageHelpers.formatAtUser(player)}, you need to play 5 cards, not ${5 - trackHand.length}`);
          return
        }
        player.playField = playField;
        return playField;
      }).where(playField => !!playField)

    return rx.Observable.merge(playerAction, actionForTimeout)
      .take(1)
      .do(() => this.showPlayField(player))
      .do(() => expiredDisp.dispose())
      .do(() => this.round++)


  }

  playOneCard(player, roundEnded) {
    let card = this.deck.drawCard();
    this.channel.send(`${MessageHelpers.formatAtUser(player)}: You draw ${card}`)

    let timeout = 1
    let timeoutMessage = this.channel.send(`You have ${timeout} seconds to respond`);
    let timeExpired = rx.Observable.timer(0,1000,this.scheduler)
      .take(timeout+1)
      .do((x) => timeoutMessage.updateMessage(`You have ${timeout - x} seconds to respond`))
      .publishLast()
    let expiredDisp = timeExpired.connect();

    let validRows = player.playField
      .map((row,i) => row.length < (i < 2 ? 5 : 3) ? i : null)
      .filter((row) => row !== null)

    let actionForTimeout = timeExpired.map(() => _.random(validRows.length - 1));
    let textFilter = this.messages
      .where(e => e.user === player.id)
      .map(e => e.text ? e.text.toLowerCase() : null)

    let bottomAction = textFilter
      .where(text => text && text.match(/\bb((ot(tom)|ack)?)?\b/))
      .map(() => validRows.indexOf(0))
      .where(index => {
        if (index < 0) {
          this.channel.send(`${MessageHelpers.formatAtUser(player)}, your bottom row is full`);
          return false;
        }
        return true;
      })

    let middleAction = textFilter
      .where(text => text && text.match(/\bm(id(dle)?)?\b/))
      .map(() => validRows.indexOf(1))
      .where(index => {
        if (index < 0) {
          this.channel.send(`${MessageHelpers.formatAtUser(player)}, your middle row is full`);
          return false;
        }
        return true;
      })
    let topAction = textFilter
      .where(text => text && text.match(/\bt(op)?|f(ront)?\b/))
      .map(() => validRows.indexOf(2))
      .where(index => {
        if (index < 0) {
          this.channel.send(`${MessageHelpers.formatAtUser(player)}, your top row is full`);
          return false;
        }
        return true;
      })

    let playerAction = rx.Observable.merge(bottomAction, middleAction, topAction)
      .take(1)

      return rx.Observable.merge(playerAction, actionForTimeout)
      .take(1)
      .map(index => {
        let playField = player.playField
        playField[validRows[index]].push(card);
        player.inPlay = playField.reduce((acc,row) => acc + row.length,0) < 13;
        this.checkRoundEnded(roundEnded);
        return playField;
      })
      .do(() => this.showPlayField(player))
      .do(() => expiredDisp.dispose())
      .do(() => this.round++)

  }

  playFantasyLand(player) {
  }

  showPlayField(player) {
    let showPlay = player.playField.map((row,i) => {
      return `${MessageHelpers.formatAtUser(player)} ${ROWNAMES[i]}: ${row}`
    }).reverse()
    this.channel.send(`${showPlay.join("\n")}`);
  }

  checkRoundEnded(roundEnded) {
    if (this.players.reduce((acc,player) => acc && !player.inPlay,true)) {
      roundEnded.onNext(true);
      roundEnded.onCompleted();
    }
  }
}

module.exports = ChinesePoker;
