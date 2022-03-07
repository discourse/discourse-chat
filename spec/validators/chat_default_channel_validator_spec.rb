# frozen_string_literal: true

require 'rails_helper'

describe ChatDefaultChannelValidator do
  fab!(:public_channel) { Fabricate(:chat_channel) }

  it "returns true if public channel id" do
    validator = described_class.new
    expect(validator.valid_value?(public_channel.id)).to eq(true)
    expect(validator.error_message).to eq(I18n.t("site_settings.errors.chat_default_channel"))
  end

  it "returns true if 0" do
    validator = described_class.new
    expect(validator.valid_value?("")).to eq(true)
    expect(validator.error_message).to eq(I18n.t("site_settings.errors.chat_default_channel"))
  end

  it "returns false if not a public channel and not 0" do
    validator = described_class.new
    expect(validator.valid_value?(420)).to eq(false)
    expect(validator.error_message).to eq(I18n.t("site_settings.errors.chat_default_channel"))
  end
end
