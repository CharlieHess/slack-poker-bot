const rx = require('rx');

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
  // scheduler - (Optional) The scheduler to use for timing events
  // timeout - (Optional) The amount of time to conduct polling, in seconds
  //
  // Returns an {Observable} indicating the action the player took. If time
  // expires, a 'timeout' action is returned.
  static getActionForPlayer(messages, channel, player, scheduler=rx.Scheduler.timeout, timeout=30) {
    let intro = `${player.name}, it's your turn to act.`;
    let formatMessage = (t) => `Respond with *(C)heck*, *(F)old*, or *(B)et* / *(R)aise* in the next ${t} seconds.`;
    let {timeExpired, message} = PlayerInteraction.postMessageWithTimeout(channel, intro,
      formatMessage, scheduler, timeout);

    // Look for text that conforms to a player action.
    let playerAction = messages.where((e) => e.user === player.id)
      .map((e) => PlayerInteraction.actionForMessage(e.text))
      .where((action) => action !== '')
      .publish();

    playerAction.connect();
    let disp = timeExpired.connect();

    // NB: Take the first result from the player action, the timeout, and a bot
    // action (only applicable to bots)
    return rx.Observable
      .merge(playerAction, timeExpired.map(() => 'timeout'),
        player.isBot ? player.getAction() : rx.Observable.never())
      .take(1)
      .do((action) => {
        disp.dispose();
        message.updateMessage(`${player.name} ${action}s.`);
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

  // Private: Maps abbreviated text for a player action to its canonical name.
  //
  // text - The text of the player message
  //
  // Returns the canonical action
  static actionForMessage(text) {
    if (!text) return '';

    switch (text.toLowerCase()) {
    case 'c':
    case 'check':
      return 'check';
    case 'f':
    case 'fold':
      return 'fold';
    case 'b':
    case 'bet':
    case 'r':
    case 'raise':
      return 'bet';
    default:
      return '';
    }
  }
}

module.exports = PlayerInteraction;
