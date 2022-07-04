import { click, visit } from "@ember/test-helpers";
import {
  acceptance,
  exists,
  visible,
} from "discourse/tests/helpers/qunit-helpers";
import { test } from "qunit";

acceptance("Discourse Chat - Chat live pane collapse", function (needs) {
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
        meta: {
          can_chat: true,
          user_silenced: false,
        },
        chat_messages: [
          {
            id: 1,
            message: "https://www.youtube.com/watch?v=aOWkVdU4NH0",
            cooked:
              '<div class="onebox lazyYT lazyYT-container" data-youtube-id="aOWkVdU4NH0" data-youtube-title="Picnic with my cat (shaved ice &amp; lemonade)" data-parameters="feature=oembed&amp;wmode=opaque"> <a href="https:/*www.youtube.com/watch?v=aOWkVdU4NH0" target="_blank" rel="nofollow ugc noopener">*/ <img class="ytp-thumbnail-image" src="https://img.youtube.com/vi/aOWkVdU4NH0/hqdefault.jpg" title="Picnic with my cat (shaved ice &amp; lemonade)"></a></div>',
            excerpt:
              '<a href="https://www.youtube.com/watch?v=aOWkVdU4NH0">[Picnic with my cat (shaved ice &amp; lemonade&hellip;</a>',
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
          {
            id: 2,
            message: "",
            cooked: "",
            excerpt: "",
            uploads: [
              {
                id: 4,
                url: "/images/avatar.png",
                original_filename: "tomtom.jpeg",
                filesize: 93815,
                width: 480,
                height: 640,
                thumbnail_width: 375,
                thumbnail_height: 500,
                extension: "jpeg",
                retain_hours: null,
                human_filesize: "91.6 KB",
              },
            ],
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
      helper.response({ chat_channel: { id: 1, title: "something" } })
    );

    server.post("/uploads/lookup-urls", () =>
      helper.response([
        200,
        { "Content-Type": "application/json" },
        [
          {
            url: "/images/avatar.png",
          },
        ],
      ])
    );
  });

  test("can collapse and expand youtube chat", async function (assert) {
    const youtubeContainer = ".chat-message-container[data-id='1'] .lazyYT";
    const expandImage =
      ".chat-message-container[data-id='1'] .chat-message-collapser-closed";
    const collapseImage =
      ".chat-message-container[data-id='1'] .chat-message-collapser-opened";

    await visit("/chat/channel/1/cat");

    assert.ok(visible(youtubeContainer));
    assert.ok(visible(collapseImage), "the open arrow is shown");
    assert.notOk(exists(expandImage), "the close arrow is hidden");

    await click(collapseImage);

    assert.notOk(visible(youtubeContainer));
    assert.ok(visible(expandImage), "the close arrow is shown");
    assert.notOk(exists(collapseImage), "the open arrow is hidden");

    await click(expandImage);

    assert.ok(visible(youtubeContainer));
    assert.ok(visible(collapseImage), "the open arrow is shown again");
    assert.notOk(exists(expandImage), "the close arrow is hidden again");
  });

  test("lightbox shows up before and after expand and collapse", async function (assert) {
    const lightboxImage = ".mfp-img";
    const image = ".chat-message-container[data-id='2'] .chat-img-upload";
    const expandImage =
      ".chat-message-container[data-id='2'] .chat-message-collapser-closed";
    const collapseImage =
      ".chat-message-container[data-id='2'] .chat-message-collapser-opened";

    await visit("/chat/channel/1/cat");

    await click(image);

    assert.ok(
      exists(document.querySelector(lightboxImage)),
      "can see lightbox"
    );
    await click(document.querySelector(".mfp-container"));

    await click(collapseImage);
    await click(expandImage);

    await click(image);
    assert.ok(
      exists(document.querySelector(lightboxImage)),
      "can see lightbox after collapse expand"
    );
    await click(document.querySelector(".mfp-container"));
  });
});
