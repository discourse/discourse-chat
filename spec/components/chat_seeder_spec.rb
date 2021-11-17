# frozen_string_literal: true

require 'rails_helper'

describe ChatSeeder do
  fab!(:category) { Fabricate(:category) }

  before do
    SiteSetting.staff_category_id = category.id
  end
  it "creates a chat channel for staff category" do
    expect {
      ChatSeeder.new.execute
    }.to change {
      ChatChannel.where(chatable: category).count
    }.by(1)

    expect(category.custom_fields[DiscourseChat::HAS_CHAT_ENABLED]).to eq(true)
    expect(SiteSetting.needs_chat_seeded).to eq(false)
  end

  it "does nothing when 'SiteSetting.needs_chat_seeded' is false" do
    SiteSetting.needs_chat_seeded = false;
    expect {
      ChatSeeder.new.execute
    }.to change {
      ChatChannel.where(chatable: category).count
    }.by(0)
  end
end
