import Component from "@glimmer/component";

import { inject as service } from "@ember/service";
import { IMAGES_EXTENSIONS_REGEX } from "discourse/lib/uploads";
import { action } from "@ember/object";
import { tracked } from "@glimmer/tracking";
import { htmlSafe } from "@ember/template";

export default class extends Component {
  @service siteSettings;

  @tracked loaded = false;

  IMAGE_TYPE = "image";

  get type() {
    if (IMAGES_EXTENSIONS_REGEX.test(this.args.upload.extension)) {
      return this.IMAGE_TYPE;
    }
  }

  get size() {
    const width = this.args.upload.width;
    const height = this.args.upload.height;

    const ratio = Math.min(
      this.siteSettings.max_image_width / width,
      this.siteSettings.max_image_height / height
    );
    return { width: width * ratio, height: height * ratio };
  }

  get imageStyle() {
    if (this.args.upload.dominant_color && !this.loaded) {
      return htmlSafe(`background-color: #${this.args.upload.dominant_color};`);
    }
  }

  @action
  imageLoaded() {
    this.loaded = true;
  }
}
