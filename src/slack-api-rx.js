const rx = require('rx');

module.exports = class SlackApiRx {
  // Public: Retrieves DM channels for all of the given users, opening any that
  // do not already exist.
  //
  // slackApi - An instance of the Slack client
  // users - The users to fetch DM channels for
  //
  // Returns an {Observable} that signals completion
  static openDms(slackApi, users) {
    let ret = rx.Observable.fromArray(users)
      .flatMap((user) => SlackApiRx.getOrOpenDm(slackApi, user))
      .reduce((acc, x) => {
        acc[x.id] = x.dm;
        return acc;
      }, {})
      .publishLast();
      
    ret.connect();
    return ret;
  }
  
  // Private: Checks for the existence of an open DM channel for the user,
  // opens one if necessary, then waits for the `im_open` event and retrieves
  // the DM channel.
  //
  // slackApi - An instance of the Slack client
  // user - The user we are trying to DM with
  //
  // Returns an {Observable} representing the opened channel. This will be an
  // object with two keys: `id` and `dm`. DM will be null if the API call
  // failed for some reason (e.g., an invalid user).
  static getOrOpenDm(slackApi, user) {
    console.log(`Getting DM channel for ${user.name}`);
    let dm = slackApi.getDMByName(user.name);
    
    // Bot players don't need DM channels; we only talk to humans
    if ((dm && dm.is_open) || user.isBot) {
      return rx.Observable.return({id: user.id, dm: dm});
    }
    
    console.log(`No open channel found, opening one using ${user.id}`);
    
    return SlackApiRx.openDm(slackApi, user)
      .flatMap(() => SlackApiRx.waitForDmToOpen(slackApi, user))
      .flatMap((dm) => rx.Observable.return({id: user.id, dm: dm}))
      .catch(rx.Observable.return({id: user.id, dm: null}));
  }
  
  // Private: Maps the `im.open` API call into an {Observable}.
  //
  // Returns an {Observable} that signals completion, or an error if the API
  // call fails
  static openDm(slackApi, user) {
    let calledOpen = new rx.AsyncSubject();
    
    slackApi.openDM(user.id, (result) => {
      if (result.ok) {
        calledOpen.onNext(user.name);
        calledOpen.onCompleted();
      } else {
        console.log(`Unable to open DM for ${user.name}: ${result.error}`);
        calledOpen.onError(new Error(result.error));
      }
    })
    
    return calledOpen;
  }

  // Private: The `im.open` callback is still not late enough; we need to wait
  // for the client's underlying list of DM's to be updated. When that occurs
  // we can retrieve the DM.
  //
  // Returns a replayable {Observable} containing the opened DM channel
  static waitForDmToOpen(slackApi, user) {
    let ret = rx.DOM.fromEvent(slackApi, 'raw_message')
      .where((m) => m.type === 'im_open' && m.user === user.id)
      .take(1)
      .flatMap(() => rx.Observable.timer(100).map(() => 
        slackApi.getDMByName(user.name)))
      .publishLast();
      
    ret.connect();
    return ret;
  }
};
