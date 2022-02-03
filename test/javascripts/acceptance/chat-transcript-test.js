import PrettyText, { buildOptions } from "pretty-text/pretty-text";
import { deepMerge } from "discourse-common/lib/object";
import QUnit, { test } from "qunit";

import { acceptance } from "discourse/tests/helpers/qunit-helpers";

const rawOpts = {
  siteSettings: {
    enable_emoji: true,
    enable_emoji_shortcuts: true,
    enable_mentions: true,
    emoji_set: "twitter",
    external_emoji_url: "",
    highlighted_languages: "json|ruby|javascript",
    default_code_lang: "auto",
    enable_markdown_linkify: true,
    markdown_linkify_tlds: "com",
    chat_enabled: true,
  },
  getURL: (url) => url,
};
QUnit.assert.cookedChatTranscript = function (input, opts, expected, message) {
  const merged = deepMerge({}, rawOpts, opts);
  const actual = new PrettyText(buildOptions(merged)).cook(input);
  this.pushResult({
    result: actual === expected,
    actual,
    expected,
    message,
  });
};

function generateTranscriptHTML(messageContent, opts) {
  const channelDataAttr = opts.channel
    ? ` data-channel-name=\"${opts.channel}\"`
    : "";

  const transcript = [];
  transcript.push(
    `<div class=\"discourse-chat-transcript\" data-message-id=\"${opts.messageId}\" data-username=\"${opts.username}\" data-datetime=\"${opts.datetime}\"${channelDataAttr}>`
  );

  if (opts.channel) {
    transcript.push(`<div class=\"chat-transcript-meta\">
Originally posted in #${opts.channel}.</div>`);
  }

  transcript.push(`<div class=\"chat-transcript-user\">
<div class=\"chat-transcript-user-avatar\"></div>
<div class=\"chat-transcript-username\">
${opts.username}</div>
<div class=\"chat-transcript-datetime\">
<a href=\"/chat/message/${opts.messageId}\" title=\"${opts.datetime}\"></a></div>
</div>
<div class=\"chat-transcript-messages\">
${messageContent}</div>
</div>`);
  return transcript.join("\n");
}

acceptance("Discourse Chat | discourse-chat-transcript", function () {
  // these are both set by the plugin with Site.markdown_additional_options which we can't really
  // modify the response for here, source of truth are consts in ChatMessage::MARKDOWN_FEATURES
  // and ChatMessage::MARKDOWN_IT_RULES
  let additionalOptions = {
    chat: {
      limited_pretty_text_features: [
        "anchor",
        "bbcode-block",
        "bbcode-inline",
        "category-hashtag",
        "censored",
        "discourse-local-dates",
        "emoji",
        "emojiShortcuts",
        "inlineEmoji",
        "html-img",
        "mentions",
        "onebox",
        "text-post-process",
        "upload-protocol",
        "watched-words",
        "table",
        "spoiler-alert",
      ],
      limited_pretty_text_markdown_rules: [
        "autolink",
        "list",
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
    },
  };

  test("works with a minimal quote bbcode block", function (assert) {
    assert.cookedChatTranscript(
      `[chat quote="martin;2321;2022-01-25T05:40:39Z"]\nThis is a chat message.\n[/chat]`,
      { additionalOptions },
      generateTranscriptHTML("<p>This is a chat message.</p>", {
        messageId: "2321",
        username: "martin",
        datetime: "2022-01-25T05:40:39Z",
      }),
      "renders the chat message with the required CSS classes and attributes"
    );
  });

  test("renders the channel name if provided", function (assert) {
    assert.cookedChatTranscript(
      `[chat quote="martin;2321;2022-01-25T05:40:39Z" channel="Cool Cats Club"]\nThis is a chat message.\n[/chat]`,
      { additionalOptions },
      generateTranscriptHTML("<p>This is a chat message.</p>", {
        messageId: "2321",
        username: "martin",
        datetime: "2022-01-25T05:40:39Z",
        channel: "Cool Cats Club",
      }),
      "renders the chat transcript with the channel name included"
    );
  });

  test("renders with minimal markdown rules inside the quote bbcode block, same as server-side chat messages", function (assert) {
    assert.cookedChatTranscript(
      `[chat quote="johnsmith;450;2021-04-25T05:40:39Z"]
[quote="martin, post:3, topic:6215"]
another cool reply
[/quote]
[/chat]`,
      { additionalOptions },
      generateTranscriptHTML(
        `<p>[quote=&quot;martin, post:3, topic:6215&quot;]<br>
another cool reply<br>
[/quote]</p>`,
        {
          messageId: "450",
          username: "johnsmith",
          datetime: "2021-04-25T05:40:39Z",
        }
      ),
      "does not render the markdown feature that has been excluded"
    );

    assert.cookedChatTranscript(
      `[chat quote="martin;2321;2022-01-25T05:40:39Z"]\nThis ~~does work~~ with removed _rules_.\n\n* list item 1\n[/chat]`,
      { additionalOptions },
      generateTranscriptHTML(
        `<p>This <s>does work</s> with removed <em>rules</em>.</p>
<ul>
<li>list item 1</li>
</ul>`,
        {
          messageId: "2321",
          username: "martin",
          datetime: "2022-01-25T05:40:39Z",
        }
      ),
      "renders correctly when the rule has not been excluded"
    );

    additionalOptions.chat.limited_pretty_text_markdown_rules = [
      "autolink",
      // "list",
      "backticks",
      "newline",
      "code",
      "fence",
      "table",
      "linkify",
      "link",
      // "strikethrough",
      "blockquote",
      // "emphasis",
    ];

    assert.cookedChatTranscript(
      `[chat quote="martin;2321;2022-01-25T05:40:39Z"]\nThis ~~does work~~ with removed _rules_.\n\n* list item 1\n[/chat]`,
      { additionalOptions },
      generateTranscriptHTML(
        `<p>This ~~does work~~ with removed _rules_.</p>
<p>* list item 1</p>`,
        {
          messageId: "2321",
          username: "martin",
          datetime: "2022-01-25T05:40:39Z",
        }
      ),
      "renders correctly with some obvious rules excluded (list/strikethrough/emphasis)"
    );

    assert.cookedChatTranscript(
      `[chat quote="martin;2321;2022-01-25T05:40:39Z"]\nhere is a message :P with category hashtag #test\n[/chat]`,
      { additionalOptions },
      generateTranscriptHTML(
        `<p>here is a message <img src=\"/images/emoji/twitter/stuck_out_tongue.png?v=12\" title=\":stuck_out_tongue:\" class=\"emoji\" alt=\":stuck_out_tongue:\"> with category hashtag <span class=\"hashtag\">#test</span></p>`,
        {
          messageId: "2321",
          username: "martin",
          datetime: "2022-01-25T05:40:39Z",
        }
      ),
      "renders correctly when the feature has not been excluded"
    );

    additionalOptions.chat.limited_pretty_text_features = [
      "anchor",
      "bbcode-block",
      "bbcode-inline",
      // "category-hashtag",
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
    ];

    assert.cookedChatTranscript(
      `[chat quote="martin;2321;2022-01-25T05:40:39Z"]\nhere is a message :P with category hashtag #test\n[/chat]`,
      { additionalOptions },
      generateTranscriptHTML(
        `<p>here is a message :P with category hashtag #test</p>`,
        {
          messageId: "2321",
          username: "martin",
          datetime: "2022-01-25T05:40:39Z",
        }
      ),
      "renders correctly with some obvious features excluded (category-hashtag, emojiShortcuts)"
    );

    assert.cookedChatTranscript(
      `This ~~does work~~ with removed _rules_.

* list item 1

here is a message :P with category hashtag #test

[chat quote="martin;2321;2022-01-25T05:40:39Z"]
This ~~does work~~ with removed _rules_.

* list item 1

here is a message :P with category hashtag #test
[/chat]`,
      { additionalOptions },
      `<p>This <s>does work</s> with removed <em>rules</em>.</p>
<ul>
<li>list item 1</li>
</ul>
<p>here is a message <img src=\"/images/emoji/twitter/stuck_out_tongue.png?v=12\" title=\":stuck_out_tongue:\" class=\"emoji\" alt=\":stuck_out_tongue:\"> with category hashtag <span class=\"hashtag\">#test</span></p>\n` +
        generateTranscriptHTML(
          `<p>This ~~does work~~ with removed _rules_.</p>
<p>* list item 1</p>
<p>here is a message :P with category hashtag #test</p>`,
          {
            messageId: "2321",
            username: "martin",
            datetime: "2022-01-25T05:40:39Z",
          }
        ),
      "the rule changes do not apply outside the BBCode [chat] block"
    );
  });
});
