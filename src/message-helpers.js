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
}

module.exports = MessageHelpers;
