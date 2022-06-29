# frozen_string_literal: true

RSpec::Matchers.define :match_response_schema do |schema|
  match do |response|
    schema_directory = "#{Dir.pwd}/plugins/discourse-chat/spec/support/api/schemas"
    schema_path = "#{schema_directory}/#{schema}.json"

    begin
      JSON::Validator.validate!(schema_path, response.parsed_body, strict: true)
    rescue JSON::Schema::ValidationError => e
      puts "-- Printing response body after validation error\n"
      pp response.parsed_body
      raise e
    end
  end
end
