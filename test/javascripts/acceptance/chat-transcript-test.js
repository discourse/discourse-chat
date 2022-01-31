import PrettyText, { buildOptions } from "pretty-text/pretty-text";
import { deepMerge } from "discourse-common/lib/object";
import QUnit, { module, skip, test } from "qunit";
import Site from "discourse/models/site";

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

acceptance("Discourse Chat | discourse-chat-transcript", function (needs) {
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
      `[chat quote="martin;2022-01-25T05:40:39Z;2321"]\nThis is a chat message.\n[/chat]`,
      { additionalOptions },
      `<div class="discourse-chat-transcript">
<p>This is a chat message.</p></div>`,
      "renders the chat message with the required CSS classes and attributes"
    );
  });

  test("renders with minimal markdown rules inside the quote bbcode block, same as server-side chat messages", function (assert) {
    assert.cookedChatTranscript(
      `[chat quote="martin;2022-01-25T05:40:39Z;2321"]
[quote="martin, post:3, topic:6215"]
another cool reply
[/quote]
[/chat]`,
      { additionalOptions },
      `<div class=\"discourse-chat-transcript\">
<p>[quote=&quot;martin, post:3, topic:6215&quot;]<br>
another cool reply<br>
[/quote]</p></div>`,
      "does not render the markdown feature that has been excluded"
    );

    assert.cookedChatTranscript(
      `[chat quote="martin;2022-01-25T05:40:39Z;2321"]\nThis ~~does work~~ with removed _rules_.\n\n* list item 1\n[/chat]`,
      { additionalOptions },
      `<div class=\"discourse-chat-transcript\">
<p>This <s>does work</s> with removed <em>rules</em>.</p>
<ul>
<li>list item 1</li>
</ul></div>`,
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
      `[chat quote="martin;2022-01-25T05:40:39Z;2321"]\nThis ~~does work~~ with removed _rules_.\n\n* list item 1\n[/chat]`,
      { additionalOptions },
      `<div class=\"discourse-chat-transcript\">
<p>This ~~does work~~ with removed _rules_.</p>
<p>* list item 1</p></div>`,
      "renders correctly with some obvious rules excluded (list/strikethrough/emphasis)"
    );

    assert.cookedChatTranscript(
      `[chat quote="martin;2022-01-25T05:40:39Z;2321"]\nhere is a message :P with category hashtag #test\n[/chat]`,
      { additionalOptions },
      `<div class=\"discourse-chat-transcript\">
<p>here is a message <img src="/images/emoji/twitter/stuck_out_tongue.png?v=12" title=":stuck_out_tongue:" class="emoji" alt=":stuck_out_tongue:"> with category hashtag <span class=\"hashtag\">#test</span></p></div>`,
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
      `[chat quote="martin;2022-01-25T05:40:39Z;2321"]\nhere is a message :P with category hashtag #test\n[/chat]`,
      { additionalOptions },
      `<div class=\"discourse-chat-transcript\">
<p>here is a message :P with category hashtag #test</p></div>`,
      "renders correctly with some obvious features excluded (category-hashtag, emojiShortcuts)"
    );

    assert.cookedChatTranscript(
      `This ~~does work~~ with removed _rules_.

* list item 1

here is a message :P with category hashtag #test

[chat quote="martin;2022-01-25T05:40:39Z;2321"]
This ~~does work~~ with removed _rules_.

* list item 1

here is a message :P with category hashtag #test
[/chat]`,
      { additionalOptions },
      `<p>This <s>does work</s> with removed <em>rules</em>.</p>
<ul>
<li>list item 1</li>
</ul>
<p>here is a message <img src="/images/emoji/twitter/stuck_out_tongue.png?v=12" title=":stuck_out_tongue:" class="emoji" alt=":stuck_out_tongue:"> with category hashtag <span class=\"hashtag\">#test</span></p>
<div class="discourse-chat-transcript">
<p>This ~~does work~~ with removed _rules_.</p>
<p>* list item 1</p>
<p>here is a message :P with category hashtag #test</p></div>`,
      "the rule changes do not apply outside the BBCode [chat] block"
    );
  });
});
