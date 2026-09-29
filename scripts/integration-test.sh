#!/usr/bin/env bash
set -e

PASS_COUNT=0
FAIL_COUNT=0

PASS() {
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "PASS: $1"
}

FAIL() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo "FAIL: $1"
}

wait_for_url() {
  local name="$1"
  local url="$2"
  local expected_text="$3"
  local attempts=30

  for i in $(seq 1 "$attempts"); do
    response="$(curl -fsS "$url" 2>/dev/null || true)"
    if [[ -n "$response" && "$response" == *"$expected_text"* ]]; then
      PASS "$name is ready"
      return 0
    fi
    sleep 2
  done

  FAIL "$name did not become ready"
  return 1
}

status_code() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  local auth_header="${4:-}"

  if [[ -n "$body" && -n "$auth_header" ]]; then
    curl -s -o /tmp/jaakd-response.json -w "%{http_code}" -X "$method" "$url" \
      -H "Content-Type: application/json" -H "Authorization: Bearer $auth_header" -d "$body"
    return
  fi

  if [[ -n "$body" ]]; then
    curl -s -o /tmp/jaakd-response.json -w "%{http_code}" -X "$method" "$url" \
      -H "Content-Type: application/json" -d "$body"
    return
  fi

  if [[ -n "$auth_header" ]]; then
    curl -s -o /tmp/jaakd-response.json -w "%{http_code}" -X "$method" "$url" \
      -H "Authorization: Bearer $auth_header"
    return
  fi

  curl -s -o /tmp/jaakd-response.json -w "%{http_code}" -X "$method" "$url"
}

extract_json_value() {
  local key="$1"
  sed -n "s/.*\"$key\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" /tmp/jaakd-response.json | head -n 1
}

wait_for_url "backend actuator" "http://localhost:8081/actuator/health" '"status":"UP"'
wait_for_url "auth swagger" "http://localhost:3000/api-json" '"openapi"'

NO_TOKEN_CODE="$(status_code GET "http://localhost:8081/api/profile")"
if [[ "$NO_TOKEN_CODE" == "401" ]]; then
  PASS "GET /api/profile without token returns 401"
else
  FAIL "GET /api/profile without token expected 401 got $NO_TOKEN_CODE"
fi

TEST_EMAIL="integration.$(date +%s)@example.com"
TEST_PASSWORD="Password123!"
REGISTER_BODY="{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}"
REGISTER_CODE="$(status_code POST "http://localhost:3000/auth/register" "$REGISTER_BODY")"
if [[ "$REGISTER_CODE" == "201" ]]; then
  PASS "POST /auth/register returns 201"
else
  FAIL "POST /auth/register expected 201 got $REGISTER_CODE"
fi

LOGIN_BODY="{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}"
LOGIN_CODE="$(status_code POST "http://localhost:3000/auth/login" "$LOGIN_BODY")"
if [[ "$LOGIN_CODE" == "200" ]]; then
  PASS "POST /auth/login returns 200"
else
  FAIL "POST /auth/login expected 200 got $LOGIN_CODE"
fi

ACCESS_TOKEN="$(extract_json_value accessToken)"
if [[ -z "$ACCESS_TOKEN" ]]; then
  FAIL "Login response did not include accessToken"
fi

PROFILE_BODY='{"firstName":"Joanna","lastName":"Investor","dob":"1990-04-12","city":"Boston","state":"Massachusetts","country":"United States","zipCode":"02110"}'
CREATE_PROFILE_CODE="$(status_code POST "http://localhost:8081/api/profile" "$PROFILE_BODY" "$ACCESS_TOKEN")"
if [[ "$CREATE_PROFILE_CODE" == "201" ]]; then
  PASS "POST /api/profile returns 201"
else
  FAIL "POST /api/profile expected 201 got $CREATE_PROFILE_CODE"
fi

GET_PROFILE_CODE="$(status_code GET "http://localhost:8081/api/profile" "" "$ACCESS_TOKEN")"
if [[ "$GET_PROFILE_CODE" == "200" ]]; then
  PASS "GET /api/profile returns 200"
else
  FAIL "GET /api/profile expected 200 got $GET_PROFILE_CODE"
fi

GET_PORTFOLIOS_CODE="$(status_code GET "http://localhost:8081/api/portfolios" "" "$ACCESS_TOKEN")"
if [[ "$GET_PORTFOLIOS_CODE" == "200" ]]; then
  PASS "GET /api/portfolios returns 200"
else
  FAIL "GET /api/portfolios expected 200 got $GET_PORTFOLIOS_CODE"
fi

USER_ROW_COUNT="$(docker exec jaakd-postgres psql -U postgres -d jaakd -t -A -c "SELECT COUNT(*) FROM users WHERE email = '$TEST_EMAIL';")"
if [[ "$USER_ROW_COUNT" == "1" ]]; then
  PASS "users row exists for registered user"
else
  FAIL "Expected users row count 1, got $USER_ROW_COUNT"
fi

PROFILE_ROW_COUNT="$(docker exec jaakd-postgres psql -U postgres -d jaakd -t -A -c "SELECT COUNT(*) FROM profiles WHERE email = '$TEST_EMAIL';")"
if [[ "$PROFILE_ROW_COUNT" == "1" ]]; then
  PASS "profiles row exists for registered user"
else
  FAIL "Expected profiles row count 1, got $PROFILE_ROW_COUNT"
fi

echo "Checks complete: PASS=$PASS_COUNT FAIL=$FAIL_COUNT"

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  exit 1
fi

exit 0
