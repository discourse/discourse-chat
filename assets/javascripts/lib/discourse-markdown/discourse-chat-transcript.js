let customMarkdownCookFn;

const chatTranscriptRule = {
  tag: "chat",

  replace: function (state, tagInfo, content) {
    const options = state.md.options.discourse;
    let [username, messageIdStart, messageTimeStart] =
      (tagInfo.attrs.quote && tagInfo.attrs.quote.split(";")) || [];
    let channelName = tagInfo.attrs.channel;

    if (!username || !messageIdStart || !messageTimeStart) {
      return;
    }

    let wrapperDivToken = state.push("div_chat_transcript_wrap", "div", 1);
    wrapperDivToken.attrs = [["class", "discourse-chat-transcript"]];

    if (channelName) {
      let metaDivToken = state.push("div_chat_transcript_meta", "div", 1);
      metaDivToken.attrs = [["class", "chat-transcript-meta"]];
      const channelToken = state.push("html_inline", "", 0);
      channelToken.content = I18n.t("chat.quote.original_channel", {
        channel: `#${channelName}`,
      });
      state.push("div_chat_transcript_meta", "div", -1);
    }

    let userDivToken = state.push("div_chat_transcript_user", "div", 1);
    userDivToken.attrs = [["class", "chat-transcript-user"]];

    let avatarDivToken = state.push(
      "div_chat_transcript_user_avatar",
      "div",
      1
    );
    avatarDivToken.attrs = [["class", "chat-transcript-user-avatar"]];

    // server-side, we need to lookup the avatar from the username
    let avatarImg;
    if (options.lookupAvatar) {
      avatarImg = options.lookupAvatar(username);
    }
    if (avatarImg) {
      const avatarImgToken = state.push("html_inline", "", 0);
      avatarImgToken.content = avatarImg;
    }

    state.push("div_chat_transcript_user_avatar", "div", -1);

    let usernameDivToken = state.push("div_chat_transcript_username", "div", 1);
    usernameDivToken.attrs = [["class", "chat-transcript-username"]];

    let displayName;
    if (options.formatUsername) {
      displayName = options.formatUsername(username);
    } else {
      displayName = username;
    }

    const usernameToken = state.push("html_inline", "", 0);
    usernameToken.content = displayName;

    state.push("div_chat_transcript_username", "div", -1);

    let datetimeDivToken = state.push("div_chat_transcript_datetime", "div", 1);
    datetimeDivToken.attrs = [["class", "chat-transcript-datetime"]];

    let linkToken = state.push("link_open", "a", 1);
    linkToken.attrs = [["href", options.getURL(`/chat/message/${messageIdStart}`)]];
    linkToken.block = false;

    let datetimeToken = state.push("html_inline", "", 0);
    datetimeToken.content = moment(messageTimeStart).format(
      I18n.t("dates.long_with_year")
    );

    linkToken = state.push("link_close", "a", -1);
    linkToken.block = false;

    state.push("div_chat_transcript_datetime", "div", -1);
    state.push("div_chat_transcript_user", "div", -1);

    let messagesToken = state.push("div_chat_transcript_messages", "div", 1);
    messagesToken.attrs = [["class", "chat-transcript-messages"]];

    // rendering chat message content with limited markdown rule subset
    const token = state.push("html_raw", "", 0);
    token.content = customMarkdownCookFn(content);
    state.push("html_raw", "", -1);

    state.push("div_chat_transcript_messages", "div", -1);
    state.push("div_chat_transcript_wrap", "div", -1);
    return true;
  },
};

export function setup(helper) {
  helper.allowList([
    "div.discourse-chat-transcript",
    "div.chat-transcript-meta",
    "div.chat-transcript-user",
    "div.chat-transcript-username",
    "div.chat-transcript-user-avatar",
    "div.chat-transcript-messages",
    "div.chat-transcript-datetime",
  ]);

  helper.registerOptions((opts, siteSettings) => {
    opts.features["discourse-chat-transcript"] = !!siteSettings.chat_enabled;
  });

  helper.registerPlugin((md) => {
    if (md.options.discourse.features["discourse-chat-transcript"]) {
      md.block.bbcode.ruler.push(
        "discourse-chat-transcript",
        chatTranscriptRule
      );
    }
  });

  helper.requestCustomMarkdownCookFunction((opts, generateCookFunction) => {
    const chatAdditionalOpts = opts.discourse.additionalOptions.chat;

    // we need to be able to quote images from chat, but the image rule is usually
    // banned for chat messages
    const markdownItRules = chatAdditionalOpts.limited_pretty_text_markdown_rules.concat(
      "image"
    );

    generateCookFunction(
      {
        featuresOverride: chatAdditionalOpts.limited_pretty_text_features,
        markdownItRules,
      },
      (customCookFn) => {
        customMarkdownCookFn = customCookFn;
      }
    );
  });
}
