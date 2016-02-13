const rx = require('rx');
const _ = require('lodash');
const Deck = require('./deck');
const SlackApiRx = require('./slack-api-rx');
const PlayerInteraction = require('./player-interaction');
const M = require('./message-helpers');
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

  resetDeck() {
    return new Deck().shuffle();
  }

  playRound() {
    this.deck = this.resetDeck();
    this.round = 0;
    
    for (let player of this.players) {
      player.inPlay = true;
      player.playField = [[],[],[]];
    }

    let roundEnded = new rx.Subject();
    let queryPlayers = rx.Observable.fromArray(this.players)
      .where(player => player.inPlay)
      .concatMap(player => this.deferredActionForPlayer(player, roundEnded))
      //.concatMap(player => this.autoFlop(player, roundEnded))
      .repeat()
      .takeUntil(roundEnded)
      .publish()

    queryPlayers.connect();
    roundEnded.subscribe(() => this.endRound);

    return roundEnded;
  }

  endRound() {
    let players = this.players;
    let results = players.map(player => {
      let score = player.playField.map((row,i) => {
        let asciiRow = row.map(card => card.toAsciiString());
        return HandEvaluator.evalHand(asciiRow,i);
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

    players.forEach((player,i) => {
      this.channel.send(`\`${player.name}: ${M.money(oldScores[i])} ${M.money(player.score-oldScores[i],' ','+')}\``);
    });
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
    let atPlayer = M.formatAtUser(player);
    this.channel.send(`${atPlayer}: You draw *[${hand.join('][')}]*`)

    let timeout = 30
    let timeoutMessage = this.channel.send(`*Set hand* _(e.g. \`35h,a5c,t\`)_${M.timer(timeout)}`);
    let timeExpired = rx.Observable.timer(0,1000,this.scheduler)
      .take(timeout+1)
      .do((x) => timeoutMessage.updateMessage(`*Set hand* _(e.g. \`35h,a5c,t\`)_${M.timer(timeout - x)}`))
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
      .map(e => e.text ? e.text.toLowerCase().split(/\W/) : null)
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
            if (playField[i].length >= (i < 2 ? 5 : 3)) {
              this.channel.send(`${atPlayer}, too many cards played on ${ROWNAMES[i]}`);
              return
            }
            if (match[0].length == 1) {
              for (let j = i+1; j < 3; j++) {
                if (rows[j].match(match[0])) {
                  this.channel.send(`${atPlayer}, ambiguous card ${Card.asciiToString(match[0])}`);
                  return
                }
              }
            }
            
            let cardIndex = _.findIndex(trackHand, card => card.compareString(match[0]));
            if (cardIndex < 0) {
              this.channel.send(`${atPlayer}, you do not have ${Card.asciiToString(match[0])}`);
              return
            }
            
            playField[i].push(trackHand.splice(cardIndex,1)[0])
            row = row.substring(match.index + match[0].length);
          }
        }
        if (trackHand.length > 0) {
          this.channel.send(`${atPlayer}, you need to play 5 cards, not ${5 - trackHand.length}`);
          return
        }
        player.playField = playField;
        return playField;
      }).where(playField => !!playField)

    return rx.Observable.merge(playerAction, actionForTimeout)
    .take(1)
      .do(() => this.showPlayField([player]))
      .do(() => expiredDisp.dispose())
      .do(() => this.round++)


  }

  playOneCard(player, roundEnded) {
    let card = this.deck.drawCard();
    let atPlayer = M.formatAtUser(player);
    let players = this.players;
    let playerIndex = players.indexOf(player);
    let playerOrder = players.slice(playerIndex)
      .concat(players.slice(0,playerIndex)).slice(0,-1).reverse();
    this.showPlayField(playerOrder);
    this.channel.send(`${atPlayer}: You draw *[${card}]*`)

    let timeout = 15
    let validRows = player.playField
      .map((row,i) => row.length < (i < 2 ? 5 : 3) ? i : null)
      .filter((row) => row !== null);

    let availableCommands = ['*(B)ottom*','*(M)iddle*', '*(T)op*'];
    let cmd = validRows.map(rowIndex => availableCommands[rowIndex]).join("\t");

    let timeoutMessage = this.channel.send(`Respond with\t${cmd}\t${M.timer(timeout)}`);
    let timeExpired = rx.Observable.timer(0,1000,this.scheduler)
      .take(timeout+1)
      .do((x) => timeoutMessage.updateMessage(`Respond with\t${cmd}\t${M.timer(timeout - x)}`))
      .publishLast()
    let expiredDisp = timeExpired.connect();

    

    let actionForTimeout = timeExpired.map(() => _.random(validRows.length - 1));
    let textFilter = this.messages
      .where(e => e.user === player.id)
      .map(e => e.text ? e.text.trim().toLowerCase() : null)

    let bottomAction = textFilter
      .where(text => text && text.match(/^b((ot(tom)?|ack)?)?$/))
      .map(() => validRows.indexOf(0))
      .where(index => {
        if (index < 0) {
          this.channel.send(`${atPlayer}, your bottom row is full`);
          return false;
        }
        return true;
      })

    let middleAction = textFilter
      .where(text => text && text.match(/^m(id(dle)?)?$/))
      .map(() => validRows.indexOf(1))
      .where(index => {
        if (index < 0) {
          this.channel.send(`${atPlayer}, your middle row is full`);
          return false;
        }
        return true;
      })
    let topAction = textFilter
      .where(text => text && text.match(/^t(op)?|f(ront)?$/))
      .map(() => validRows.indexOf(2))
      .where(index => {
        if (index < 0) {
          this.channel.send(`${atPlayer}, your top row is full`);
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
      .do(() => this.showPlayField([player]))
      .do(() => expiredDisp.dispose())
      .do(() => this.round++)

  }

  playFantasyLand(player) {
  }

  showPlayField(players) {
    let showPlay = players.map(player => {
      return `\`${player.name}\`\n` + player.playField.map((row,i) => {
        return '`[' + row.map(card => `\`${card}\``)
          .concat(_.fill(Array((i < 2 ? 5 : 3) - row.length), '     '))
          .join('][') + "]`\n";
      }).reverse().join("\n");
    });
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
