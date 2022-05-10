import RestModel from "discourse/models/rest";
import Bookmark from "discourse/models/bookmark";
export default RestModel.extend({
  get bookmarkModel() {
    if (this._bookmark) {
      return this._bookmark;
    }
    if (this.bookmark) {
      this.bookmarkModel = this.bookmark;
    } else {
      this.bookmarkModel = {
        bookmarkable_type: "ChatMessage",
        bookmarkable_id: this.id,
      };
    }
    return this._bookmark;
  },

  set bookmarkModel(bookmark) {
    this._bookmark = Bookmark.create(bookmark);
  },
});
