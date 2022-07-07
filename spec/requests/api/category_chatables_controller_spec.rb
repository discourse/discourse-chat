# frozen_string_literal: true

require 'rails_helper'

describe DiscourseChat::Api::CategoryChatablesController do
  describe '#access_by_category' do
    fab!(:group) { Fabricate(:group) }
    fab!(:private_category) { Fabricate(:private_category, group: group) }

    context 'signed in as an admin' do
      fab!(:admin) { Fabricate(:admin) }

      before { sign_in(admin) }

      it 'returns a list with the group names that could access a chat channel' do
        get "/chat/api/category-chatables/#{private_category.id}/permissions.json"

        expect(response.parsed_body).to contain_exactly("@#{group.name}")
      end

      it "doesn't return group names from other categories" do
        group_2 = Fabricate(:group)
        category_2 = Fabricate(:private_category, group: group_2)

        get "/chat/api/category-chatables/#{category_2.id}/permissions.json"

        expect(response.parsed_body).to contain_exactly("@#{group_2.name}")
      end

      it "returns an empty list when the category doesn't have group permissions" do
        category_2 = Fabricate(:category)

        get "/chat/api/category-chatables/#{category_2.id}/permissions.json"

        expect(response.parsed_body).to be_empty
      end
    end

    context 'as anon' do
      it 'returns a 404' do
        get "/chat/api/category-chatables/#{private_category.id}/permissions.json"

        expect(response.status).to eq(404)
      end
    end

    context 'signed in as a regular user' do
      fab!(:user) { Fabricate(:user) }

      before { sign_in(user) }

      it 'returns a 404' do
        get "/chat/api/category-chatables/#{private_category.id}/permissions.json"

        expect(response.status).to eq(404)
      end
    end
  end
end
