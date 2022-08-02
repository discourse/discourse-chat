# frozen_string_literal: true

require "rails_helper"

describe ChatAllowUploadsValidator do
  it "always returns true if setting the value to false" do
    validator = described_class.new
    expect(validator.valid_value?("f")).to eq(true)
  end

  context "when secure media is enabled" do
    before do
      SiteSetting.chat_allow_uploads = false
      enable_secure_media
    end

    it "does not allow chat uploads to be enabled" do
      validator = described_class.new
      expect(validator.valid_value?("t")).to eq(false)
      expect(validator.error_message).to eq(
        I18n.t("site_settings.errors.chat_upload_not_allowed_secure_media"),
      )
    end

    it "does allow chat uploads to be enabled if DISCOURSE_ALLOW_UNSECURE_CHAT_UPLOADS is set" do
      ENV["DISCOURSE_ALLOW_UNSECURE_CHAT_UPLOADS"] = "t"
      validator = described_class.new
      expect(validator.valid_value?("t")).to eq(true)
      expect(validator.error_message).to eq(nil)
    end
  end
end
