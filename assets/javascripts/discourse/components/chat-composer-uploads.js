import Component from "@ember/component";
import { clipboardHelpers } from "discourse/lib/utilities";
import { run } from "@ember/runloop";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";
import UppyMediaOptimization from "discourse/lib/uppy-media-optimization-plugin";
import discourseComputed, { bind } from "discourse-common/utils/decorators";
import UppyUploadMixin from "discourse/mixins/uppy-upload";

export default Component.extend(UppyUploadMixin, {
  classNames: ["chat-composer-uploads"],
  mediaOptimizationWorker: service(),
  id: "chat-composer-uploader",
  type: "chat-composer",
  uploads: null,
  uploadCancelled: false,
  useMultipartUploadsIfAvailable: true,

  init() {
    this._super(...arguments);
    this.setProperties({
      uploads: [],
      fileInputSelector: `#${this.fileUploadElementId}`,
    });
    this.set("uploads", []);
    this.appEvents.on("chat:load-uploads", this, "_loadUploads");
  },

  didInsertElement() {
    this._super(...arguments);
    document
      .querySelector(".chat-composer-input")
      .addEventListener("paste", this._pasteEventListener);
  },

  willDestroyElement() {
    this._super(...arguments);
    this.appEvents.off("chat:load-uploads", this, "_loadUploads");
    document
      .querySelector(".chat-composer-input")
      .removeEventListener("paste", this._pasteEventListener);
  },

  uploadDone(upload) {
    this.uploads.pushObject(upload);
    this.onUploadChanged(this.uploads);
  },

  @discourseComputed("uploads.[]", "inProgressUploads.[]")
  showUploadsContainer(uploads, inProgressUploads) {
    return uploads?.length > 0 || inProgressUploads?.length > 0;
  },

  @action
  cancelUploading(upload) {
    this.appEvents.trigger(`upload-mixin:${this.id}:cancel-upload`, {
      fileId: upload.id,
    });
    this.uploads.removeObject(upload);
    this.onUploadChanged(this.uploads);
  },

  @action
  removeUpload(upload) {
    this.uploads.removeObject(upload);
    this.onUploadChanged(this.uploads);
  },

  _uploadDropTargetOptions() {
    const chatWidget = document.querySelector(
      ".topic-chat-container.expanded.visible"
    );
    const fullPageChat = document.querySelector(".full-page-chat");

    const targetEl =
      chatWidget || fullPageChat
        ? document.querySelector(".chat-enabled")
        : null;

    if (!targetEl) {
      return this._super();
    }

    return {
      target: targetEl,
    };
  },

  _loadUploads(uploads) {
    this._uppyInstance?.cancelAll();
    this.set("uploads", uploads);
  },

  _uppyReady() {
    if (this.siteSettings.composer_media_optimization_image_enabled) {
      this._useUploadPlugin(UppyMediaOptimization, {
        optimizeFn: (data, opts) =>
          this.mediaOptimizationWorker.optimizeImage(data, opts),
        runParallel: !this.site.isMobileDevice,
      });
    }

    this._onPreProcessProgress((file) => {
      const inProgressUpload = this.inProgressUploads.find(
        (upl) => upl.id === file.id
      );
      if (!inProgressUpload?.processing) {
        inProgressUpload?.set("processing", true);
      }
    });

    this._onPreProcessComplete((file) => {
      run(() => {
        const inProgressUpload = this.inProgressUploads.find(
          (upl) => upl.id === file.id
        );
        inProgressUpload?.set("processing", false);
      });
    });
  },

  @bind
  _pasteEventListener(event) {
    if (
      document.activeElement !== document.querySelector(".chat-composer-input")
    ) {
      return;
    }

    const { canUpload, canPasteHtml, types } = clipboardHelpers(event, {
      siteSettings: this.siteSettings,
      canUpload: true,
    });

    if (!canUpload || canPasteHtml || types.includes("text/plain")) {
      return;
    }

    if (event && event.clipboardData && event.clipboardData.files) {
      this._addFiles([...event.clipboardData.files], { pasted: true });
    }
  },
});
