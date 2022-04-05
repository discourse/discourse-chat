import Component from "@ember/component";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";
import UppyMediaOptimization from "discourse/lib/uppy-media-optimization-plugin";
import discourseComputed from "discourse-common/utils/decorators";
import UppyUploadMixin from "discourse/mixins/uppy-upload";

export default Component.extend(UppyUploadMixin, {
  classNames: ["chat-composer-uploads"],
  mediaOptimizationWorker: service(),
  id: "chat-composer-uploader",
  type: "chat-composer",
  uploads: null,
  uploadCancelled: false,

  init() {
    this._super(...arguments);
    this.set("uploads", []);
  },

  _uppyReady() {
    if (this.siteSettings.composer_media_optimization_image_enabled) {
      this._useUploadPlugin(UppyMediaOptimization, {
        optimizeFn: (data, opts) =>
          this.mediaOptimizationWorker.optimizeImage(data, opts),
        runParallel: !this.site.isMobileDevice,
      });
    }
  },

  uploadDone(upload) {
    this._insertUpload(null, upload);
  },

  _insertUpload(_, upload) {
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
});
