let rx = require('rx');

class PlayerInteraction {
  // Public: Poll players that want to join the game during a specified period 
  // of time.
  // 
  // messages - An {Observable} representing new messages sent to the channel
  // channel - The {Channel} object, used for posting messages
  // timeout - (Optional) The amount of time to conduct polling, in seconds
  // maxPlayers - (Optional) The maximum number of players to allow
  //
  // Returns an {Observable} that will `onNext` for each player that joins and
  // `onCompleted` when time expires or the max number of players join.
  static pollPotentialPlayers(messages, channel, timeout=10, maxPlayers=6) {
    channel.send(`Who wants to play?`);
    let formatTime = (t) => `Respond with 'yes' in this channel in the next ${t} seconds.`;
    let timeMessage = channel.send(formatTime(timeout));

    // Start a timer for `timeout` seconds, that ticks once per second, 
    // updating a message in the channel.
    let timeExpired = rx.Observable.timer(0, 1000)
      .take(timeout + 1)
      .do((x) => timeMessage.updateMessage(formatTime(`${timeout - x}`)))
      .publishLast();

    // Look for messages containing the word 'yes' and map them to a unique
    // user ID, constrained to `maxPlayers` number of players.
    let totalPlayers = messages.where((e) => e.text && e.text.toLowerCase().match(/\byes\b/))
      .map((e) => e.user)
      .distinct()
      .take(maxPlayers)
      .publish();
    
    timeExpired.connect();
    totalPlayers.connect();

    // Once our timer has expired, we're done accepting new players.
    return totalPlayers.takeUntil(timeExpired);
  }
}

module.exports = PlayerInteraction;