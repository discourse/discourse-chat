import componentTest, {
  setupRenderingTest,
} from "discourse/tests/helpers/component-test";
import pretender from "discourse/tests/helpers/create-pretender";
import {
  createFile,
  discourseModule,
  exists,
  queryAll,
} from "discourse/tests/helpers/qunit-helpers";
import hbs from "htmlbars-inline-precompile";
import { click, settled } from "@ember/test-helpers";

const fakeUpload = {
  type: ".png",
  extension: "png",
  name: "myfile.png",
  short_path: "/images/avatar.png",
};

const mockUploadResponse = {
  extension: "jpeg",
  filesize: 126177,
  height: 800,
  human_filesize: "123 KB",
  id: 202,
  original_filename: "avatar.PNG.jpg",
  retain_hours: null,
  short_path: "/images/avatar.png",
  short_url: "upload://yoj8pf9DdIeHRRULyw7i57GAYdz.jpeg",
  thumbnail_height: 320,
  thumbnail_width: 690,
  url: "/images/avatar.png",
  width: 1920,
};

function setupUploadPretender() {
  pretender.post(
    "/uploads.json",
    () => {
      return [200, { "Content-Type": "application/json" }, mockUploadResponse];
    },
    500 // this delay is important to slow down the uploads a bit so we can click elements in the UI like the cancel button
  );
}

discourseModule(
  "Discourse Chat | Component | chat-composer-uploads",
  function (hooks) {
    setupRenderingTest(hooks);

    componentTest(
      "loading uploads from an outside source (e.g. draft or editing message)",
      {
        template: hbs`{{chat-composer-uploads fileUploadElementId="chat-widget-uploader"}}`,

        async test(assert) {
          this.appEvents = this.container.lookup("service:appEvents");
          this.appEvents.trigger("chat-composer:load-uploads", [fakeUpload]);
          await settled();
          assert.strictEqual(queryAll(".chat-composer-upload").length, 1);
          assert.strictEqual(exists(".chat-composer-upload"), true);
        },
      }
    );

    componentTest("upload starts and completes", {
      template: hbs`{{chat-composer-uploads fileUploadElementId="chat-widget-uploader" onUploadChanged=onUploadChanged}}`,

      beforeEach() {
        setupUploadPretender();
        this.set("changedUploads", null);
        this.set("onUploadChanged", (uploads) => {
          this.set("changedUploads", uploads);
        });
      },

      async test(assert) {
        const image = createFile("avatar.png");
        const done = assert.async();
        this.appEvents = this.container.lookup("service:appEvents");
        this.appEvents.trigger(
          "upload-mixin:chat-composer-uploader:add-files",
          image
        );

        await settled();

        this.appEvents.on(
          "upload-mixin:chat-composer-uploader:upload-success",
          (fileName, upload) => {
            assert.strictEqual(fileName, "avatar.png");
            assert.deepEqual(upload, mockUploadResponse);
            done();
          }
        );

        await settled();

        assert.strictEqual(queryAll(".chat-composer-upload").length, 1);
      },
    });

    componentTest("removing a completed upload", {
      template: hbs`{{chat-composer-uploads fileUploadElementId="chat-widget-uploader" onUploadChanged=onUploadChanged}}`,

      beforeEach() {
        this.set("changedUploads", null);
        this.set("onUploadChanged", (uploads) => {
          this.set("changedUploads", uploads);
        });
      },

      async test(assert) {
        this.appEvents = this.container.lookup("service:appEvents");
        this.appEvents.trigger("chat-composer:load-uploads", [fakeUpload]);
        await settled();
        assert.strictEqual(queryAll(".chat-composer-upload").length, 1);
        await click(".remove-upload");
        assert.strictEqual(queryAll(".chat-composer-upload").length, 0);
      },
    });

    componentTest("cancelling in progress upload", {
      template: hbs`{{chat-composer-uploads fileUploadElementId="chat-widget-uploader" onUploadChanged=onUploadChanged}}`,

      beforeEach() {
        setupUploadPretender();

        this.set("changedUploads", null);
        this.set("onUploadChanged", (uploads) => {
          this.set("changedUploads", uploads);
        });
      },

      async test(assert) {
        const image = createFile("avatar.png");
        const done = assert.async();
        this.appEvents = this.container.lookup("service:appEvents");
        this.appEvents.trigger(
          "upload-mixin:chat-composer-uploader:add-files",
          image
        );

        await settled();

        this.appEvents.on(
          `upload-mixin:chat-composer-uploader:upload-cancelled`,
          (fileId) => {
            assert.strictEqual(
              fileId.includes("uppy-avatar/"),
              true,
              "upload was cancelled"
            );
            done();
          }
        );

        await settled();

        assert.strictEqual(queryAll(".chat-composer-upload").length, 1);

        await click(".remove-upload");
        await settled();

        assert.strictEqual(queryAll(".chat-composer-upload").length, 0);
      },
    });
  }
);
