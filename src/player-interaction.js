let rx = require('rx');

class PlayerInteraction {
  
  static pollPotentialPlayers(messages, channel, timeout=10, maxPlayers=6) {
    channel.send(`Who wants to play?`);
    let formatTime = (t) => `Respond with 'yes' in this channel in the next ${t} seconds`;
    let timeMessage = channel.send(formatTime(timeout));

    let currentPlayers = new rx.Subject();
    
    rx.Observable.timer(0, 1000)
      .take(timeout + 1)
      .subscribe(
        (x) => timeMessage.updateMessage(formatTime(`${timeout-x}`)),
        (err) => console.log(err),
        () => currentPlayers.onCompleted());

    messages.where((e) => e.text && e.text.toLowerCase().match(/\byes\b/))
      .map((e) => e.user)
      .distinct()
      .subscribe((user) => currentPlayers.onNext(user));
      
    return currentPlayers;
  }
}

module.exports = PlayerInteraction;