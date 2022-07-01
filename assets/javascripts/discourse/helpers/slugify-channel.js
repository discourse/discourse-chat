import { slugify } from "discourse/lib/utilities";
import Helper from "@ember/component/helper";

export default class SlugifyChannel extends Helper {
  compute(inputs) {
    return slugify(inputs[0]).slice(0, 100);
  }
}
