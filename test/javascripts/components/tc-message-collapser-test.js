import componentTest, {
  setupRenderingTest,
} from "discourse/tests/helpers/component-test";
import hbs from "htmlbars-inline-precompile";
import {
  discourseModule,
  exists,
  query,
} from "discourse/tests/helpers/qunit-helpers";

discourseModule(
  "Discourse Chat | Component | tc message collapser",
  function (hooks) {
    setupRenderingTest(hooks);
    const youtubeCooked =
      '<div class="onebox lazyYT lazyYT-container" data-youtube-id="WaT_rLGuUr8" data-youtube-title="Japanese Katsu Curry (Pork Cutlet)"/>';
    const imageCooked = "<p>A picture of Tomtom</p>";

    // youtube
    componentTest("shows youtube link in header", {
      template: hbs`{{tc-message-collapser cooked=cooked}}`,

      beforeEach() {
        this.set("cooked", youtubeCooked);
      },

      async test(assert) {
        const link = query(".tc-message-collapsible-link");

        assert.ok(link);
        assert.strictEqual(
          link.href,
          "https://www.youtube.com/watch?v=WaT_rLGuUr8"
        );
      },
    });

    componentTest("does not show filename since it's not an image", {
      template: hbs`{{tc-message-collapser cooked=cooked}}`,

      beforeEach() {
        this.set("cooked", youtubeCooked);
      },

      async test(assert) {
        assert.notOk(exists(".tc-message-collapsible-filename"));
      },
    });

    componentTest("collapses and expands cooked youtube", {
      template: hbs`{{tc-message-collapser cooked=cooked}}`,

      beforeEach() {
        this.set("cooked", youtubeCooked);
      },

      async test(assert) {
        const youtubeDivSelector = ".onebox.lazyYT";

        assert.ok(exists(youtubeDivSelector));

        await click(".tc-message-collapsible-open");

        assert.notOk(exists(youtubeDivSelector));

        await click(".tc-message-collapsible-close");

        assert.ok(exists(youtubeDivSelector));
      },
    });

    // images
    componentTest("shows filename for one image", {
      template: hbs`{{tc-message-collapser cooked=cooked uploads=uploads}}`,

      beforeEach() {
        this.set("cooked", imageCooked);
        this.set("uploads", [{ original_filename: "tomtom.jpeg" }]);
      },

      async test(assert) {
        assert.strictEqual(
          query(".tc-message-collapsible-filename").innerText.trim(),
          "tomtom.jpeg"
        );
      },
    });

    componentTest("shows number of files for multiple images", {
      template: hbs`{{tc-message-collapser cooked=cooked uploads=uploads}}`,

      beforeEach() {
        this.set("cooked", imageCooked);
        this.set("uploads", [{}, {}]);
      },

      async test(assert) {
        assert.strictEqual(
          query(".tc-message-collapsible-filename").innerText.trim(),
          "2 files"
        );
      },
    });

    componentTest("does not show link in header since it's not youtube", {
      template: hbs`{{tc-message-collapser cooked=cooked uploads=uploads}}`,

      beforeEach() {
        this.set("cooked", imageCooked);
        this.set("uploads", [{}, {}]);
      },

      async test(assert) {
        assert.notOk(exists(".tc-message-collapsible-link"));
      },
    });

    componentTest("collapses and expands images", {
      template: hbs`{{tc-message-collapser cooked=cooked uploads=uploads}}`,

      beforeEach() {
        this.set("cooked", imageCooked);
        this.set("uploads", [{ extension: "png" }]);
      },

      async test(assert) {
        const uploads = ".tc-uploads";
        const chatImageUpload = ".chat-img-upload";

        assert.ok(exists(uploads));
        assert.ok(exists(chatImageUpload));

        await click(".tc-message-collapsible-open");

        assert.notOk(exists(uploads));
        assert.notOk(exists(chatImageUpload));

        await click(".tc-message-collapsible-close");

        assert.ok(exists(uploads));
        assert.ok(exists(chatImageUpload));
      },
    });
  }
);
