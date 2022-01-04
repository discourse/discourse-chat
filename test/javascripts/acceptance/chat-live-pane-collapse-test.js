import { visit } from "@ember/test-helpers";
import {
  acceptance,
  exists,
  visible,
} from "discourse/tests/helpers/qunit-helpers";
import { test } from "qunit";

acceptance("Discourse Chat - Chat live pane", function (needs) {
  needs.user({
    username: "eviltrout",
    id: 1,
    can_chat: true,
    has_chat_enabled: true,
  });
  needs.settings({
    chat_enabled: true,
  });
  needs.pretender((server, helper) => {
    server.get("/chat/:chatChannelId/messages.json", () =>
      helper.response({
        chat_messages: [
          {
            id: 1,
            message: "https://www.youtube.com/watch?v=aOWkVdU4NH0",
            cooked:
              '<div class="onebox lazyYT lazyYT-container" data-youtube-id="aOWkVdU4NH0" data-youtube-title="Picnic with my cat (shaved ice &amp; lemonade)" data-parameters="feature=oembed&amp;wmode=opaque"> <a href="https:/*www.youtube.com/watch?v=aOWkVdU4NH0" target="_blank" rel="nofollow ugc noopener">*/ <img class="ytp-thumbnail-image" src="https://img.youtube.com/vi/aOWkVdU4NH0/hqdefault.jpg" title="Picnic with my cat (shaved ice &amp; lemonade)"></a></div>',
            excerpt:
              '<a href="https://www.youtube.com/watch?v=aOWkVdU4NH0">[Picnic with my cat (shaved ice &amp; lemonade&hellip;</a>',
            action_code: null,
            created_at: "2021-07-20T08:14:16.950Z",
            flag_count: 0,
            user: {
              avatar_template:
                "/letter_avatar_proxy/v4/letter/t/a9a28c/{size}.png",
              id: 1,
              name: "Tomtom",
              username: "tomtom",
            },
          },
        ],
      })
    );

    server.get("/chat/chat_channels.json", () =>
      helper.response({
        public_channels: [],
        direct_message_channels: [],
      })
    );

    server.get("/chat/chat_channels/:chatChannelId", () =>
      helper.response({ chat_channel: { id: 1 } })
    );
  });

  test("can collapse and expand youtube chat", async function (assert) {
    const youtubeContainerSelector = ".lazyYT";
    const close = ".tc-message-collapsible-close";
    const open = ".tc-message-collapsible-open";

    await visit("/chat/channel/1/cat");

    assert.ok(visible(youtubeContainerSelector));
    assert.ok(visible(open), "the open arrow is shown");
    assert.notOk(exists(close), "the close arrow is hidden");

    await click(open);

    assert.notOk(exists(youtubeContainerSelector));
    assert.ok(visible(close), "the close arrow is shown");
    assert.notOk(exists(open), "the open arrow is hidden");

    await click(close);

    assert.ok(visible(youtubeContainerSelector));
    assert.ok(visible(open), "the open arrow is shown again");
    assert.notOk(exists(close), "the close arrow is hidden again");
  });
});
