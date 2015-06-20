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
    let timeExpired = PlayerInteraction.postMessageWithTimeout(channel, intro,
      formatMessage, scheduler, timeout);

    // Look for messages containing the word 'yes' and map them to a unique
    // user ID, constrained to `maxPlayers` number of players.
    let newPlayers = messages.where((e) => e.text && e.text.toLowerCase().match(/\byes\b/))
      .map((e) => e.user)
      .distinct()
      .take(maxPlayers)
      .publish();

    newPlayers.connect();

    // Once our timer has expired, we're done accepting new players.
    return newPlayers.takeUntil(timeExpired);
  }

  static getActionForPlayer(messages, channel, player, scheduler=rx.Scheduler.timeout, timeout=30) {
    let intro = `${player.name}, it's your turn to act.`;
    let formatMessage = (t) => `Respond with *(C)heck*, *(F)old*, or *(B)et* / *(R)aise* in the next ${t} seconds.`;
    let timeExpired = PlayerInteraction.postMessageWithTimeout(channel, intro,
      formatMessage, scheduler, timeout);

    let playerAction = messages.where((e) => e.user === player.id)
      .map((e) => PlayerInteraction.actionForMessage(e.text))
      .where((action) => action !== '')
      .publish();

    playerAction.connect();

    return rx.Observable
      .amb(playerAction, timeExpired.map(() => 'check'))
      .do((action) => channel.send(`${player.name} ${action}s.`));
  }

  static postMessageWithTimeout(channel, intro, formatMessage, scheduler, timeout) {
    channel.send(intro);
    let timeoutMessage = channel.send(formatMessage(timeout));

    // Start a timer for `timeout` seconds, that ticks once per second,
    // updating a message in the channel.
    let ret = rx.Observable.timer(0, 1000, scheduler)
      .take(timeout + 1)
      .do((x) => timeoutMessage.updateMessage(formatMessage(`${timeout - x}`)))
      .publishLast();

    ret.connect();
    return ret;
  }

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
