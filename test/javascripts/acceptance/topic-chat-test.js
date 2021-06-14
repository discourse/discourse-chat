import {
  acceptance,
  exists,
  queryAll,
} from "discourse/tests/helpers/qunit-helpers";
import topicFixtures from "discourse/tests/fixtures/topic";

acceptance(
  "Discourse Topic Chat - Acceptance Test",
  function(needs) {
    needs.user();
    needs.settings({
      topic_chat_enabled: true,
    });

    needs.pretender((server, helper) => {
      // Deep clone, so we don't mess with other tests
      let topicResponse = JSON.parse(
        JSON.stringify(topicFixtures["/t/2480/1.json"])
      );
      topicResponse.has_chat_history = true;
      topicResponse.has_chat_live = true;
      let post = topicResponse.post_stream.posts[0];

      const users = {};
      users[4] = {
        id: 4,
        username: post.username,
        name: post.name,
        avatar_template: post.avatar_template,
      };
      const usersArray = [ users[4] ];

      const chat_history = [
        {
          id: 1500,
          message: "Chat message under the first post",
          action_code: null,
          post_id: post.id,
          created_at: post.created_at,
          user: users[4],
        },
        {
          id: 1501,
          message: "This is a reply",
          action_code: null,
          in_reply_to_id: 1500,
          post_id: post.id,
          created_at: post.created_at,
          user: users[4],
        },
      ];
      post.chat_history = chat_history;

      server.get("/t/2480.json", () => helper.response(topicResponse));

      const recentResponse = {
        users: usersArray,
        topic_chat_view: {
          last_id: 9999, // Message bus
          can_chat: true,
          can_flag: true,
          can_delete_self: true,
          can_delete_others: false,
          messages: chat_history.map(msg => {
            let cloned = JSON.parse(JSON.stringify(msg));
            cloned.user_id = cloned.user.id;
            delete cloned["user"];
            return cloned;
          }),
        },
      };

      server.get("/chat/t/2480/recent", () => helper.response(recentResponse));
    });

    test("Chat history can display properly", async function(assert) {
      await visit("/t/topic-for-group-moderators/2480");

      const articles = queryAll(".topic-post article");
      const firstArticle = articles[0];

      const showChatButton = firstArticle.querySelector("nav.post-controls .show-chat");

      await click(showChatButton);

      const anyMessage = firstArticle.querySelector(".tc-history .tc-message");
      assert.ok(exists(anyMessage));

      const replyIndicator = firstArticle.querySelector(".tc-history .tc-reply-av");
      assert.ok(exists(replyIndicator));
    });
  }
);
