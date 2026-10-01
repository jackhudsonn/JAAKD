#!/usr/bin/env bash
set -e

PASS_COUNT=0
FAIL_COUNT=0
COOKIE_JAR="/tmp/jaakd-cookies.txt"
RESPONSE_FILE="/tmp/jaakd-response.json"
BACKEND="http://localhost:8081"

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

# Sends a request carrying the session cookie jar; writes the body to
# RESPONSE_FILE and prints the status code.
status_code() {
  local method="$1"
  local url="$2"
  local body="${3:-}"

  if [[ -n "$body" ]]; then
    curl -s -o "$RESPONSE_FILE" -w "%{http_code}" -X "$method" "$url" \
      -H "Content-Type: application/json" -b "$COOKIE_JAR" -c "$COOKIE_JAR" -d "$body"
    return
  fi

  curl -s -o "$RESPONSE_FILE" -w "%{http_code}" -X "$method" "$url" \
    -b "$COOKIE_JAR" -c "$COOKIE_JAR"
}

extract_json_value() {
  local key="$1"
  sed -n "s/.*\"$key\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" "$RESPONSE_FILE" | head -n 1
}

rm -f "$COOKIE_JAR"

wait_for_url "backend actuator" "$BACKEND/actuator/health" '"status":"UP"'

NO_SESSION_CODE="$(status_code GET "$BACKEND/api/profile")"
if [[ "$NO_SESSION_CODE" == "401" ]]; then
  PASS "GET /api/profile without a session returns 401"
else
  FAIL "GET /api/profile without a session expected 401 got $NO_SESSION_CODE"
fi

TEST_EMAIL="integration.$(date +%s)@example.com"
TEST_PASSWORD="Password123!"
REGISTER_BODY="{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}"
REGISTER_CODE="$(status_code POST "$BACKEND/auth/register" "$REGISTER_BODY")"
if [[ "$REGISTER_CODE" == "201" ]]; then
  PASS "POST /auth/register returns 201"
else
  FAIL "POST /auth/register expected 201 got $REGISTER_CODE"
fi

LOGIN_BODY="{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}"
LOGIN_CODE="$(status_code POST "$BACKEND/auth/login" "$LOGIN_BODY")"
if [[ "$LOGIN_CODE" == "200" ]]; then
  PASS "POST /auth/login returns 200"
else
  FAIL "POST /auth/login expected 200 got $LOGIN_CODE"
fi

if grep -q "jaakd_session" "$COOKIE_JAR" 2>/dev/null; then
  PASS "login set the jaakd_session cookie"
else
  FAIL "login did not set the jaakd_session cookie"
fi

SESSION_CODE="$(status_code GET "$BACKEND/auth/session")"
if [[ "$SESSION_CODE" == "200" ]]; then
  PASS "GET /auth/session returns 200 with the session cookie"
else
  FAIL "GET /auth/session expected 200 got $SESSION_CODE"
fi

PROFILE_BODY='{"firstName":"Joanna","lastName":"Investor","dob":"1990-04-12","city":"Boston","state":"Massachusetts","country":"United States","zipCode":"02110"}'
CREATE_PROFILE_CODE="$(status_code POST "$BACKEND/api/profile" "$PROFILE_BODY")"
if [[ "$CREATE_PROFILE_CODE" == "201" ]]; then
  PASS "POST /api/profile returns 201"
else
  FAIL "POST /api/profile expected 201 got $CREATE_PROFILE_CODE"
fi

GET_PROFILE_CODE="$(status_code GET "$BACKEND/api/profile")"
if [[ "$GET_PROFILE_CODE" == "200" ]]; then
  PASS "GET /api/profile returns 200"
else
  FAIL "GET /api/profile expected 200 got $GET_PROFILE_CODE"
fi

GET_PORTFOLIOS_CODE="$(status_code GET "$BACKEND/api/portfolios")"
if [[ "$GET_PORTFOLIOS_CODE" == "200" ]]; then
  PASS "GET /api/portfolios returns 200"
else
  FAIL "GET /api/portfolios expected 200 got $GET_PORTFOLIOS_CODE"
fi

DEV_CRED_COUNT="$(docker exec jaakd-postgres psql -U postgres -d jaakd -t -A -c "SELECT COUNT(*) FROM dev_credentials WHERE email = '$TEST_EMAIL';")"
if [[ "$DEV_CRED_COUNT" == "1" ]]; then
  PASS "dev_credentials row exists for registered user"
else
  FAIL "Expected dev_credentials row count 1, got $DEV_CRED_COUNT"
fi

USER_ROW_COUNT="$(docker exec jaakd-postgres psql -U postgres -d jaakd -t -A -c "SELECT COUNT(*) FROM users u JOIN dev_credentials d ON d.\"userID\" = u.\"userID\" WHERE d.email = '$TEST_EMAIL';")"
if [[ "$USER_ROW_COUNT" == "1" ]]; then
  PASS "users row exists for registered user"
else
  FAIL "Expected users row count 1, got $USER_ROW_COUNT"
fi

PROFILE_ROW_COUNT="$(docker exec jaakd-postgres psql -U postgres -d jaakd -t -A -c "SELECT COUNT(*) FROM profiles p JOIN dev_credentials d ON d.\"userID\" = p.\"userID\" WHERE d.email = '$TEST_EMAIL';")"
if [[ "$PROFILE_ROW_COUNT" == "1" ]]; then
  PASS "profiles row exists for registered user"
else
  FAIL "Expected profiles row count 1, got $PROFILE_ROW_COUNT"
fi

LOGOUT_CODE="$(status_code POST "$BACKEND/auth/logout")"
if [[ "$LOGOUT_CODE" == "204" ]]; then
  PASS "POST /auth/logout returns 204"
else
  FAIL "POST /auth/logout expected 204 got $LOGOUT_CODE"
fi

AFTER_LOGOUT_CODE="$(status_code GET "$BACKEND/api/profile")"
if [[ "$AFTER_LOGOUT_CODE" == "401" ]]; then
  PASS "GET /api/profile after logout returns 401"
else
  FAIL "GET /api/profile after logout expected 401 got $AFTER_LOGOUT_CODE"
fi

echo "Checks complete: PASS=$PASS_COUNT FAIL=$FAIL_COUNT"

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  exit 1
fi

exit 0
