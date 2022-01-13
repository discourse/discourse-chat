import componentTest, {
  setupRenderingTest,
} from "discourse/tests/helpers/component-test";
import {
  discourseModule,
  exists,
  query,
} from "discourse/tests/helpers/qunit-helpers";
import hbs from "htmlbars-inline-precompile";
import I18n from "I18n";

discourseModule(
  "Discourse Chat | Component | chat-composer-upload",
  function (hooks) {
    setupRenderingTest(hooks);

    componentTest("file - uploading", {
      template: hbs`{{chat-composer-upload upload=upload}}`,

      beforeEach() {
        this.set("upload", { progress: 50, type: ".pdf", done: false });
      },

      async test(assert) {
        assert.ok(exists(".upload-progress[value=50]"));
        assert.strictEqual(
          query(".uploading").innerText.trim(),
          I18n.t("uploading")
        );
      },
    });

    componentTest("image - uploading", {
      template: hbs`{{chat-composer-upload isDone=false upload=upload}}`,

      beforeEach() {
        this.set("upload", {
          extension: "png",
          progress: 50,
        });
      },

      async test(assert) {
        assert.ok(exists(".d-icon-far-image"));
        assert.ok(exists(".upload-progress[value=50]"));
        assert.strictEqual(
          query(".uploading").innerText.trim(),
          I18n.t("uploading")
        );
      },
    });

    componentTest("file - uploaded", {
      template: hbs`{{chat-composer-upload isDone=true upload=upload}}`,

      beforeEach() {
        this.set("upload", {
          type: ".pdf",
          filename: "foo",
          original_filename: "bar",
          extension: "pdf",
        });
      },

      async test(assert) {
        assert.ok(exists(".d-icon-file-alt"));
        assert.strictEqual(query(".file-name").innerText.trim(), "bar");
        assert.strictEqual(query(".extension-pill").innerText.trim(), "pdf");
      },
    });

    componentTest("image - uploaded", {
      template: hbs`{{chat-composer-upload isDone=true upload=upload}}`,

      beforeEach() {
        this.set("upload", {
          type: ".png",
          filename: "foo",
          original_filename: "bar",
          extension: "png",
          short_path: "/my-image.png",
        });
      },

      async test(assert) {
        assert.ok(exists("img.preview-img[src='/my-image.png']"));
        assert.strictEqual(query(".file-name").innerText.trim(), "bar");
        assert.strictEqual(query(".extension-pill").innerText.trim(), "png");
      },
    });

    componentTest("onCancel action", {
      template: hbs`{{chat-composer-upload isDone=true upload=upload onCancel=onCancel}}`,

      beforeEach() {
        this.set("name", null);
        this.set("onCancel", (upload) => {
          this.set("name", upload.filename);
        });
        this.set("upload", {
          type: ".png",
          filename: "foo",
          original_filename: "bar",
          extension: "png",
          short_path: "/my-image.png",
        });
      },

      async test(assert) {
        await click(".remove-upload");

        assert.strictEqual(this.name, this.upload.filename);
      },
    });
  }
);
