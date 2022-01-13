import Component from "@ember/component";
import { action } from "@ember/object";
import discourseComputed from "discourse-common/utils/decorators";
import { IMAGES_EXTENSIONS_REGEX } from "discourse/lib/uploads";

export default Component.extend({
  IMAGE_TYPE: "image",

  tagName: "",
  isDone: false,
  upload: null,
  onCancel: null,

  @action
  handleOnCancel(upload) {
    this.onCancel?.(upload);
  },

  @discourseComputed("isDone", "upload.{original_filename,filename}")
  fileName(isDone, upload) {
    return isDone ? upload.original_filename : upload.filename;
  },

  @discourseComputed("upload.extension")
  type(extension) {
    if (IMAGES_EXTENSIONS_REGEX.test(extension)) {
      return this.IMAGE_TYPE;
    }
  },
});
