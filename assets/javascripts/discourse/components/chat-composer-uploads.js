import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import UppyMediaOptimization from "discourse/lib/uppy-media-optimization-plugin";
import ComposerUploadUppy from "discourse/mixins/composer-upload-uppy";
import {
  authorizedExtensions,
  authorizesAllExtensions,
} from "discourse/lib/uploads";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";

export default Component.extend(ComposerUploadUppy, {
  classNames: ["chat-composer-uploads"],

  // represents the component state of uploads
  _uploads: null,
  inProgressUploads: null,
  uploads: null,
  uploadProcessorActions: null,
  uploadPreProcessors: null,
  uploadMarkdownResolvers: null,
  uploadType: "chat-composer",
  uppyId: "chat-composer-uppy",
  fullPage: false,
  composerModelContentKey: "value",
  composerModel: null,
  editorInputClass: ".chat-composer-input",
  mediaOptimizationWorker: service(),
  eventPrefix: "chat-composer-uploads",
  onUploadsChanged: null,

  init() {
    this._super(...arguments);

    this.set("uploadProcessorActions", {});
    this.set("uploadPreProcessors", []);
    this.set("uploadMarkdownResolvers", []);
    this.set("_uploads", []);

    // we fake our own composer model
    this.set("composerModel", { value: "" });

    if (this.siteSettings.composer_media_optimization_image_enabled) {
      // TODO:
      // This whole deal really is not ideal, maybe we need some sort
      // of ComposerLike mixin that handles adding these processors? But
      // then again maybe not, because we may not want all processors
      // for chat...
      this.uploadPreProcessors.push({
        pluginClass: UppyMediaOptimization,
        optionsResolverFn: ({ isMobileDevice }) => {
          return {
            optimizeFn: (data, opts) =>
              this.mediaOptimizationWorker.optimizeImage(data, opts),
            runParallel: !isMobileDevice,
          };
        },
      });
    }
  },

  didInsertElement() {
    this._super(...arguments);

    this._bindUploadTarget();

    this.set(
      "fullPage",
      document.body.classList.contains("has-full-page-chat")
    );

    this.appEvents.on(
      `${this.eventPrefix}:upload-success`,
      this,
      "_insertUpload"
    );
  },

  didReceiveAttrs() {
    this._super(...arguments);

    this.set("_uploads", this.uploads || []);
  },

  willDestroyElement() {
    this._super(...arguments);

    this.set("uploadPreProcessors", null);
    this.set("uploadProcessorActions", null);
    this.set("uploadMarkdownResolvers", null);

    this.appEvents.off(
      `${this.eventPrefix}:upload-success`,
      this,
      "_insertUpload"
    );
  },

  handleUploadState() {
    this.onUploadsChanged?.(this._uploads, {
      inProgressUploads: this.inProgressUploads,
      isProcessingUpload: this.isProcessingUpload,
    });
  },

  @discourseComputed("_uploads.[]", "inProgressUploads.[]")
  showUploadsContainer() {
    return this._uploads?.length > 0 || this.inProgressUploads?.length > 0;
  },

  @discourseComputed("fullPage")
  fileUploadElementId(fullPage) {
    return fullPage ? "chat-full-page-uploader" : "chat-widget-uploader";
  },

  @discourseComputed("fullPage")
  mobileFileUploaderId(fullPage) {
    return fullPage
      ? "chat-full-page-mobile-uploader"
      : "chat-widget-mobile-uploader";
  },

  @discourseComputed()
  acceptedFormats() {
    const extensions = authorizedExtensions(
      this.currentUser.staff,
      this.siteSettings
    );

    return extensions.map((ext) => `.${ext}`).join();
  },
  @discourseComputed()
  acceptsAllFormats() {
    return authorizesAllExtensions(this.currentUser.staff, this.siteSettings);
  },

  @action
  cancelUploading(upload) {
    this.appEvents.trigger(`${this.eventPrefix}:cancel-upload`, {
      fileId: upload.id,
    });
    this.handleUploadState();
  },

  @action
  removeUpload(upload) {
    this._uploads.removeObject(upload);
    this.handleUploadState();
  },

  _insertUpload(_, upload) {
    this._uploads.pushObject(upload);
    this.handleUploadState();
  },

  _findMatchingUploadHandler() {
    return;
  },

  _uploadDropTargetOptions() {
    const target = document.querySelector(".chat-live-pane");
    if (!target) {
      return this._super();
    }

    return { target };
  },

  _cursorIsOnEmptyLine() {
    return true;
  },
});
