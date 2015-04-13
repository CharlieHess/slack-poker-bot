class MessageHelpers {
  // Public: Checks whether the message text contains an @-mention for the
  // given user.
  static containsUserMention(messageText, userId) {
    let userTag = `<@${userId}>`;
    return messageText &&
      messageText.length >= userTag.length &&
      messageText.substr(0, userTag.length) === userTag;
  }
}

module.exports = MessageHelpers;