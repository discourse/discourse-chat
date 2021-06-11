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
      let topicResponse = JSON.parse(
        JSON.stringify(topicFixtures["/t/2480/1.json"])
      );
      let post = topicResponse.post_stream.posts[0];
      post.chat_history = [
        {
          id: 1500,
          message: "Chat message under the first post",
          action_code: null,
          post_id: post.id,
          created_at: post.created_at,
          user: {
            id: 4,
            username: post.username,
            name: post.name,
            avatar_template: post.avatar_template,
          },
        },
      ];
    });

    test("Chat history can display properly", async function(assert) {
      await visit("/t/topic-for-group-moderators/2480");

      const articles = queryAll(".topic-post article");
      const firstArticle = articles[0];

      const showChatButton = firstArticle.querySelector("nav.post-controls");

      syntax error;

    });
  }
);
