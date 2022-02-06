import PrettyText, { buildOptions } from "pretty-text/pretty-text";
import I18n from "I18n";
import topicFixtures from "discourse/tests/fixtures/topic";
import { cloneJSON, deepMerge } from "discourse-common/lib/object";
import QUnit, { test } from "qunit";

import { visit } from "@ember/test-helpers";
import {
  acceptance,
  loggedInUser,
  query,
} from "discourse/tests/helpers/qunit-helpers";

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

function cookMarkdown(input, opts) {
  const merged = deepMerge({}, rawOpts, opts);
  return new PrettyText(buildOptions(merged)).cook(input);
}

QUnit.assert.cookedChatTranscript = function (input, opts, expected, message) {
  const actual = cookMarkdown(input, opts);
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

  let transcriptClasses = ["discourse-chat-transcript"];
  if (opts.chained) {
    transcriptClasses.push("chat-transcript-chained");
  }

  const transcript = [];
  transcript.push(
    `<div class=\"${transcriptClasses.join(" ")}\" data-message-id=\"${opts.messageId}\" data-username=\"${opts.username}\" data-datetime=\"${opts.datetime}\"${channelDataAttr}>`
  );

  if (opts.channel && opts.multiQuote) {
    const originallySent = I18n.t("chat.quote.original_channel", {
      channel: opts.channel,
      channelLink: `/chat/chat_channels/${encodeURIComponent(
        opts.channel.toLowerCase()
      )}`,
    });
    transcript.push(`<div class=\"chat-transcript-meta\">
${originallySent}</div>`);
  }

  transcript.push(`<div class=\"chat-transcript-user\">
<div class=\"chat-transcript-user-avatar\"></div>
<div class=\"chat-transcript-username\">
${opts.username}</div>
<div class=\"chat-transcript-datetime\">
<a href=\"/chat/message/${opts.messageId}\" title=\"${opts.datetime}\"></a></div>`);

  if (opts.channel && !opts.multiQuote) {
    transcript.push(
      `<a class=\"chat-transcript-channel\" href="/chat/channel/${encodeURIComponent(
        opts.channel.toLowerCase()
      )}">
#${opts.channel}</a></div>`
    );
  } else {
    transcript.push("</div>");
  }

  transcript.push(`<div class=\"chat-transcript-messages\">
${messageContent}</div>
</div>`);
  return transcript.join("\n");
}

// these are both set by the plugin with Site.markdown_additional_options which we can't really
// modify the response for here, source of truth are consts in ChatMessage::MARKDOWN_FEATURES
// and ChatMessage::MARKDOWN_IT_RULES
function buildAdditionalOptions() {
  return {
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
}

acceptance("Discourse Chat | discourse-chat-transcript", function () {
  let additionalOptions = buildAdditionalOptions();

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

  test("renders the channel name if provided with multiQuote", function (assert) {
    assert.cookedChatTranscript(
      `[chat quote="martin;2321;2022-01-25T05:40:39Z" channel="Cool Cats Club" multiQuote="true"]\nThis is a chat message.\n[/chat]`,
      { additionalOptions },
      generateTranscriptHTML("<p>This is a chat message.</p>", {
        messageId: "2321",
        username: "martin",
        datetime: "2022-01-25T05:40:39Z",
        channel: "Cool Cats Club",
        multiQuote: true,
      }),
      "renders the chat transcript with the channel name included above the user and datetime"
    );
  });

  test("renders the channel name if provided without multiQuote", function (assert) {
    assert.cookedChatTranscript(
      `[chat quote="martin;2321;2022-01-25T05:40:39Z" channel="Cool Cats Club"]\nThis is a chat message.\n[/chat]`,
      { additionalOptions },
      generateTranscriptHTML("<p>This is a chat message.</p>", {
        messageId: "2321",
        username: "martin",
        datetime: "2022-01-25T05:40:39Z",
        channel: "Cool Cats Club",
      }),
      "renders the chat transcript with the channel name included next to the datetime"
    );
  });

  test("renders with the chained attribute for more compact quotes", function (assert) {
    assert.cookedChatTranscript(
      `[chat quote="martin;2321;2022-01-25T05:40:39Z" channel="Cool Cats Club" multiQuote="true" chained="true"]\nThis is a chat message.\n[/chat]`,
      { additionalOptions },
      generateTranscriptHTML("<p>This is a chat message.</p>", {
        messageId: "2321",
        username: "martin",
        datetime: "2022-01-25T05:40:39Z",
        channel: "Cool Cats Club",
        multiQuote: true,
        chained: true,
      }),
      "renders with the chained attribute"
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
      "upload-protocolrouter.location.setURL",
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

acceptance(
  "Discourse Chat | discourse-chat-transcript date decoration",
  function (needs) {
    let additionalOptions = buildAdditionalOptions();

    needs.user({
      admin: false,
      moderator: false,
      username: "eviltrout",
      id: 1,
      can_chat: true,
      has_chat_enabled: true,
    });
    needs.settings({
      chat_enabled: true,
    });

    needs.pretender((server, helper) => {
      server.get("/chat/chat_channels.json", () =>
        helper.response({
          public_channels: [],
          direct_message_channels: [],
        })
      );

      const topicResponse = cloneJSON(topicFixtures["/t/280/1.json"]);
      const firstPost = topicResponse.post_stream.posts[0];
      const postCooked = cookMarkdown(
        `[chat quote="martin;2321;2022-01-25T05:40:39Z"]\nThis is a chat message.\n[/chat]`,
        { additionalOptions }
      );
      firstPost.cooked += postCooked;

      server.get("/t/280.json", () => helper.response(topicResponse));
    });

    test("chat transcript datetimes are formatted into the link with decorateCookedElement", async function (assert) {
      loggedInUser().changeTimezone("Australia/Brisbane");
      await visit("/t/-/280");

      assert.strictEqual(
        query(".chat-transcript-datetime a").text.trim(),
        moment
          .tz("2022-01-25T05:40:39Z", "Australia/Brisbane")
          .format(I18n.t("dates.long_no_year")),
        "it decorates the chat transcript datetime link with a formatted date"
      );
    });
  }
);
