import I18n from "I18n";

let customMarkdownCookFn;

const chatTranscriptRule = {
  tag: "chat",

  replace: function (state, tagInfo, content) {
    // shouldn't really happen but we don't want to break rendering if it does
    if (!customMarkdownCookFn) {
      return;
    }

    const options = state.md.options.discourse;
    let [username, messageIdStart, messageTimeStart] =
      (tagInfo.attrs.quote && tagInfo.attrs.quote.split(";")) || [];
    let multiQuote = !!tagInfo.attrs.multiQuote;
    let noLink = !!tagInfo.attrs.noLink;
    let channelName = tagInfo.attrs.channel;
    let channelLink = channelName
      ? options.getURL(
          `/chat/chat_channels/${encodeURIComponent(channelName.toLowerCase())}`
        )
      : null;

    if (!username || !messageIdStart || !messageTimeStart) {
      return;
    }

    let wrapperDivToken = state.push("div_chat_transcript_wrap", "div", 1);
    let wrapperClasses = ["discourse-chat-transcript"];

    if (!!tagInfo.attrs.chained) {
      wrapperClasses.push("chat-transcript-chained");
    }

    wrapperDivToken.attrs = [["class", wrapperClasses.join(" ")]];
    wrapperDivToken.attrs.push(["data-message-id", messageIdStart]);
    wrapperDivToken.attrs.push(["data-username", username]);
    wrapperDivToken.attrs.push(["data-datetime", messageTimeStart]);

    if (channelName) {
      wrapperDivToken.attrs.push(["data-channel-name", channelName]);

      if (multiQuote) {
        let metaDivToken = state.push("div_chat_transcript_meta", "div", 1);
        metaDivToken.attrs = [["class", "chat-transcript-meta"]];
        const channelToken = state.push("html_inline", "", 0);
        channelToken.content = I18n.t("chat.quote.original_channel", {
          channel: channelName,
          channelLink,
        });
        state.push("div_chat_transcript_meta", "div", -1);
      }
    }

    let userDivToken = state.push("div_chat_transcript_user", "div", 1);
    userDivToken.attrs = [["class", "chat-transcript-user"]];

    // start: user avatar
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
    // end: user avatar

    // start: username
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
    // end: username

    // start: time + link to message
    let datetimeDivToken = state.push("div_chat_transcript_datetime", "div", 1);
    datetimeDivToken.attrs = [["class", "chat-transcript-datetime"]];

    // for some cases, like archiving, we don't want the link to the
    // chat message because it will just result in a 404
    if (noLink) {
      let spanToken = state.push("span_open", "span", 1);
      spanToken.attrs = [
        ["title", messageTimeStart],
      ];

      spanToken.block = false;
      spanToken = state.push("span_close", "span", -1);
      spanToken.block = false;
    } else {
      let linkToken = state.push("link_open", "a", 1);
      linkToken.attrs = [
        ["href", options.getURL(`/chat/message/${messageIdStart}`)],
        ["title", messageTimeStart],
      ];

      linkToken.block = false;
      linkToken = state.push("link_close", "a", -1);
      linkToken.block = false;
    }

    state.push("div_chat_transcript_datetime", "div", -1);
    // end: time + link to message

    // start: channel link for !multiQuote
    if (channelName && !multiQuote) {
      let channelLinkToken = state.push("link_open", "a", 1);
      channelLinkToken.attrs = [
        ["class", "chat-transcript-channel"],
        ["href", channelLink],
      ];
      let inlineTextToken = state.push("html_inline", "", 0);
      inlineTextToken.content = `#${channelName}`;
      channelLinkToken = state.push("link_close", "a", -1);
      channelLinkToken.block = false;
    }
    // end: channel link for !multiQuote

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
    "div[class=discourse-chat-transcript]",
    "div[class=discourse-chat-transcript chat-transcript-chained]",
    "div.chat-transcript-meta",
    "div.chat-transcript-user",
    "div.chat-transcript-username",
    "div.chat-transcript-user-avatar",
    "div.chat-transcript-messages",
    "div.chat-transcript-datetime",
    "span[title]",
    "div[data-message-id]",
    "div[data-channel-name]",
    "div[data-username]",
    "div[data-datetime]",
    "a.chat-transcript-channel",
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

  helper.buildCookFunction((opts, generateCookFunction) => {
    if (!opts.discourse.additionalOptions) {
      return;
    }

    const chatAdditionalOpts = opts.discourse.additionalOptions.chat;

    // we need to be able to quote images from chat, but the image rule is usually
    // banned for chat messages
    const markdownItRules =
      chatAdditionalOpts.limited_pretty_text_markdown_rules.concat("image");

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
