export const rosterMessageId = 'roster-message';
export const startGameMessageId = 'start-game';
export const minimumPlayersNeeded = 2;

export function showGameRoster({players, bot, message, interactive = false}) {
  const playerIds = Object.keys(players);
  let rosterMessage = 'Alright, who wants to play?';

  if (playerIds.length > 0) {
    rosterMessage += ' Our current lineup is';

    for (let idx = 0; idx < playerIds.length; idx++) {
      const playerId = playerIds[idx];
      rosterMessage += ` ${players[playerId].user}`;

      if (idx < playerIds.length - 1) rosterMessage += ',';
    }
  }

  const replyMethod = interactive ? bot.replyInteractive : bot.reply;
  const attachments = [{
    title: '',
    callback_id: rosterMessageId,
    attachment_type: 'default',
    actions: [{
      name: 'join',
      text: 'Join',
      value: 'join',
      type: 'button'
    }, {
      text: 'Leave',
      name: 'leave',
      value: 'leave',
      style: 'danger',
      type: 'button'
    }]
  }];

  if (playerIds.length >= minimumPlayersNeeded) {
    attachments.push({
      title: '',
      callback_id: startGameMessageId,
      attachment_type: 'default',
      actions: [{
        name: 'start-game',
        text: 'Start Game',
        value: 'start-game',
        type: 'button',
        confirm: {
          title: 'Is everyone ready?',
          text: 'Once the game is started, you cannot add additional players. Are you sure you want to start?',
          ok_text: 'Yep, deal us in',
          dismiss_text: 'No, hold on'
        }
      }]
    });
  }

  replyMethod(message, {
    text: rosterMessage,
    attachments
  });
}

export async function updateGameRoster({controller, players, bot, message}) {
  const player = await getOrUpdateUser({controller, message});
  const action = message.actions[0].value;

  console.log(`${player.user} took action: ${action}`);

  switch (action) {
  case 'join':
    players[player.id] = player;
    break;
  case 'leave':
    delete players[player.id];
    break;
  }

  showGameRoster({players, bot, message, interactive: true});

  // if (Object.keys(players).length === minimumPlayersNeeded) {
  //   bot.replyInteractive(message, {
  //     text: 'Start game',
  //     replace_original: false,
  //     response_type: 'ephemeral',
  //     attachments: []
  //   });
  // }
}

function getOrUpdateUser({controller, message}) {
  return new Promise((resolve, reject) => {
    controller.storage.users.get(message.user, (err, user) => {
      if (err) {
        reject(err.message);
        return;
      }

      if (!user) {
        const response = JSON.parse(message.payload);
        user = {
          id: message.user,
          user: response.user.name
        };

        controller.storage.users.save(user);
      }

      resolve(user);
    });
  });
}
