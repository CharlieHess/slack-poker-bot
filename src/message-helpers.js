class MessageHelpers {
  // Public: Checks whether the message text contains an @-mention for the
  // given user.
  static containsUserMention(messageText, userId) {
    let userTag = `<@${userId}>`;
    return messageText && messageText.startsWith(userTag);
  }

  static formatAtUser(user) {
    return `<@${user.id}|${user.name}>`
  }

  static money(n, dollar='$', plus='') {
    return `${n < 0 ? '-' : plus}${dollar}${Math.abs(n)}`;
  }

  static get CLOCK() {
    return ['🕛', '🕚', '🕙', '🕘', '🕗', '🕖', '🕕', '🕔', '🕓', '🕒', '🕑', '🕐'];
  }

  static timer(t) {
    if (t <= 0) {
      return '';
    }
    let CLOCK = MessageHelpers.CLOCK;
    return ` in ${CLOCK[t % CLOCK.length]}${t}s`;
  }
}

module.exports = MessageHelpers;
