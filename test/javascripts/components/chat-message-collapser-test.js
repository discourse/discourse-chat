import componentTest, {
  setupRenderingTest,
} from "discourse/tests/helpers/component-test";
import hbs from "htmlbars-inline-precompile";
import {
  discourseModule,
  exists,
  query,
} from "discourse/tests/helpers/qunit-helpers";

const youtubeCooked =
  "<p>written text</p>" +
  '<div class="onebox lazyYT-container" data-youtube-id="ytId1" data-youtube-title="Cats are great">Vid 1</div>' +
  "<p>more written text</p>" +
  '<div class="onebox lazyYT-container" data-youtube-id="ytId2" data-youtube-title="Kittens are great">Vid 2</div>' +
  "<p>and even more</p>";

const animatedImageCooked =
  "<p>written text</p>" +
  '<p><img src="lesource1" class="animated onebox"></img></p>' +
  "<p>more written text</p>" +
  '<p><img src="lesource2" class="animated onebox"></img></p>' +
  "<p>and even more</p>";

const externalImageCooked =
  "<p>written text</p>" +
  '<p><a href="http://cat1.com" class="onebox"><img src=""></img></a></p>' +
  "<p>more written text</p>" +
  '<p><a href="http://cat2.com" class="onebox"><img src=""></img></a></p>' +
  "<p>and even more</p>";

discourseModule(
  "Discourse Chat | Component | chat message collapser youtube",
  function (hooks) {
    setupRenderingTest(hooks);

    componentTest("shows youtube link in header", {
      template: hbs`{{chat-message-collapser cooked=cooked}}`,

      beforeEach() {
        this.set("cooked", youtubeCooked);
      },

      async test(assert) {
        const link = document.querySelectorAll(".chat-message-collapser-link");

        assert.equal(link.length, 2, "two youtube links rendered");
        assert.strictEqual(
          link[0].href,
          "https://www.youtube.com/watch?v=ytId1"
        );
        assert.strictEqual(
          link[1].href,
          "https://www.youtube.com/watch?v=ytId2"
        );
      },
    });

    componentTest("shows all user written text", {
      template: hbs`{{chat-message-collapser cooked=cooked}}`,

      beforeEach() {
        this.set("cooked", youtubeCooked);
      },

      async test(assert) {
        const text = document.querySelectorAll(".chat-message-collapser p");

        assert.equal(text.length, 3, "shows all written text");
        assert.strictEqual(
          text[0].innerText,
          "written text",
          "first line of written text"
        );
        assert.strictEqual(
          text[1].innerText,
          "more written text",
          "third line of written text"
        );
        assert.strictEqual(
          text[2].innerText,
          "and even more",
          "fifth line of written text"
        );
      },
    });

    componentTest("collapses and expands cooked youtube", {
      template: hbs`{{chat-message-collapser cooked=cooked}}`,

      beforeEach() {
        this.set("cooked", youtubeCooked);
      },

      async test(assert) {
        const youtubeDivs = document.querySelectorAll(".onebox");

        assert.equal(youtubeDivs.length, 2, "two youtube previews rendered");

        await click(
          document.querySelectorAll(".chat-message-collapser-opened")[0],
          "close first preview"
        );

        assert.notOk(
          exists(".onebox[data-youtube-id='ytId1']"),
          "first youtube preview hidden"
        );
        assert.ok(
          exists(".onebox[data-youtube-id='ytId2']"),
          "second youtube preview still visible"
        );

        await click(".chat-message-collapser-closed");

        assert.equal(youtubeDivs.length, 2, "two youtube previews rendered");

        await click(
          document.querySelectorAll(".chat-message-collapser-opened")[1],
          "close second preview"
        );

        assert.ok(
          exists(".onebox[data-youtube-id='ytId1']"),
          "first youtube preview still visible"
        );
        assert.notOk(
          exists(".onebox[data-youtube-id='ytId2']"),
          "second youtube preview hidden"
        );

        await click(".chat-message-collapser-closed");

        assert.equal(youtubeDivs.length, 2, "two youtube previews rendered");
      },
    });
  }
);

discourseModule(
  "Discourse Chat | Component | chat message collapser images",
  function (hooks) {
    setupRenderingTest(hooks);
    const imageCooked = "<p>A picture of Tomtom</p>";

    componentTest("shows filename for one image", {
      template: hbs`{{chat-message-collapser cooked=cooked uploads=uploads}}`,

      beforeEach() {
        this.set("cooked", imageCooked);
        this.set("uploads", [{ original_filename: "tomtom.jpeg" }]);
      },

      async test(assert) {
        assert.ok(
          query(".chat-message-collapser-header").innerText.includes(
            "tomtom.jpeg"
          )
        );
      },
    });

    componentTest("shows number of files for multiple images", {
      template: hbs`{{chat-message-collapser cooked=cooked uploads=uploads}}`,

      beforeEach() {
        this.set("cooked", imageCooked);
        this.set("uploads", [{}, {}]);
      },

      async test(assert) {
        assert.ok(
          query(".chat-message-collapser-header").innerText.includes("2 files")
        );
      },
    });

    componentTest("collapses and expands images", {
      template: hbs`{{chat-message-collapser cooked=cooked uploads=uploads}}`,

      beforeEach() {
        this.set("cooked", imageCooked);
        this.set("uploads", [{ extension: "png" }]);
      },

      async test(assert) {
        const uploads = ".chat-uploads";
        const chatImageUpload = ".chat-img-upload";

        assert.ok(exists(uploads));
        assert.ok(exists(chatImageUpload));

        await click(".chat-message-collapser-opened");

        assert.notOk(exists(uploads));
        assert.notOk(exists(chatImageUpload));

        await click(".chat-message-collapser-closed");

        assert.ok(exists(uploads));
        assert.ok(exists(chatImageUpload));
      },
    });
  }
);

discourseModule(
  "Discourse Chat | Component | chat message collapser animated image",
  function (hooks) {
    setupRenderingTest(hooks);

    componentTest("shows links for animated image", {
      template: hbs`{{chat-message-collapser cooked=cooked}}`,

      beforeEach() {
        this.set("cooked", animatedImageCooked);
      },

      async test(assert) {
        const links = document.querySelectorAll(
          "a.chat-message-collapser-link-small"
        );

        assert.ok(links[0].innerText.trim().includes("lesource1"));
        assert.ok(links[0].href.includes("lesource1"));

        assert.ok(links[1].innerText.trim().includes("lesource2"));
        assert.ok(links[1].href.includes("lesource2"));
      },
    });

    componentTest("shows all user written text", {
      template: hbs`{{chat-message-collapser cooked=cooked}}`,

      beforeEach() {
        this.set("cooked", animatedImageCooked);
      },

      async test(assert) {
        const text = document.querySelectorAll(".chat-message-collapser p");

        assert.equal(text.length, 5, "shows all written text");
        assert.strictEqual(text[0].innerText, "written text");
        assert.strictEqual(text[2].innerText, "more written text");
        assert.strictEqual(text[4].innerText, "and even more");
      },
    });

    componentTest("collapses and expands animated image onebox", {
      template: hbs`{{chat-message-collapser cooked=cooked}}`,

      beforeEach() {
        this.set("cooked", animatedImageCooked);
      },

      async test(assert) {
        const animatedOneboxes = document.querySelectorAll(".animated.onebox");

        assert.equal(animatedOneboxes.length, 2, "two oneboxes rendered");

        await click(
          document.querySelectorAll(".chat-message-collapser-opened")[0],
          "close first preview"
        );

        assert.notOk(exists(".onebox[src='lesource1']"), "first onebox hidden");
        assert.ok(
          exists(".onebox[src='lesource2']"),
          "second onebox still visible"
        );

        await click(".chat-message-collapser-closed");

        assert.equal(animatedOneboxes.length, 2, "two oneboxes rendered");

        await click(
          document.querySelectorAll(".chat-message-collapser-opened")[1],
          "close second preview"
        );

        assert.ok(
          exists(".onebox[src='lesource1']"),
          "first onebox still visible"
        );
        assert.notOk(
          exists(".onebox[src='lesource2']"),
          "second onebox hidden"
        );

        await click(".chat-message-collapser-closed");

        assert.equal(animatedOneboxes.length, 2, "two oneboxes rendered");
      },
    });
  }
);

discourseModule(
  "Discourse Chat | Component | chat message collapser external image onebox",
  function (hooks) {
    setupRenderingTest(hooks);

    componentTest("shows links for animated image", {
      template: hbs`{{chat-message-collapser cooked=cooked}}`,

      beforeEach() {
        this.set("cooked", externalImageCooked);
      },

      async test(assert) {
        const links = document.querySelectorAll(
          "a.chat-message-collapser-link-small"
        );

        assert.ok(links[0].innerText.trim().includes("http://cat1.com"));
        assert.ok(links[0].href.includes("http://cat1.com"));

        assert.ok(links[1].innerText.trim().includes("http://cat2.com"));
        assert.ok(links[1].href.includes("http://cat2.com"));
      },
    });

    componentTest("shows all user written text", {
      template: hbs`{{chat-message-collapser cooked=cooked}}`,

      beforeEach() {
        this.set("cooked", externalImageCooked);
      },

      async test(assert) {
        const text = document.querySelectorAll(".chat-message-collapser p");

        assert.equal(text.length, 5, "shows all written text");
        assert.strictEqual(text[0].innerText, "written text");
        assert.strictEqual(text[2].innerText, "more written text");
        assert.strictEqual(text[4].innerText, "and even more");
      },
    });

    componentTest("collapses and expands image oneboxes", {
      template: hbs`{{chat-message-collapser cooked=cooked}}`,

      beforeEach() {
        this.set("cooked", externalImageCooked);
      },

      async test(assert) {
        const imageOneboxes = document.querySelectorAll(".onebox");

        assert.equal(imageOneboxes.length, 2, "two oneboxes rendered");

        await click(
          document.querySelectorAll(".chat-message-collapser-opened")[0],
          "close first preview"
        );

        assert.notOk(
          exists(".onebox[href='http://cat1.com']"),
          "first onebox hidden"
        );
        assert.ok(
          exists(".onebox[href='http://cat2.com']"),
          "second onebox still visible"
        );

        await click(".chat-message-collapser-closed");

        assert.equal(imageOneboxes.length, 2, "two oneboxes rendered");

        await click(
          document.querySelectorAll(".chat-message-collapser-opened")[1],
          "close second preview"
        );

        assert.ok(
          exists(".onebox[href='http://cat1.com']"),
          "first onebox still visible"
        );
        assert.notOk(
          exists(".onebox[href='http://cat2.com']"),
          "second onebox hidden"
        );

        await click(".chat-message-collapser-closed");

        assert.equal(imageOneboxes.length, 2, "two oneboxes rendered");
      },
    });
  }
);
