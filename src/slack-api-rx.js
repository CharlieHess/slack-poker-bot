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
      .flatMap(user => SlackApiRx.getOrOpenDm(slackApi, user))
      .reduce((acc, x) => {
        acc[x.id] = x.dm;
        return acc;
      }, {})
      .publishLast();
      
    ret.connect();
    return ret;
  }
  
  // Private: Checks for the existence of an open DM channel for the user, and
  // opens one if necessary.
  //
  // slackApi - An instance of the Slack client
  // user - The user we are trying to DM with
  //
  // Returns an {Observable} of the opened DM channel
  static getOrOpenDm(slackApi, user) {
    let readySubj = new rx.AsyncSubject();
    let dm = slackApi.getDMByName(user.name);
    console.log(`Opening DM channel for ${user.name}`);
    
    if (!dm || !dm.is_open) {
      slackApi.openDM(user.id, (result) => {
        if (result.ok) {
          dm = slackApi.getDMByName(user.name);
          readySubj.onNext({id: user.id, dm: dm});
          readySubj.onCompleted();
        } else {
          console.log(`Unable to open DM for ${user.name}: ${result.error}`);
          readySubj.onCompleted();
        }
      });
    } else {
      readySubj.onNext({id: user.id, dm: dm});
      readySubj.onCompleted();
    }
    return readySubj;
  }
};
