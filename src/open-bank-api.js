const rx = require('rx');
const needle = require('needle');
const debug = require('debug')('bankapi');

const baseUrl = 'https://apisandbox.openbankproject.com'

const api = {
  authenticate: (username, password) => {
    const authSubject = new rx.AsyncSubject();
    const data = {
      username,
      password
    }

    needle.post(`${baseUrl}/user_mgt/login`, { username, password }, (err, body) => {
      debug(body.headers);
      authSubject.onNext(body);
      authSubject.onCompleted();
    });

    return authSubject;
  }
}

export default api
