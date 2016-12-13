import {getOrUpdateUser} from './storage-utils';

export const rosterMessageId = 'roster-message';
export const startGameMessageId = 'start-game';
export const minimumPlayersNeeded = 2;
export const maximumPlayersAllowed = 10;

export function showGameRoster({players, bot, message, interactive = false}) {
  const playerIds = Object.keys(players);
  let rosterMessage = 'Alright, who wants to play?';

  if (playerIds.length > 0) {
    rosterMessage += '\nOur current lineup is:\n';

    for (const playerId of playerIds) {
      rosterMessage += `\t• ${players[playerId].user}\n`;
    }
  }

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

  const replyMethod = interactive ? bot.replyInteractive : bot.reply;

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
}

export function showInProgressMessage({players, bot, message}) {
  const playerIds = Object.keys(players);

  let inProgressMessage = 'A game is now in progress featuring';
  for (let idx = 0; idx < playerIds.length; idx++) {
    const playerId = playerIds[idx];
    const isLastPlayer = idx === playerIds.length - 1;

    inProgressMessage +=
      `${isLastPlayer ? ' and ' : ' '}` +
      `${players[playerId].user}` +
      `${isLastPlayer ? '.' : ','}`;
  }

  bot.replyInteractive(message, inProgressMessage);
}
