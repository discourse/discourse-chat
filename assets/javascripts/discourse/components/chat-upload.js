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
});
