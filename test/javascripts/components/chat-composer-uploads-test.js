import componentTest, {
  setupRenderingTest,
} from "discourse/tests/helpers/component-test";
import {
  discourseModule,
  exists,
  queryAll,
} from "discourse/tests/helpers/qunit-helpers";
import hbs from "htmlbars-inline-precompile";

const fakeUpload = {
  type: ".png",
  filename: "foo",
  original_filename: "bar",
  extension: "png",
  short_path: "/my-image.png",
};

discourseModule(
  "Discourse Chat | Component | chat-composer-uploads",
  function (hooks) {
    setupRenderingTest(hooks);

    componentTest("no upload", {
      template: hbs`{{chat-composer-uploads uploads=uploads}}`,

      beforeEach() {
        this.set("uploads", []);
      },

      async test(assert) {
        assert.notOk(exists(".chat-composer-upload"));
        assert.ok(exists("#chat-widget-uploader[type=file]"));
      },
    });

    componentTest("finished upload", {
      template: hbs`{{chat-composer-uploads uploads=uploads}}`,

      beforeEach() {
        this.set("uploads", [fakeUpload]);
      },

      async test(assert) {
        assert.strictEqual(queryAll(".chat-composer-upload").length, 1);
      },
    });

    componentTest("on new upload", {
      template: hbs`{{chat-composer-uploads onUploadsChanged=onUploadsChanged uploads=uploads}}`,

      beforeEach() {
        this.set("onUploadsChanged", (uploads) => {
          this.set("uploads", uploads);
        });
      },

      async test(assert) {
        this.appEvents = this.container.lookup("service:appEvents");
        this.appEvents.trigger(
          "chat-composer-uploads:upload-success",
          this,
          fakeUpload
        );

        assert.strictEqual(queryAll(".chat-composer-upload").length, 1);
      },
    });

    componentTest("on removed upload", {
      template: hbs`{{chat-composer-uploads onUploadsChanged=onUploadsChanged uploads=uploads}}`,

      beforeEach() {
        this.set("onUploadsChanged", (uploads) => {
          this.set("uploads", uploads);
        });
      },

      async test(assert) {
        this.appEvents = this.container.lookup("service:appEvents");
        this.appEvents.trigger(
          "chat-composer-uploads:upload-success",
          this,
          fakeUpload
        );

        assert.strictEqual(queryAll(".chat-composer-upload").length, 1);

        await click(".remove-upload");

        assert.strictEqual(queryAll(".chat-composer-upload").length, 0);
      },
    });
  }
);
