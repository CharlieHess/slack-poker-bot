const rx = require('rx');
const _ = require('underscore-plus');

class PlayerInteraction {
  // Public: Poll players that want to join the game during a specified period
  // of time.
  //
  // messages - An {Observable} representing new messages sent to the channel
  // channel - The {Channel} object, used for posting messages
  // scheduler - (Optional) The scheduler to use for timing events
  // timeout - (Optional) The amount of time to conduct polling, in seconds
  // maxPlayers - (Optional) The maximum number of players to allow
  //
  // Returns an {Observable} that will `onNext` for each player that joins and
  // `onCompleted` when time expires or the max number of players join.
  static pollPotentialPlayers(messages, channel, scheduler=rx.Scheduler.timeout, timeout=5, maxPlayers=6) {
    let intro = `Who wants to play?`;
    let formatMessage = (t) => `Respond with 'yes' in this channel in the next ${t} seconds.`;
    let {timeExpired} = PlayerInteraction.postMessageWithTimeout(channel, intro,
      formatMessage, scheduler, timeout);

    // Look for messages containing the word 'yes' and map them to a unique
    // user ID, constrained to `maxPlayers` number of players.
    let newPlayers = messages.where((e) => e.text && e.text.toLowerCase().match(/\byes\b/))
      .map((e) => e.user)
      .distinct()
      .take(maxPlayers)
      .publish();

    newPlayers.connect();
    timeExpired.connect();

    // Once our timer has expired, we're done accepting new players.
    return newPlayers.takeUntil(timeExpired);
  }

  // Public: Poll a specific player to take a poker action, within a timeout.
  //
  // messages - An {Observable} representing new messages sent to the channel
  // channel - The {Channel} object, used for posting messages
  // player - The player being polled
  // previousActions - A map of players to their most recent action
  // defaultBet - The default bet to use
  // scheduler - (Optional) The scheduler to use for timing events
  // timeout - (Optional) The amount of time to conduct polling, in seconds
  //
  // Returns an {Observable} indicating the action the player took. If time
  // expires, a 'timeout' action is returned.
  static getActionForPlayer(messages, channel, player, previousActions, defaultBet,
    scheduler=rx.Scheduler.timeout, timeout=30) {
    let intro = `${player.name}, it's your turn to act.`;
    let availableActions = PlayerInteraction.getAvailableActions(player, previousActions);
    let formatMessage = (t) => PlayerInteraction.buildActionMessage(availableActions, t);
    let {timeExpired} = PlayerInteraction.postMessageWithTimeout(channel, intro,
      formatMessage, scheduler, timeout);

    // Look for text that conforms to a player action.
    let playerAction = messages.where((e) => e.user === player.id)
      .map((e) => PlayerInteraction.actionFromMessage(e.text,
        availableActions, defaultBet, player.chips))
      .where((action) => action !== null)
      .publish();

    playerAction.connect();
    let disp = timeExpired.connect();

    // If the user times out, they will be auto-folded unless they can check.
    let actionForTimeout = timeExpired.map(() =>
      availableActions.indexOf('check') > -1 ?
        { name: 'check' } :
        { name: 'fold' });

    let botAction = player.isBot ?
      player.getAction(availableActions, previousActions) :
      rx.Observable.never();

    // NB: Take the first result from the player action, the timeout, and a bot
    // action (only applicable to bots).
    return rx.Observable.merge(playerAction, actionForTimeout, botAction)
      .take(1)
      .do((action) => {
        disp.dispose();
        PlayerInteraction.afterPlayerAction(channel, player, action);
      });
  }

  static afterPlayerAction(channel, player, action) {
    let message = `${player.name} ${action.name}s`;
    if (action.name === 'bet')
      message += ` $${action.amount}.`;
    else if (action.name === 'raise')
      message += ` to $${action.amount}.`;
    else
      message += '.';

    channel.send(message);
  }

  // Private: Posts a message to the channel with some timeout, that edits
  // itself each second to provide a countdown.
  //
  // channel - The channel to post in
  // intro - An optional introductory message to lead off with
  // formatMessage - A function that will be invoked once per second with the
  //                 remaining time, and returns the formatted message content
  // scheduler - The scheduler to use for timing events
  // timeout - The duration of the message, in seconds
  //
  // Returns an object with two keys: `timeExpired`, an {Observable} sequence
  // that fires when the message expires, and `message`, the message posted to
  // the channel.
  static postMessageWithTimeout(channel, intro, formatMessage, scheduler, timeout) {
    channel.send(intro);
    let timeoutMessage = channel.send(formatMessage(timeout));

    let timeExpired = rx.Observable.timer(0, 1000, scheduler)
      .take(timeout + 1)
      .do((x) => timeoutMessage.updateMessage(formatMessage(`${timeout - x}`)))
      .publishLast();

    return {timeExpired: timeExpired, message: timeoutMessage};
  }

  // Private: Builds up a formatted countdown message containing the available
  // actions.
  //
  // availableActions - An array of the actions available to this player
  // timeRemaining - Number of seconds remaining for the player to act
  //
  // Returns the formatted string
  static buildActionMessage(availableActions, timeRemaining) {
    let message = 'Respond with\n';
    for (let action of availableActions) {
      message += `*(${action.charAt(0).toUpperCase()})${action.slice(1)}*\n`;
    }
    message += `in the next ${timeRemaining} seconds.`;
    return message;
  }

  // Private: Given an array of actions taken previously in the hand, returns
  // an array of available actions.
  //
  // player - The player who is acting
  // previousActions - A map of players to their most recent action
  //
  // Returns an array of strings
  static getAvailableActions(player, previousActions) {
    let actions = _.values(previousActions);
    let playerBet = actions.some(a => a.name === 'bet');
    let playerRaised = actions.some(a => a.name === 'raise');

    let availableActions = [];

    if (player.hasOption) {
      availableActions.push('check');
      availableActions.push('raise');
    } else if (playerBet || playerRaised) {
      availableActions.push('call');
      availableActions.push('raise');
    } else {
      availableActions.push('check');
      availableActions.push('bet');
    }

    availableActions.push('fold');
    return availableActions;
  }

  // Private: Parse player input into a valid action.
  //
  // text - The text that the player entered
  // availableActions - An array of the actions available to this player
  // defaultBet - The default bet amount, used if a number cannot be parsed
  //              from the input text
  // playerChips - The amount of chips the player has remaining
  //
  // Returns an object representing the action, with keys for the name and
  // bet amount, or null if the input was invalid.
  static actionFromMessage(text, availableActions, defaultBet, playerChips) {
    if (!text) return null;

    let input = text.trim().toLowerCase().split(/\s+/);
    if (!input[0]) return null;

    let name = '';
    let amount = 0;

    switch (input[0]) {
    case 'c':
      name = availableActions[0];
      break;
    case 'call':
      name = 'call';
      break;
    case 'check':
      name = 'check';
      break;
    case 'f':
    case 'fold':
      name = 'fold';
      break;
    case 'b':
    case 'bet':
      name = 'bet';
      amount = PlayerInteraction.betFromMessage(input[1], defaultBet, playerChips);
      break;
    case 'r':
    case 'raise':
      name = 'raise';
      amount = PlayerInteraction.betFromMessage(input[1], defaultBet, playerChips);
      break;
    default:
      return null;
    }

    // NB: Unavailable actions are always invalid.
    return availableActions.indexOf(name) > -1 ?
      { name: name, amount: amount } :
      null;
  }

  // Private: Parse the bet amount from a string.
  //
  // text - The player input
  // defaultBet - The default bet to use if the parse fails
  // playerChips - The amount of chips the player has remaining
  //
  // Returns a number representing the bet amount
  static betFromMessage(text, defaultBet, playerChips) {
    if (!text) return defaultBet;

    let bet = parseInt(text);
    bet = isNaN(bet) ? defaultBet : bet;
    bet = (playerChips && playerChips < bet) ? playerChips : bet;

    return bet;
  }
}

module.exports = PlayerInteraction;
