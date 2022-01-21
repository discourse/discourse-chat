const chatTranscriptRule = {
  tag: "chat",

  replace: function (state, tagInfo, content) {
    const token = state.push("html_raw", "", 0);
    token.discourseOpts = {
      rerender: true,
      featuresOverride: [
        "anchor",
        "bbcode-block",
        "bbcode-inline",
        "category-hashtag",
        "censored",
        "discourse-local-dates",
        "emoji",
        // "emojiShortcuts",
        "inlineEmoji",
        "html-img",
        "mentions",
        "onebox",
        "text-post-process",
        "upload-protocol",
        "watched-words",
        "table",
        "spoiler-alert",
        "discourse-chat-transcript",
      ],
      markdownItRules: [
        "autolink",
        // "list",
        "backticks",
        "newline",
        "code",
        "fence",
        "table",
        "linkify",
        "link",
        "strikethrough",
        "blockquote",
        "emphasis",
      ],
    };
    token.content = `[chatbaked quote="${tagInfo.attrs.quote}"]\n${content}\n[/chatbaked]`;
    return true;
  },
};

const chatBakedTranscriptRule = {
  tag: "chatbaked",

  before: function (state) {
    let wrapperDivToken = state.push("div_chat_transcript_wrap", "div", 1);
    wrapperDivToken.attrs = [["class", "discourse-chat-transcript"]];
  },

  after: function (state) {
    state.push("div_chat_transcript_wrap", "div", -1);
  },
};

export function setup(helper) {
  helper.allowList([
    "div.discourse-chat-transcript",
    "div[data-chat-channel-id]",
    "div[data-chat-message-id-range-start]",
    "div[data-chat-message-id-range-end]",
  ]);

  helper.registerOptions((opts, siteSettings) => {
    opts.features["discourse-chat-transcript"] = !!siteSettings.chat_enabled;
  });

  helper.registerPlugin((md) => {
    const features = md.options.discourse.features;
    if (features["discourse-chat-transcript"]) {
      md.block.bbcode.ruler.push(
        "discourse-chat-transcript",
        chatTranscriptRule
      );
      md.block.bbcode.ruler.push(
        "discourse-chat-rare-transcript",
        chatBakedTranscriptRule
      );
    }
  });
}
