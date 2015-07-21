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
  // scheduler - (Optional) The scheduler to use for timing events
  // timeout - (Optional) The amount of time to conduct polling, in seconds
  //
  // Returns an {Observable} indicating the action the player took. If time
  // expires, a 'timeout' action is returned.
  static getActionForPlayer(messages, channel, player, previousActions, scheduler=rx.Scheduler.timeout, timeout=30) {
    let intro = `${player.name}, it's your turn to act.`;
    let availableActions = PlayerInteraction.getAvailableActions(player, previousActions);
    let formatMessage = (t) => PlayerInteraction.buildActionMessage(availableActions, t);
    let {timeExpired} = PlayerInteraction.postMessageWithTimeout(channel, intro,
      formatMessage, scheduler, timeout);

    // Look for text that conforms to a player action.
    let playerAction = messages.where((e) => e.user === player.id)
      .map((e) => PlayerInteraction.actionForMessage(e.text, availableActions))
      .where((action) => action !== '')
      .publish();

    playerAction.connect();
    let disp = timeExpired.connect();

    // If the user times out, they will be auto-folded unless they can check.
    let actionForTimeout = timeExpired.map(() =>
      availableActions.indexOf('check') > -1 ? 'check' : 'fold');

    // NB: Take the first result from the player action, the timeout, and a bot
    // action (only applicable to bots).
    return rx.Observable
      .merge(playerAction, actionForTimeout,
        player.isBot ? player.getAction(availableActions, previousActions) : rx.Observable.never())
      .take(1)
      .do((action) => {
        disp.dispose();
        channel.send(`${player.name} ${action}s.`);
      });
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
    let playerBet = actions.indexOf('bet') > -1;
    let playerRaised = actions.indexOf('raise') > -1;

    let availableActions = [];

    if (player.isBigBlind && !playerRaised) {
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

  // Private: Maps abbreviated text for a player action to its canonical name.
  //
  // text - The text of the player message
  // availableActions - An array of the actions available to this player
  //
  // Returns the canonical action
  static actionForMessage(text, availableActions) {
    if (!text) return '';

    switch (text.toLowerCase()) {
    case 'c':
      return availableActions[0];
    case 'call':
      return 'call';
    case 'check':
      return 'check';
    case 'f':
    case 'fold':
      return 'fold';
    case 'b':
    case 'bet':
      return 'bet';
    case 'r':
    case 'raise':
      return 'raise';
    default:
      return '';
    }
  }
}

module.exports = PlayerInteraction;
