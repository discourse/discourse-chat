import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import { IMAGES_EXTENSIONS_REGEX } from "discourse/lib/uploads";

export default Component.extend({
  IMAGE_TYPE: "image",

  @discourseComputed("upload.extension")
  type(extension) {
    if (IMAGES_EXTENSIONS_REGEX.test(extension)) {
      return this.IMAGE_TYPE;
    }
  },

  @discourseComputed("upload.width", "upload.height")
  size(width, height) {
    var ratio = Math.min(
      this.siteSettings.max_image_width / width,
      this.siteSettings.max_image_height / height
    );
    return { width: width * ratio, height: height * ratio };
  },
});
